import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async search(dto: SearchRestaurantsDto) {
    const supabase = this.supabaseService.getClient();
    const {
      q,
      city,
      neighborhood,
      cuisine,
      price_range,
      sort_by = 'rating_avg',
      sort_order = 'desc',
      limit = 20,
      offset = 0,
    } = dto;

    let query = supabase
      .from('restaurants')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .is('deleted_at', null);

    if (q) {
      // Escape special Postgres LIKE characters to prevent wildcard injection
      const sanitized = q.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('name', `%${sanitized}%`);
    }

    if (city) {
      query = query.eq('city', city);
    }

    if (neighborhood) {
      query = query.eq('neighborhood', neighborhood);
    }

    if (cuisine) {
      query = query.contains('cuisine_types', [cuisine]);
    }

    if (price_range) {
      query = query.eq('price_range', price_range);
    }

    const ascending = sort_order === 'asc';
    query = query
      .order(sort_by, { ascending })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error('Restaurant search failed', error);
      throw new BadRequestException('Search failed');
    }

    return {
      restaurants: data || [],
      total: count || 0,
      limit,
      offset,
    };
  }

  async findBySlug(slug: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('restaurants')
      .select(
        `
        *,
        restaurant_photos (id, url, thumbnail_url, type, caption, sort_order),
        dining_areas (id, name, sort_order, is_active,
          tables (id, table_number, min_seats, max_seats, shape, status)
        ),
        deals (id, title, description, discount_pct, valid_from, valid_to, is_active),
        reviews (id, rating, text, is_public, created_at,
          profiles:user_id (first_name, last_name, avatar_url)
        )
      `,
      )
      .eq('slug', slug)
      .in('status', ['active', 'approved'])
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Restaurant not found');
    }

    return data;
  }

  async findById(id: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Restaurant not found');
    }

    return data;
  }

  async create(dto: CreateRestaurantDto, ownerId: string) {
    const supabase = this.supabaseService.getClient();

    // Generate slug from name
    const baseSlug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Ensure slug is unique
    const { data: existing } = await supabase
      .from('restaurants')
      .select('slug')
      .ilike('slug', `${baseSlug}%`);

    let slug = baseSlug;
    if (existing && existing.length > 0) {
      slug = `${baseSlug}-${existing.length + 1}`;
    }

    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        owner_id: ownerId,
        name: dto.name,
        slug,
        description: dto.description || null,
        cuisine_types: dto.cuisine_types,
        address: dto.address,
        city: dto.city,
        neighborhood: dto.neighborhood,
        phone: dto.phone,
        email: dto.email || null,
        product_type: dto.product_type,
        price_range: dto.price_range || 'moderate',
        avg_price_per_person: dto.avg_price_per_person || null,
        deposit_per_guest: dto.deposit_per_guest || 0,
        cancellation_window_hours: dto.cancellation_window_hours || 4,
        operating_hours: dto.operating_hours || {},
        instagram_handle: dto.instagram_handle || null,
        latitude: dto.latitude || null,
        longitude: dto.longitude || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create restaurant', error);
      throw new BadRequestException('Failed to create restaurant');
    }

    // Update owner's role to restaurant_owner
    await supabase
      .from('profiles')
      .update({ role: 'restaurant_owner' })
      .eq('id', ownerId)
      .eq('role', 'diner');

    return data;
  }

  async update(id: string, dto: UpdateRestaurantDto, userId: string) {
    const restaurant = await this.findById(id);

    if (restaurant.owner_id !== userId) {
      throw new ForbiddenException('You do not own this restaurant');
    }

    const supabase = this.supabaseService.getClient();

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.cuisine_types !== undefined) updateData.cuisine_types = dto.cuisine_types;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.neighborhood !== undefined) updateData.neighborhood = dto.neighborhood;
    if (dto.price_range !== undefined) updateData.price_range = dto.price_range;
    if (dto.avg_price_per_person !== undefined)
      updateData.avg_price_per_person = dto.avg_price_per_person;
    if (dto.deposit_per_guest !== undefined)
      updateData.deposit_per_guest = dto.deposit_per_guest;
    if (dto.cancellation_window_hours !== undefined)
      updateData.cancellation_window_hours = dto.cancellation_window_hours;
    if (dto.walk_in_ratio !== undefined) updateData.walk_in_ratio = dto.walk_in_ratio;
    if (dto.operating_hours !== undefined)
      updateData.operating_hours = dto.operating_hours;
    if (dto.instagram_handle !== undefined)
      updateData.instagram_handle = dto.instagram_handle;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;

    const { data, error } = await supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update restaurant', error);
      throw new BadRequestException('Failed to update restaurant');
    }

    return data;
  }

  async getAvailability(restaurantId: string, date: string, partySize: number) {
    const restaurant = await this.findById(restaurantId);

    const dayOfWeek = new Date(date)
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();

    const hours = (restaurant.operating_hours as Record<string, { open: string; close: string }> | null)?.[dayOfWeek];

    if (!hours) {
      return { slots: [], message: 'Restaurant is closed on this day' };
    }

    // Generate time slots
    const slots: { time: string; available: boolean; remaining_seats: number }[] = [];
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    let current = openH * 60 + openM;
    const end = closeH * 60 + closeM;

    const supabase = this.supabaseService.getClient();

    // Get all reservations for this date
    const { data: reservations } = await supabase
      .from('reservations')
      .select('time, party_size')
      .eq('restaurant_id', restaurantId)
      .eq('date', date)
      .not('status', 'in', '("cancelled","no_show")');

    // Calculate total capacity from tables
    const { data: areas } = await supabase
      .from('dining_areas')
      .select('tables (max_seats)')
      .eq('restaurant_id', restaurantId)
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

    // Account for walk-in ratio
    const reservableCapacity = Math.floor(
      totalCapacity * ((100 - (restaurant.walk_in_ratio || 60)) / 100),
    );

    // Default capacity if no tables are set up yet
    const effectiveCapacity = reservableCapacity || 30;

    while (current < end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      // Count reserved seats in overlapping time window (2 hours)
      const slotStart = current;
      const slotEnd = current + 120;

      let reservedSeats = 0;
      if (reservations) {
        for (const r of reservations) {
          const [rh, rm] = r.time.split(':').map(Number);
          const rStart = rh * 60 + rm;
          const rEnd = rStart + 120;

          if (rStart < slotEnd && rEnd > slotStart) {
            reservedSeats += r.party_size;
          }
        }
      }

      const remaining = effectiveCapacity - reservedSeats;

      slots.push({
        time: timeStr,
        available: remaining >= partySize,
        remaining_seats: Math.max(0, remaining),
      });

      current += 30;
    }

    return { slots };
  }

  async getMyRestaurants(ownerId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch restaurants');
    }

    return data || [];
  }
}
