import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class GuestsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Get all guests for a restaurant with visit stats
   */
  async getGuestsByRestaurant(
    restaurantId: string,
    page = 1,
    limit = 20,
    search?: string,
    tag?: string,
  ) {
    const offset = (page - 1) * limit;

    // Get unique guests who have reservations at this restaurant
    let query = this.supabase
      .from('reservations')
      .select(
        'user_id, profiles!inner(id, first_name, last_name, email, phone)',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .in('status', ['confirmed', 'seated', 'completed']);

    if (search) {
      query = query.or(
        `profiles.first_name.ilike.%${search}%,profiles.last_name.ilike.%${search}%,profiles.phone.ilike.%${search}%`,
      );
    }

    const { data: reservations } = await query;

    // Deduplicate by user_id and aggregate stats
    const guestMap = new Map<string, {
      user_id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string;
      visit_count: number;
    }>();

    for (const r of reservations || []) {
      const profile = r.profiles as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string;
      };
      const existing = guestMap.get(r.user_id);
      if (existing) {
        existing.visit_count++;
      } else {
        guestMap.set(r.user_id, {
          user_id: r.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          visit_count: 1,
        });
      }
    }

    let guests = Array.from(guestMap.values())
      .sort((a, b) => b.visit_count - a.visit_count);

    // Load tags for each guest
    const guestIds = guests.map((g) => g.user_id);
    const { data: allTags } = await this.supabase
      .from('guest_tags')
      .select('user_id, tag')
      .eq('restaurant_id', restaurantId)
      .in('user_id', guestIds.length ? guestIds : ['__none__']);

    const tagsByUser = new Map<string, string[]>();
    for (const t of allTags || []) {
      const list = tagsByUser.get(t.user_id) || [];
      list.push(t.tag);
      tagsByUser.set(t.user_id, list);
    }

    // Filter by tag if specified
    if (tag) {
      guests = guests.filter((g) =>
        (tagsByUser.get(g.user_id) || []).includes(tag),
      );
    }

    const total = guests.length;
    const paginated = guests.slice(offset, offset + limit);

    return {
      data: paginated.map((g) => ({
        ...g,
        tags: tagsByUser.get(g.user_id) || [],
        is_vip: (tagsByUser.get(g.user_id) || []).includes('VIP'),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get full guest profile with visit history
   */
  async getGuestProfile(restaurantId: string, userId: string) {
    // Profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, loyalty_tier, created_at')
      .eq('id', userId)
      .single();

    if (!profile) throw new NotFoundException('Guest not found');

    // Visit history
    const { data: visits } = await this.supabase
      .from('reservations')
      .select('id, reference_code, date, time, party_size, status, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);

    // Tags
    const { data: tags } = await this.supabase
      .from('guest_tags')
      .select('tag, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId);

    // Notes
    const { data: notes } = await this.supabase
      .from('guest_notes')
      .select('id, note, created_by, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Order history
    const { data: orders } = await this.supabase
      .from('orders')
      .select('id, reference_code, total, status, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Stats
    const completedVisits = (visits || []).filter(
      (v) => v.status === 'completed',
    );
    const totalSpent = (orders || [])
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      profile,
      stats: {
        total_visits: completedVisits.length,
        total_reservations: (visits || []).length,
        total_orders: (orders || []).length,
        total_spent: totalSpent,
        first_visit: completedVisits[completedVisits.length - 1]?.date || null,
        last_visit: completedVisits[0]?.date || null,
        avg_party_size:
          completedVisits.length > 0
            ? Math.round(
                completedVisits.reduce((s, v) => s + v.party_size, 0) /
                  completedVisits.length,
              )
            : 0,
      },
      tags: (tags || []).map((t) => t.tag),
      notes: notes || [],
      visits: visits || [],
      orders: orders || [],
    };
  }

  /**
   * Add a tag to a guest
   */
  async addTag(restaurantId: string, userId: string, tag: string) {
    const { error } = await this.supabase.from('guest_tags').upsert(
      {
        restaurant_id: restaurantId,
        user_id: userId,
        tag: tag.trim(),
      },
      { onConflict: 'restaurant_id,user_id,tag' },
    );

    if (error) throw new NotFoundException(error.message);
    return { success: true };
  }

  /**
   * Remove a tag from a guest
   */
  async removeTag(restaurantId: string, userId: string, tag: string) {
    await this.supabase
      .from('guest_tags')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .eq('tag', tag);

    return { success: true };
  }

  /**
   * Add a note about a guest
   */
  async addNote(
    restaurantId: string,
    userId: string,
    note: string,
    createdBy: string,
  ) {
    const { data, error } = await this.supabase
      .from('guest_notes')
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        note,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new NotFoundException(error.message);
    return data;
  }

  /**
   * Get VIP guests (auto-detected: 5+ visits or tagged VIP)
   */
  async getVipGuests(restaurantId: string) {
    const allGuests = await this.getGuestsByRestaurant(restaurantId, 1, 1000);

    return allGuests.data.filter(
      (g) => g.is_vip || g.visit_count >= 5,
    );
  }

  /**
   * Auto-tag VIP guests (call periodically or after booking completion)
   */
  async autoTagVips(restaurantId: string) {
    const allGuests = await this.getGuestsByRestaurant(restaurantId, 1, 1000);
    let tagged = 0;

    for (const guest of allGuests.data) {
      if (guest.visit_count >= 5 && !guest.is_vip) {
        await this.addTag(restaurantId, guest.user_id, 'VIP');
        tagged++;
      }
    }

    return { tagged };
  }
}
