'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@naijadine/shared';

interface DayStats {
  date: string;
  bookings: number;
  covers: number;
  revenue: number;
}

export default function AnalyticsPage() {
  const restaurant = useRestaurant();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<Record<string, number>>({});
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState({
    bookings: 0,
    covers: 0,
    revenue: 0,
    avgParty: 0,
    noShowRate: 0,
    cancelRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      const supabase = createClient();
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startStr = startDate.toISOString().split('T')[0];

      const { data: reservations } = await supabase
        .from('reservations')
        .select('date, party_size, status, channel, deposit_amount')
        .eq('restaurant_id', restaurant.id)
        .gte('date', startStr);

      if (!reservations) {
        setLoading(false);
        return;
      }

      // Daily aggregation
      const dayMap = new Map<string, DayStats>();
      const channels: Record<string, number> = {};
      const statuses: Record<string, number> = {};
      let totalCovers = 0;
      let totalRevenue = 0;
      let noShows = 0;
      let cancels = 0;

      for (const r of reservations) {
        // Daily
        const existing = dayMap.get(r.date) || { date: r.date, bookings: 0, covers: 0, revenue: 0 };
        existing.bookings++;
        existing.covers += r.party_size;
        existing.revenue += r.deposit_amount || 0;
        dayMap.set(r.date, existing);

        // Channels
        const ch = r.channel || 'web';
        channels[ch] = (channels[ch] || 0) + 1;

        // Statuses
        statuses[r.status] = (statuses[r.status] || 0) + 1;

        totalCovers += r.party_size;
        totalRevenue += r.deposit_amount || 0;
        if (r.status === 'no_show') noShows++;
        if (r.status === 'cancelled') cancels++;
      }

      const sorted = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setDailyStats(sorted);
      setChannelBreakdown(channels);
      setStatusBreakdown(statuses);
      setTotals({
        bookings: reservations.length,
        covers: totalCovers,
        revenue: totalRevenue,
        avgParty: reservations.length > 0 ? +(totalCovers / reservations.length).toFixed(1) : 0,
        noShowRate: reservations.length > 0 ? +((noShows / reservations.length) * 100).toFixed(1) : 0,
        cancelRate: reservations.length > 0 ? +((cancels / reservations.length) * 100).toFixed(1) : 0,
      });
      setLoading(false);
    }

    fetchAnalytics();
  }, [restaurant.id, period]);

  const maxCovers = Math.max(...dailyStats.map((d) => d.covers), 1);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                period === p ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Total Bookings" value={totals.bookings.toString()} />
            <SummaryCard label="Total Covers" value={totals.covers.toString()} />
            <SummaryCard label="Deposit Revenue" value={formatNaira(totals.revenue)} />
            <SummaryCard label="Avg Party Size" value={totals.avgParty.toString()} />
            <SummaryCard
              label="No-show Rate"
              value={`${totals.noShowRate}%`}
              warn={totals.noShowRate > 15}
            />
            <SummaryCard
              label="Cancel Rate"
              value={`${totals.cancelRate}%`}
              warn={totals.cancelRate > 20}
            />
          </div>

          {/* Covers chart (CSS bar chart) */}
          <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Daily Covers</h2>
            <div className="mt-4 flex items-end gap-1" style={{ height: 160 }}>
              {dailyStats.map((d) => (
                <div
                  key={d.date}
                  className="group relative flex-1"
                  style={{ height: '100%' }}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-brand transition-all hover:bg-brand-500"
                    style={{ height: `${(d.covers / maxCovers) * 100}%`, minHeight: d.covers > 0 ? 4 : 0 }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap">
                    {d.date.slice(5)}: {d.covers} covers
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
              <span>{dailyStats[0]?.date.slice(5)}</span>
              <span>{dailyStats[dailyStats.length - 1]?.date.slice(5)}</span>
            </div>
          </div>

          {/* Channel + Status breakdown */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Channel mix */}
            <div className="rounded-xl border border-gray-100 bg-white p-6">
              <h2 className="font-semibold text-gray-900">Booking Channels</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(channelBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([channel, count]) => {
                    const pct = ((count / totals.bookings) * 100).toFixed(0);
                    return (
                      <div key={channel}>
                        <div className="flex justify-between text-sm">
                          <span className="capitalize text-gray-700">{channel}</span>
                          <span className="text-gray-500">{count} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Status breakdown */}
            <div className="rounded-xl border border-gray-100 bg-white p-6">
              <h2 className="font-semibold text-gray-900">Status Breakdown</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(statusBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const pct = ((count / totals.bookings) * 100).toFixed(0);
                    const barColor = status === 'completed'
                      ? 'bg-green-500'
                      : status === 'cancelled' || status === 'no_show'
                        ? 'bg-red-400'
                        : 'bg-blue-400';
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm">
                          <span className="capitalize text-gray-700">{status.replace('_', ' ')}</span>
                          <span className="text-gray-500">{count} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
