import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';

@Injectable()
export class WaitlistService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async create(dto: CreateWaitlistEntryDto, userId: string) {
    // Check restaurant exists and is active
    const { data: restaurant } = await this.supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', dto.restaurant_id)
      .eq('status', 'active')
      .single();

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Check if already on waitlist
    const { data: existing } = await this.supabase
      .from('waitlist_entries')
      .select('id')
      .eq('restaurant_id', dto.restaurant_id)
      .eq('user_id', userId)
      .eq('status', 'waiting')
      .single();

    if (existing) {
      throw new BadRequestException('You are already on the waitlist');
    }

    // Estimate wait (count people ahead * avg dining time of 90 mins / available tables)
    const { count: ahead } = await this.supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', dto.restaurant_id)
      .eq('status', 'waiting');

    const { count: tableCount } = await this.supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available')
      .in(
        'dining_area_id',
        (
          await this.supabase
            .from('dining_areas')
            .select('id')
            .eq('restaurant_id', dto.restaurant_id)
            .eq('is_active', true)
        ).data?.map((d) => d.id) || [],
      );

    const tables = tableCount || 1;
    const estimatedMinutes = Math.ceil(((ahead || 0) * 90) / tables);

    const { data, error } = await this.supabase
      .from('waitlist_entries')
      .insert({
        ...dto,
        user_id: userId,
        estimated_wait_minutes: estimatedMinutes,
        position: (ahead || 0) + 1,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ...data, estimated_wait_minutes: estimatedMinutes };
  }

  async getByRestaurant(restaurantId: string) {
    const { data } = await this.supabase
      .from('waitlist_entries')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    return data || [];
  }

  async notifyGuest(entryId: string) {
    const { data: entry, error } = await this.supabase
      .from('waitlist_entries')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('status', 'waiting')
      .select('*, restaurants(name)')
      .single();

    if (error || !entry) {
      throw new NotFoundException('Waitlist entry not found or not waiting');
    }

    // Notify the guest
    await this.notificationsService.dispatch({
      userId: entry.user_id,
      type: 'system',
      channels: ['sms', 'whatsapp', 'in_app'],
      title: 'Your Table is Ready!',
      body: `Your table at ${entry.restaurants?.name} is ready. Please check in within 15 minutes.`,
    });

    return entry;
  }

  async seatGuest(entryId: string) {
    const { data, error } = await this.supabase
      .from('waitlist_entries')
      .update({
        status: 'seated',
        seated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .in('status', ['waiting', 'notified'])
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Waitlist entry not found');
    }

    return data;
  }

  async remove(entryId: string) {
    const { error } = await this.supabase
      .from('waitlist_entries')
      .update({ status: 'cancelled' })
      .eq('id', entryId)
      .in('status', ['waiting', 'notified']);

    if (error) {
      throw new NotFoundException('Waitlist entry not found');
    }

    return { success: true };
  }
}
