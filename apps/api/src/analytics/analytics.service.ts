import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Get comprehensive analytics for a restaurant
   */
  async getRestaurantAnalytics(
    restaurantId: string,
    periodDays = 30,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startStr = startDate.toISOString().split('T')[0];

    const [reservations, payments, orders, reviews] = await Promise.all([
      this.supabase
        .from('reservations')
        .select('id, date, time, party_size, status, booking_channel, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('date', startStr),
      this.supabase
        .from('payments')
        .select('amount, status, created_at')
        .eq('status', 'success')
        .in(
          'reservation_id',
          (
            await this.supabase
              .from('reservations')
              .select('id')
              .eq('restaurant_id', restaurantId)
              .gte('date', startStr)
          ).data?.map((r) => r.id) || [],
        ),
      this.supabase
        .from('orders')
        .select('total, status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString()),
      this.supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString()),
    ]);

    const allReservations = reservations.data || [];
    const allPayments = payments.data || [];
    const allOrders = orders.data || [];
    const allReviews = reviews.data || [];

    // Revenue
    const depositRevenue = allPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const orderRevenue = allOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    // Reservation stats
    const completed = allReservations.filter(
      (r) => r.status === 'completed',
    );
    const noShows = allReservations.filter(
      (r) => r.status === 'no_show',
    );
    const cancelled = allReservations.filter(
      (r) => r.status === 'cancelled',
    );
    const totalCovers = completed.reduce(
      (sum, r) => sum + r.party_size,
      0,
    );

    // Peak hours heatmap (hour -> count)
    const hourCounts: Record<number, number> = {};
    for (const r of allReservations) {
      if (r.time) {
        const hour = parseInt(r.time.split(':')[0], 10);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
      .sort((a, b) => b.count - a.count);

    // Day of week distribution
    const dayCounts: Record<number, number> = {};
    for (const r of allReservations) {
      const day = new Date(r.date).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayDistribution = dayNames.map((name, i) => ({
      day: name,
      count: dayCounts[i] || 0,
    }));

    // Channel breakdown
    const channelCounts: Record<string, number> = {};
    for (const r of allReservations) {
      const ch = r.booking_channel || 'web';
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }
    const channelBreakdown = Object.entries(channelCounts).map(
      ([channel, count]) => ({ channel, count }),
    );

    // Daily revenue trend
    const dailyRevenue: Record<string, number> = {};
    for (const p of allPayments) {
      const day = p.created_at.split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (p.amount || 0);
    }
    const revenueTrend = Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Average rating
    const avgRating =
      allReviews.length > 0
        ? Math.round(
            (allReviews.reduce((s, r) => s + r.rating, 0) /
              allReviews.length) *
              10,
          ) / 10
        : null;

    // Repeat guest rate
    const guestBookings = new Map<string, number>();
    for (const r of allReservations) {
      // user_id not in select — get from full query
    }
    const { data: guestData } = await this.supabase
      .from('reservations')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'completed')
      .gte('date', startStr);

    for (const g of guestData || []) {
      guestBookings.set(g.user_id, (guestBookings.get(g.user_id) || 0) + 1);
    }
    const uniqueGuests = guestBookings.size;
    const repeatGuests = Array.from(guestBookings.values()).filter(
      (c) => c > 1,
    ).length;

    return {
      period_days: periodDays,
      revenue: {
        deposits: depositRevenue,
        orders: orderRevenue,
        total: depositRevenue + orderRevenue,
        trend: revenueTrend,
      },
      reservations: {
        total: allReservations.length,
        completed: completed.length,
        cancelled: cancelled.length,
        no_shows: noShows.length,
        no_show_rate:
          allReservations.length > 0
            ? Math.round(
                (noShows.length / allReservations.length) * 100,
              )
            : 0,
      },
      covers: {
        total: totalCovers,
        avg_party_size:
          completed.length > 0
            ? Math.round((totalCovers / completed.length) * 10) / 10
            : 0,
      },
      guests: {
        unique: uniqueGuests,
        repeat: repeatGuests,
        repeat_rate:
          uniqueGuests > 0
            ? Math.round((repeatGuests / uniqueGuests) * 100)
            : 0,
      },
      ratings: {
        average: avgRating,
        total_reviews: allReviews.length,
      },
      peak_hours: peakHours.slice(0, 5),
      day_distribution: dayDistribution,
      channel_breakdown: channelBreakdown,
    };
  }
}
