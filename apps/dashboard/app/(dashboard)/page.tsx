'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@naijadine/shared';

interface Reservation {
  id: string;
  reference_code: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
  guest_name: string;
  guest_phone: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  seated: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
};

export default function DashboardOverview() {
  const restaurant = useRestaurant();
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayGuests: 0,
    monthRevenue: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;

    async function fetchData() {
      // Today's reservations
      const { data: todayRes } = await supabase
        .from('reservations')
        .select('id, party_size, status')
        .eq('restaurant_id', restaurant.id)
        .eq('date', today)
        .not('status', 'eq', 'cancelled');

      const todayBookings = todayRes?.length || 0;
      const todayGuests = todayRes?.reduce((sum, r) => sum + r.party_size, 0) || 0;

      // Pending reservations
      const pendingCount = todayRes?.filter((r) => r.status === 'pending').length || 0;

      // Month revenue from deposits
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'successful')
        .gte('created_at', monthStart);

      const monthRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      setStats({ todayBookings, todayGuests, monthRevenue, pendingCount });

      // Upcoming reservations
      const { data: upcomingRes } = await supabase
        .from('reservations')
        .select('id, reference_code, date, time, party_size, status, guest_name, guest_phone, created_at')
        .eq('restaurant_id', restaurant.id)
        .gte('date', today)
        .not('status', 'in', '("cancelled","no_show")')
        .order('date')
        .order('time')
        .limit(8);

      setUpcoming(upcomingRes || []);
      setLoading(false);
    }

    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('dashboard-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {restaurant.name}
          </p>
        </div>
        <Link
          href="/reservations"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          View All Bookings
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Bookings"
          value={stats.todayBookings.toString()}
          sub="reservations"
          color="brand"
        />
        <StatCard
          label="Expected Guests"
          value={stats.todayGuests.toString()}
          sub="covers today"
          color="blue"
        />
        <StatCard
          label="Month Revenue"
          value={formatNaira(stats.monthRevenue)}
          sub="deposits collected"
          color="gold"
        />
        <StatCard
          label="Pending"
          value={stats.pendingCount.toString()}
          sub="need confirmation"
          color="yellow"
        />
      </div>

      {/* Quick info */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Average Rating</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {restaurant.avg_rating > 0 ? restaurant.avg_rating.toFixed(1) : '—'}
            </span>
            {restaurant.avg_rating > 0 && (
              <svg className="h-5 w-5 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
            <span className="text-sm text-gray-400">({restaurant.total_reviews} reviews)</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Status</p>
          <p className="mt-1 text-2xl font-bold capitalize text-green-600">
            {restaurant.status}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Deposit / Guest</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {restaurant.deposit_per_guest > 0
              ? formatNaira(restaurant.deposit_per_guest)
              : 'None'}
          </p>
        </div>
      </div>

      {/* Upcoming Reservations */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          Upcoming Reservations
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">No upcoming reservations</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Guest</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Party</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upcoming.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.guest_name || '—'}</p>
                      <p className="text-xs text-gray-400">{r.guest_phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(r.date + 'T00:00').toLocaleDateString('en-NG', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      at {r.time}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.party_size}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {r.reference_code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    brand: 'bg-brand-50',
    blue: 'bg-blue-50',
    gold: 'bg-gold-50',
    yellow: 'bg-yellow-50',
  };
  const iconMap: Record<string, string> = {
    brand: 'text-brand',
    blue: 'text-blue-600',
    gold: 'text-gold',
    yellow: 'text-yellow-600',
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgMap[color]}`}>
          <span className={`text-lg font-bold ${iconMap[color]}`}>
            {label.charAt(0)}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}
