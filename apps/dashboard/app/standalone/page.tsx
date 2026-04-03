'use client';

import { useEffect, useState } from 'react';
import { useRestaurant, useDashboard } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { PRICING, formatNaira, formatTime } from '@naijadine/shared';

interface Stats {
  todayBookings: number;
  todayGuests: number;
  monthBookings: number;
  monthLimit: number;
  plan: string;
  todayOrders: number;
  todayOrderRevenue: number;
  monthOrders: number;
  monthOrderRevenue: number;
}

export default function StandaloneOverviewPage() {
  const restaurant = useRestaurant();
  const { userId } = useDashboard();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Record<string, unknown>[]>([]);
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';

    const [todayRes, monthRes, recentRes, todayOrdersRes, monthOrdersRes, recentOrdersRes] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, party_size')
        .eq('restaurant_id', restaurant.id)
        .eq('date', today)
        .not('status', 'eq', 'cancelled'),
      supabase
        .from('reservations')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', `${monthStart}T00:00:00`)
        .eq('channel', 'whatsapp'),
      supabase
        .from('reservations')
        .select('id, reference_code, date, time, party_size, status, guest_name, guest_phone, channel, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('orders')
        .select('id, total')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', `${today}T00:00:00`)
        .not('status', 'in', '(cart,cancelled)'),
      supabase
        .from('orders')
        .select('id, total')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', `${monthStart}T00:00:00`)
        .not('status', 'in', '(cart,cancelled)'),
      supabase
        .from('orders')
        .select('id, reference_code, order_type, status, total, customer_name, customer_phone, created_at')
        .eq('restaurant_id', restaurant.id)
        .not('status', 'eq', 'cart')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const plan = (restaurant as unknown as Record<string, unknown>).whatsapp_plan as string || 'starter';
    const tierKey = plan as keyof typeof PRICING.whatsapp_standalone;
    const tier = PRICING.whatsapp_standalone[tierKey] || PRICING.whatsapp_standalone.starter;

    const todayBookings = todayRes.data || [];
    const todayGuests = todayBookings.reduce((sum, b) => sum + ((b.party_size as number) || 0), 0);
    const todayOrdersList = todayOrdersRes.data || [];
    const monthOrdersList = monthOrdersRes.data || [];

    setStats({
      todayBookings: todayBookings.length,
      todayGuests,
      monthBookings: (monthRes.data || []).length,
      monthLimit: tier.maxBookings,
      plan,
      todayOrders: todayOrdersList.length,
      todayOrderRevenue: todayOrdersList.reduce((sum, o) => sum + ((o.total as number) || 0), 0),
      monthOrders: monthOrdersList.length,
      monthOrderRevenue: monthOrdersList.reduce((sum, o) => sum + ((o.total as number) || 0), 0),
    });
    setRecentBookings((recentRes.data || []) as Record<string, unknown>[]);
    setRecentOrders((recentOrdersRes.data || []) as Record<string, unknown>[]);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  const usagePct = stats ? (stats.monthLimit === Infinity ? 0 : Math.min((stats.monthBookings / stats.monthLimit) * 100, 100)) : 0;
  const isAtLimit = stats ? (stats.monthLimit !== Infinity && stats.monthBookings >= stats.monthLimit) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Dashboard</h1>
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </div>

      {/* Plan & usage banner */}
      <div className={`rounded-xl border p-4 ${isAtLimit ? 'border-red-200 bg-red-50' : 'border-[#25D366]/30 bg-[#25D366]/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">
              Plan: <span className="font-bold capitalize">{stats?.plan}</span>
            </span>
            {stats && stats.monthLimit !== Infinity && (
              <p className="mt-1 text-xs text-gray-500">
                {stats.monthBookings} / {stats.monthLimit} WhatsApp bookings this month
              </p>
            )}
            {stats && stats.monthLimit === Infinity && (
              <p className="mt-1 text-xs text-gray-500">Unlimited WhatsApp bookings</p>
            )}
          </div>
          {stats?.plan === 'starter' && (
            <a
              href="/standalone/settings"
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
            >
              Upgrade to Professional
            </a>
          )}
        </div>
        {stats && stats.monthLimit !== Infinity && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : 'bg-[#25D366]'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        )}
        {isAtLimit && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Monthly booking limit reached. Upgrade to Professional for unlimited bookings.
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Bookings" value={stats?.todayBookings ?? 0} />
        <StatCard label="Today's Guests" value={stats?.todayGuests ?? 0} />
        <StatCard label="Today's Orders" value={stats?.todayOrders ?? 0} />
        <StatCard label="Today's Revenue" value={formatNaira(stats?.todayOrderRevenue ?? 0)} isText />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="WhatsApp Bookings (Month)" value={stats?.monthBookings ?? 0} />
        <StatCard label="Orders (Month)" value={stats?.monthOrders ?? 0} />
        <StatCard label="Order Revenue (Month)" value={formatNaira(stats?.monthOrderRevenue ?? 0)} isText />
        <StatCard
          label="Plan Price"
          value={
            stats?.plan === 'enterprise'
              ? 'Custom'
              : formatNaira(
                  PRICING.whatsapp_standalone[
                    (stats?.plan || 'starter') as keyof typeof PRICING.whatsapp_standalone
                  ].price || 0,
                )
          }
          isText
        />
      </div>

      {/* Recent bookings */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        {recentBookings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No bookings yet. Share your WhatsApp number to start receiving reservations!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ref</th>
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Guests</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.map((b) => (
                  <tr key={b.id as string} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-brand">
                      {b.reference_code as string}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{(b.guest_name as string) || '—'}</p>
                      <p className="text-xs text-gray-400">{(b.guest_phone as string) || ''}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{b.date as string}</td>
                    <td className="px-5 py-3 text-gray-600">{formatTime(b.time as string)}</td>
                    <td className="px-5 py-3 text-gray-600">{b.party_size as number}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.channel === 'whatsapp'
                          ? 'bg-[#25D366]/10 text-[#25D366]'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {(b.channel as string) || 'web'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={b.status as string} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Recent orders */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No orders yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ref</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((o) => (
                  <tr key={o.id as string} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-brand">
                      {o.reference_code as string}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{(o.customer_name as string) || '—'}</p>
                      <p className="text-xs text-gray-400">{(o.customer_phone as string) || ''}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(o.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.order_type === 'delivery'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {o.order_type as string}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {formatNaira((o.total as number) || 0)}
                    </td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={o.status as string} />
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

function StatCard({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-50 text-green-700',
    pending: 'bg-yellow-50 text-yellow-700',
    seated: 'bg-blue-50 text-blue-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-50 text-red-600',
    no_show: 'bg-orange-50 text-orange-600',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_payment: 'bg-yellow-50 text-yellow-700',
    confirmed: 'bg-green-50 text-green-700',
    preparing: 'bg-blue-50 text-blue-700',
    ready: 'bg-purple-50 text-purple-700',
    picked_up: 'bg-gray-100 text-gray-700',
    delivered: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
