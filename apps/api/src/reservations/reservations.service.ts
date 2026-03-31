import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  private readonly redisUrl: string;
  private readonly redisToken: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.redisUrl = this.configService.get<string>('UPSTASH_REDIS_REST_URL') || '';
    this.redisToken = this.configService.get<string>('UPSTASH_REDIS_REST_TOKEN') || '';
  }

  // ── Redis distributed lock ──────────────────────────────────
  private async acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
    if (!this.redisUrl || !this.redisToken) {
      // No Redis configured — use in-memory fallback for dev
      return true;
    }

    try {
      const res = await fetch(`${this.redisUrl}/set/${encodeURIComponent(key)}/locked/NX/EX/${ttlSeconds}`, {
        headers: { Authorization: `Bearer ${this.redisToken}` },
      });
      const data = await res.json();
      return data.result === 'OK';
    } catch (error) {
      this.logger.error('Redis lock acquisition failed', error);
      return false;
    }
  }

  private async releaseLock(key: string): Promise<void> {
    if (!this.redisUrl || !this.redisToken) return;

    try {
      await fetch(`${this.redisUrl}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.redisToken}` },
      });
    } catch (error) {
      this.logger.error('Redis lock release failed', error);
    }
  }

  // ── Create reservation with double-booking prevention ──────
  async create(dto: CreateReservationDto, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Validate date is in the future
    const bookingDate = new Date(`${dto.date}T${dto.time}:00`);
    if (bookingDate <= new Date()) {
      throw new BadRequestException('Booking date must be in the future');
    }

    // Check restaurant exists and is active
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, name, status, max_advance_booking_days, walk_in_ratio, deposit_per_guest, cancellation_window_hours')
      .eq('id', dto.restaurant_id)
      .single();

    if (restError || !restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (restaurant.status !== 'active') {
      throw new BadRequestException('Restaurant is not accepting bookings');
    }

    // Check advance booking limit
    const daysAhead = Math.ceil(
      (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysAhead > (restaurant.max_advance_booking_days || 30)) {
      throw new BadRequestException(
        `Bookings can only be made up to ${restaurant.max_advance_booking_days || 30} days in advance`,
      );
    }

    // Check user is not suspended
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', userId)
      .single();

    if (profile?.is_suspended) {
      throw new ForbiddenException(
        'Your account is suspended due to repeated no-shows',
      );
    }

    // ── Double-booking prevention with Redis lock ──
    const lockKey = `restaurant:${dto.restaurant_id}:slot:${dto.date}:${dto.time}`;
    let lockAcquired = false;
    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 100;

    while (!lockAcquired && retries < maxRetries) {
      lockAcquired = await this.acquireLock(lockKey, 10);
      if (!lockAcquired) {
        retries++;
        if (retries < maxRetries) {
          await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, retries - 1)));
        }
      }
    }

    if (!lockAcquired) {
      throw new ConflictException(
        'This time slot is currently being booked. Please try again.',
      );
    }

    try {
      // Check availability within the lock
      const slotStart = dto.time;
      const [h, m] = dto.time.split(':').map(Number);
      const endMinutes = h * 60 + m + 120; // 2-hour window
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const slotEnd = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

      // Count existing reservations in overlapping time window
      const { data: existing, error: countError } = await supabase
        .from('reservations')
        .select('party_size')
        .eq('restaurant_id', dto.restaurant_id)
        .eq('date', dto.date)
        .not('status', 'in', '("cancelled","no_show")')
        .gte('time', slotStart)
        .lt('time', slotEnd);

      if (countError) {
        throw new BadRequestException('Failed to check availability');
      }

      // Calculate capacity
      const { data: areas } = await supabase
        .from('dining_areas')
        .select('tables (max_seats)')
        .eq('restaurant_id', dto.restaurant_id)
        .eq('is_active', true);

      let totalCapacity = 0;
      if (areas) {
        for (const area of areas) {
          const tables = area.tables as { max_seats: number }[] | null;
          if (tables) {
            totalCapacity += tables.reduce((sum: number, t: { max_seats: number }) => sum + t.max_seats, 0);
          }
        }
      }

      const walkInRatio = restaurant.walk_in_ratio || 60;
      const reservableCapacity = Math.floor(totalCapacity * ((100 - walkInRatio) / 100)) || 30;

      const reservedSeats = (existing || []).reduce(
        (sum: number, r: { party_size: number }) => sum + r.party_size,
        0,
      );

      if (reservedSeats + dto.party_size > reservableCapacity) {
        throw new ConflictException(
          'This time slot is fully booked. Please choose another time.',
        );
      }

      // Calculate deposit
      const depositAmount = (restaurant.deposit_per_guest || 0) * dto.party_size;

      // Calculate deal discount
      let discountAmount = 0;
      if (dto.deal_id) {
        const { data: deal } = await supabase
          .from('deals')
          .select('discount_pct, is_active, valid_from, valid_to')
          .eq('id', dto.deal_id)
          .eq('restaurant_id', dto.restaurant_id)
          .single();

        if (deal && deal.is_active && deal.valid_from <= dto.date && deal.valid_to >= dto.date) {
          discountAmount = Math.floor(depositAmount * (deal.discount_pct / 100));
        }
      }

      // Insert reservation
      const { data: reservation, error: insertError } = await supabase
        .from('reservations')
        .insert({
          restaurant_id: dto.restaurant_id,
          user_id: userId,
          date: dto.date,
          time: dto.time,
          party_size: dto.party_size,
          channel: dto.channel,
          special_requests: dto.special_requests || null,
          deposit_amount: depositAmount,
          deposit_status: depositAmount > 0 ? 'pending' : 'none',
          deal_id: dto.deal_id || null,
          discount_amount: discountAmount,
          status: 'pending',
          booking_type: 'instant',
        })
        .select()
        .single();

      if (insertError) {
        this.logger.error('Failed to create reservation', insertError);
        throw new BadRequestException('Failed to create reservation');
      }

      // Populate guest fields from user profile
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, email')
          .eq('id', userId)
          .single();

        if (userProfile) {
          const guestName = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') || null;
          await supabase
            .from('reservations')
            .update({
              guest_name: guestName,
              guest_phone: userProfile.phone || null,
              guest_email: userProfile.email || null,
            })
            .eq('id', reservation.id);
        }
      } catch (err) {
        this.logger.warn('Failed to populate guest fields', err);
      }

      return reservation;
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  // ── List user's reservations ───────────────────────────────
  async listForUser(userId: string, status?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('reservations')
      .select('*, restaurants (name, slug, cover_photo_url, address, neighborhood, city)')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException('Failed to fetch reservations');
    }

    return data || [];
  }

  // ── List restaurant's reservations (staff) ─────────────────
  async listForRestaurant(restaurantId: string, date?: string, status?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('reservations')
      .select('*, profiles:user_id (first_name, last_name, phone, avatar_url)')
      .eq('restaurant_id', restaurantId)
      .order('time', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException('Failed to fetch reservations');
    }

    return data || [];
  }

  // ── Get by reference code (with ownership check) ──────────
  async findByRef(ref: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('reservations')
      .select('*, restaurants (name, slug, cover_photo_url, address, neighborhood, city, phone, owner_id)')
      .eq('reference_code', ref)
      .single();

    if (error || !data) {
      throw new NotFoundException('Reservation not found');
    }

    // Allow access if: diner who made the booking, restaurant owner, restaurant staff, or admin
    const restaurant = data.restaurants as { owner_id: string } | null;
    const isOwner = data.user_id === userId;
    const isRestaurantOwner = restaurant?.owner_id === userId;

    if (!isOwner && !isRestaurantOwner) {
      // Check staff or admin
      const { data: staff } = await supabase
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', data.restaurant_id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!staff) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
          throw new ForbiddenException('You do not have access to this reservation');
        }
      }
    }

    return data;
  }

  // ── Modify reservation ─────────────────────────────────────
  async update(id: string, dto: UpdateReservationDto, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: reservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.user_id !== userId) throw new ForbiddenException('Not your reservation');
    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      throw new BadRequestException('Cannot modify this reservation');
    }

    const updates: Record<string, unknown> = {};
    if (dto.date) updates.date = dto.date;
    if (dto.time) updates.time = dto.time;
    if (dto.party_size) updates.party_size = dto.party_size;
    if (dto.special_requests !== undefined) updates.special_requests = dto.special_requests;

    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException('Failed to update reservation');

    return data;
  }

  // ── Cancel reservation ─────────────────────────────────────
  async cancel(id: string, userId: string, reason?: string, cancelledBy: 'diner' | 'restaurant' | 'system' = 'diner') {
    const supabase = this.supabaseService.getClient();

    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (cancellation_window_hours)')
      .eq('id', id)
      .single();

    if (!reservation) throw new NotFoundException('Reservation not found');

    // Only the diner, restaurant staff, or admin can cancel
    if (cancelledBy === 'diner' && reservation.user_id !== userId) {
      throw new ForbiddenException('Not your reservation');
    }

    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      throw new BadRequestException('Reservation already finalized');
    }

    // Determine if refund is auto-approved
    const restaurant = reservation.restaurants as { cancellation_window_hours: number } | null;
    const windowHours = restaurant?.cancellation_window_hours || 4;
    const bookingTime = new Date(`${reservation.date}T${reservation.time}:00`);
    const hoursUntilBooking = (bookingTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const withinWindow = hoursUntilBooking >= windowHours;

    const { data, error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason || null,
        deposit_status:
          reservation.deposit_status === 'paid'
            ? withinWindow || cancelledBy !== 'diner'
              ? 'refunded'
              : 'forfeited'
            : reservation.deposit_status,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException('Failed to cancel reservation');

    return { ...data, refund_eligible: withinWindow || cancelledBy !== 'diner' };
  }

  // ── Staff actions ──────────────────────────────────────────
  async confirm(id: string, restaurantId: string) {
    return this.updateStatus(id, restaurantId, 'confirmed', { confirmed_at: new Date().toISOString() });
  }

  async seat(id: string, restaurantId: string) {
    return this.updateStatus(id, restaurantId, 'seated', { seated_at: new Date().toISOString() });
  }

  async complete(id: string, restaurantId: string) {
    const supabase = this.supabaseService.getClient();
    const result = await this.updateStatus(id, restaurantId, 'completed', {
      completed_at: new Date().toISOString(),
      feedback_requested: true,
    });

    // Increment restaurant total_bookings
    try {
      await supabase.rpc('increment_total_bookings' as never, { restaurant_uuid: restaurantId } as never);
    } catch {
      // RPC may not exist yet — silently ignore
    }

    return result;
  }

  async markNoShow(id: string, restaurantId: string) {
    const supabase = this.supabaseService.getClient();

    // Get reservation first
    const { data: reservation } = await supabase
      .from('reservations')
      .select('user_id, deposit_status')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (!reservation) throw new NotFoundException('Reservation not found');

    // Update reservation status
    await this.updateStatus(id, restaurantId, 'no_show', {
      no_show_marked_at: new Date().toISOString(),
      deposit_status: reservation.deposit_status === 'paid' ? 'forfeited' : reservation.deposit_status,
    });

    // Increment user's no-show count
    const { data: profile } = await supabase
      .from('profiles')
      .select('no_show_count')
      .eq('id', reservation.user_id)
      .single();

    const newCount = (profile?.no_show_count || 0) + 1;

    // Get strike limit from system config
    const { data: config } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'no_show_strike_limit')
      .single();

    const strikeLimit = (config?.value as number) || 4;

    const updateData: Record<string, unknown> = {
      no_show_count: newCount,
    };

    if (newCount >= strikeLimit) {
      updateData.is_suspended = true;
      updateData.suspension_reason = `Suspended after ${newCount} no-shows`;
    }

    await supabase.from('profiles').update(updateData).eq('id', reservation.user_id);

    return {
      message: 'No-show recorded',
      no_show_count: newCount,
      suspended: newCount >= strikeLimit,
    };
  }

  // ── Helper: update status with restaurant ownership check ──
  private async updateStatus(
    id: string,
    restaurantId: string,
    status: string,
    extraFields: Record<string, unknown> = {},
  ) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('reservations')
      .update({ status, ...extraFields })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestException(`Failed to update reservation to ${status}`);
    }

    return data;
  }
}
