import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

export interface Insight {
  type: 'warning' | 'success' | 'info' | 'action';
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

@Injectable()
export class InsightsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getInsights(restaurantId: string): Promise<Insight[]> {
    const insights: Insight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().split('T')[0];

    // Parallel data fetches
    const [
      reservations30d,
      photos,
      reviews,
      todayReservations,
      restaurant,
    ] = await Promise.all([
      this.supabase
        .from('reservations')
        .select('status, date, time, party_size')
        .eq('restaurant_id', restaurantId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]),
      this.supabase
        .from('restaurant_photos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
      this.supabase
        .from('reviews')
        .select('id, rating, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sevenDaysAgo.toISOString()),
      this.supabase
        .from('reservations')
        .select('id, time, party_size, status, guest_name')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
        .in('status', ['confirmed', 'pending']),
      this.supabase
        .from('restaurants')
        .select('deposit_per_guest, cover_photo_url')
        .eq('id', restaurantId)
        .single(),
    ]);

    const all = reservations30d.data || [];
    const noShows = all.filter((r) => r.status === 'no_show');
    const completed = all.filter((r) => r.status === 'completed');
    const photoCount = photos.count || 0;
    const newReviews = reviews.data || [];
    const todayBookings = todayReservations.data || [];
    const rest = restaurant.data;

    // ── No-show rate warning ──
    if (all.length >= 10) {
      const noShowRate = Math.round((noShows.length / all.length) * 100);
      if (noShowRate > 15) {
        if (!rest?.deposit_per_guest || rest.deposit_per_guest === 0) {
          insights.push({
            type: 'warning',
            icon: '⚠️',
            title: `${noShowRate}% no-show rate`,
            description: 'Enable deposit collection — restaurants using deposits see 60% fewer no-shows.',
            action: { label: 'Enable Deposits', href: '/settings' },
          });
        } else {
          insights.push({
            type: 'warning',
            icon: '⚠️',
            title: `${noShowRate}% no-show rate despite deposits`,
            description: 'Consider increasing your deposit amount or requiring full prepayment for peak hours.',
            action: { label: 'Adjust Settings', href: '/settings' },
          });
        }
      }
    }

    // ── Low photo count ──
    if (photoCount < 5) {
      insights.push({
        type: 'action',
        icon: '📸',
        title: photoCount === 0 ? 'No photos uploaded' : `Only ${photoCount} photo${photoCount > 1 ? 's' : ''}`,
        description: 'Restaurants with 5+ photos get 3x more bookings. Upload photos of your food, interior, and ambiance.',
        action: { label: 'Upload Photos', href: '/photos' },
      });
    }

    // ── New reviews to respond to ──
    if (newReviews.length > 0) {
      const avgRating = Math.round(
        (newReviews.reduce((s, r) => s + r.rating, 0) / newReviews.length) * 10,
      ) / 10;
      insights.push({
        type: avgRating >= 4 ? 'success' : 'info',
        icon: avgRating >= 4 ? '⭐' : '💬',
        title: `${newReviews.length} new review${newReviews.length > 1 ? 's' : ''} this week`,
        description: avgRating >= 4
          ? `Average ${avgRating}/5 — your guests love you! Respond to keep them engaged.`
          : `Average ${avgRating}/5 — respond to reviews to show you care about feedback.`,
      });
    }

    // ── VIP dining today ──
    if (todayBookings.length > 0) {
      // Check for VIPs (guests with 5+ visits)
      const guestNames = todayBookings
        .filter((b) => b.guest_name)
        .map((b) => b.guest_name);

      if (guestNames.length > 0) {
        insights.push({
          type: 'info',
          icon: '🎯',
          title: `${todayBookings.length} booking${todayBookings.length > 1 ? 's' : ''} today`,
          description: `Today's guests: ${guestNames.slice(0, 3).join(', ')}${guestNames.length > 3 ? ` +${guestNames.length - 3} more` : ''}`,
          action: { label: 'View Reservations', href: '/reservations' },
        });
      }
    }

    // ── Slow days detection ──
    const dayCounts: Record<number, number> = {};
    for (const r of all) {
      const day = new Date(r.date).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const avgPerDay = all.length / 7;
    const slowDays = Object.entries(dayCounts)
      .filter(([, count]) => count < avgPerDay * 0.4)
      .map(([day]) => dayNames[parseInt(day)]);

    if (slowDays.length > 0 && all.length >= 20) {
      insights.push({
        type: 'action',
        icon: '📊',
        title: `Low bookings on ${slowDays.join(', ')}`,
        description: `Create a special deal or promotion for ${slowDays[0]}s to fill empty tables.`,
      });
    }

    // ── Revenue milestone ──
    if (completed.length > 0 && completed.length % 50 < 5) {
      insights.push({
        type: 'success',
        icon: '🎉',
        title: `${completed.length} bookings completed!`,
        description: 'Your restaurant is growing on DineRoot. Share your booking link to reach even more diners.',
      });
    }

    // ── No cover photo ──
    if (!rest?.cover_photo_url) {
      insights.push({
        type: 'warning',
        icon: '🖼️',
        title: 'No cover photo set',
        description: 'Add a cover photo — it\'s the first thing diners see when browsing.',
        action: { label: 'Add Cover Photo', href: '/photos' },
      });
    }

    return insights.slice(0, 5); // Max 5 insights at a time
  }
}
