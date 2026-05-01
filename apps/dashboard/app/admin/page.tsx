'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@dineroot/shared';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface PlatformStats {
  totalRestaurants: number;
  activeRestaurants: number;
  pendingApprovals: number;
  totalUsers: number;
  totalBookings: number;
  monthBookings: number;
  totalRevenue: number;
  monthRevenue: number;
}

export default function AdminDashboard() {
  const { verified } = useAdminGuard();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<
    { id: string; reference_code: string; guest_name: string; date: string; status: string; restaurant_name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!verified) return;
    async function fetchStats() {
      const supabase = createClient();
      const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

      const [restaurants, pendingRes, users, bookings, monthBookings, payments, monthPayments, recent, pendingClaims, cityBreakdown] =
        await Promise.all([
          supabase.from('restaurants').select('id, status', { count: 'exact', head: false }),
          supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('reservations').select('id', { count: 'exact', head: true }),
          supabase.from('reservations').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
          supabase.from('payments').select('amount').eq('status', 'successful'),
          supabase.from('payments').select('amount').eq('status', 'successful').gte('created_at', monthStart),
          supabase
            .from('reservations')
            .select('id, reference_code, guest_name, date, status, restaurants (name)')
            .order('created_at', { ascending: false })
            .limit(10),
          supabase.from('restaurant_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('restaurants').select('city').in('status', ['active', 'approved']),
        ]);

      const active = (restaurants.data || []).filter((r) => ['active', 'approved'].includes(r.status)).length;
      const totalRevenue = (payments.data || []).reduce((s, p) => s + (p.amount || 0), 0);
      const mRevenue = (monthPayments.data || []).reduce((s, p) => s + (p.amount || 0), 0);

      setStats({
        totalRestaurants: restaurants.count || 0,
        activeRestaurants: active,
        pendingApprovals: pendingRes.count || 0,
        totalUsers: users.count || 0,
        totalBookings: bookings.count || 0,
        monthBookings: monthBookings.count || 0,
        totalRevenue,
        monthRevenue: mRevenue,
      });

      setRecentBookings(
        (recent.data || []).map((r) => {
          const restRaw = r.restaurants as unknown;
          const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name: string } | null;
          return {
            id: r.id,
            reference_code: r.reference_code,
            guest_name: r.guest_name || '—',
            date: r.date,
            status: r.status,
            restaurant_name: rest?.name || '—',
          };
        }),
      );

      setLoading(false);
    }

    fetchStats();
  }, [verified]);

  if (!verified || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const s = stats!;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
      <p className="mt-1 text-sm text-gray-500">DineRoot admin dashboard</p>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Total Restaurants" value={s.totalRestaurants.toString()} sub={`${s.activeRestaurants} active`} />
        <KPI label="Pending Approvals" value={s.pendingApprovals.toString()} sub="need review" warn={s.pendingApprovals > 0} />
        <KPI label="Total Users" value={s.totalUsers.toString()} sub="diners + owners" />
        <KPI label="Total Bookings" value={s.totalBookings.toString()} sub={`${s.monthBookings} this month`} />
        <KPI label="Total Revenue" value={formatNaira(s.totalRevenue)} sub="all time deposits" />
        <KPI label="This Month" value={formatNaira(s.monthRevenue)} sub="deposits collected" />
        <KPI
          label="Platform Fee (10%)"
          value={formatNaira(s.totalRevenue * 0.1)}
          sub="commission earned"
        />
        <KPI
          label="Avg per Booking"
          value={s.totalBookings > 0 ? formatNaira(s.totalRevenue / s.totalBookings) : '—'}
          sub="deposit amount"
        />
      </div>

      {/* Recent bookings */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Restaurant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentBookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.reference_code}</td>
                  <td className="px-4 py-3 text-gray-900">{b.guest_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.restaurant_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
