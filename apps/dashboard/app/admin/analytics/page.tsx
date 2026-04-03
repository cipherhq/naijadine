'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@naijadine/shared';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface CityStats {
  city: string;
  count: number;
  bookings: number;
}

export default function AdminAnalyticsPage() {
  const { verified } = useAdminGuard();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '365d'>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    newUsers: 0,
    newRestaurants: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    revenue: 0,
    avgBookingSize: 0,
  });
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [channelMix, setChannelMix] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!verified) return;
    async function fetchAnalytics() {
      setLoading(true);
      const supabase = createClient();
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startStr = startDate.toISOString();

      const [usersRes, restaurantsRes, bookingsRes, paymentsRes, cityData] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startStr),
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).gte('created_at', startStr),
        supabase.from('reservations').select('status, party_size, channel, restaurant_id').gte('created_at', startStr),
        supabase.from('payments').select('amount').eq('status', 'successful').gte('created_at', startStr),
        supabase.from('restaurants').select('city').in('status', ['active', 'approved']),
      ]);

      const bookings = bookingsRes.data || [];
      const revenue = (paymentsRes.data || []).reduce((s, p) => s + (p.amount || 0), 0);

      const completed = bookings.filter((b) => b.status === 'completed').length;
      const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
      const noShow = bookings.filter((b) => b.status === 'no_show').length;
      const totalCovers = bookings.reduce((s, b) => s + b.party_size, 0);

      // Channel mix
      const channels: Record<string, number> = {};
      for (const b of bookings) {
        const ch = b.channel || 'web';
        channels[ch] = (channels[ch] || 0) + 1;
      }
      setChannelMix(channels);

      // City breakdown
      const cityMap = new Map<string, number>();
      for (const r of cityData.data || []) {
        cityMap.set(r.city, (cityMap.get(r.city) || 0) + 1);
      }
      // Count bookings per city (through restaurant_id → city lookup)
      const citySorted = Array.from(cityMap.entries())
        .map(([city, count]) => ({ city, count, bookings: 0 }))
        .sort((a, b) => b.count - a.count);
      setCityStats(citySorted);

      setStats({
        newUsers: usersRes.count || 0,
        newRestaurants: restaurantsRes.count || 0,
        totalBookings: bookings.length,
        completedBookings: completed,
        cancelledBookings: cancelled,
        noShowBookings: noShow,
        revenue,
        avgBookingSize: bookings.length > 0 ? +(totalCovers / bookings.length).toFixed(1) : 0,
      });
      setLoading(false);
    }

    fetchAnalytics();
  }, [period, verified]);

  if (!verified || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['7d', '30d', '90d', '365d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                period === p ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === '365d' ? '1 Year' : p.replace('d', ' Days')}
            </button>
          ))}
        </div>
      </div>

      {/* Growth metrics */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="New Users" value={stats.newUsers.toString()} />
        <MetricCard label="New Restaurants" value={stats.newRestaurants.toString()} />
        <MetricCard label="Total Bookings" value={stats.totalBookings.toString()} />
        <MetricCard label="Revenue" value={formatNaira(stats.revenue)} />
      </div>

      {/* Booking outcomes */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Completed" value={stats.completedBookings.toString()} color="text-green-600" />
        <MetricCard label="Cancelled" value={stats.cancelledBookings.toString()} color="text-red-600" />
        <MetricCard label="No Shows" value={stats.noShowBookings.toString()} color="text-orange-600" />
        <MetricCard label="Avg Party Size" value={stats.avgBookingSize.toString()} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Channel mix */}
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h2 className="font-semibold text-gray-900">Booking Channels</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(channelMix)
              .sort(([, a], [, b]) => b - a)
              .map(([channel, count]) => {
                const pct = stats.totalBookings > 0 ? ((count / stats.totalBookings) * 100).toFixed(0) : '0';
                return (
                  <div key={channel}>
                    <div className="flex justify-between text-sm">
                      <span className="capitalize text-gray-700">{channel}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* City breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h2 className="font-semibold text-gray-900">Restaurants by City</h2>
          <div className="mt-4 space-y-3">
            {cityStats.map((c) => {
              const maxCount = cityStats[0]?.count || 1;
              return (
                <div key={c.city}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{c.city.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">{c.count} restaurants</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Retention insight */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Key Insights</h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-700">Completion Rate</p>
            <p className="mt-1 text-2xl font-bold text-green-800">
              {stats.totalBookings > 0
                ? ((stats.completedBookings / stats.totalBookings) * 100).toFixed(1)
                : '0'}%
            </p>
          </div>
          <div className="rounded-lg bg-red-50 p-4">
            <p className="font-medium text-red-700">No-show Rate</p>
            <p className="mt-1 text-2xl font-bold text-red-800">
              {stats.totalBookings > 0
                ? ((stats.noShowBookings / stats.totalBookings) * 100).toFixed(1)
                : '0'}%
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="font-medium text-blue-700">Avg Revenue / Booking</p>
            <p className="mt-1 text-2xl font-bold text-blue-800">
              {stats.totalBookings > 0 ? formatNaira(stats.revenue / stats.totalBookings) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
