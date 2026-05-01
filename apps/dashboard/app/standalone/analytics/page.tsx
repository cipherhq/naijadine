'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@dineroot/shared';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Categories that use reservations (service-based)
const SERVICE_CATEGORIES = new Set([
  'barber', 'salon', 'spa', 'gym', 'car_wash', 'mechanic',
  'hotel', 'clinic', 'tutor', 'photography', 'cleaning', 'coworking',
]);

// Categories that use orders (purchase-based)
const PURCHASE_CATEGORIES = new Set([
  'beauty', 'laundry', 'catering', 'tailor', 'printing',
  'logistics', 'bakery', 'church', 'cinema', 'events', 'shop',
]);

const CHART_COLORS = ['#F04E37', '#D93A24', '#B42E1C', '#F47A69', '#E8A817', '#FACBC3'];

type Period = '7d' | '30d' | '90d';

interface DayData {
  date: string;
  revenue: number;
  count: number;
}

interface ItemData {
  name: string;
  quantity: number;
  revenue: number;
}

interface CustomerData {
  name: string;
  phone: string;
  total: number;
  count: number;
}

interface BreakdownData {
  name: string;
  value: number;
}

interface Stats {
  totalRevenue: number;
  totalCount: number;
  avgValue: number;
  uniqueCustomers: number;
  mostPopularItem: string;
  repeatRate: number;
}

function getDateRange(period: Period): string {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export default function AnalyticsPage() {
  const restaurant = useRestaurant();
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [topItems, setTopItems] = useState<ItemData[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerData[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownData[]>([]);

  const cat = restaurant.business_category || 'restaurant';
  const isService = SERVICE_CATEGORIES.has(cat);
  const isPurchase = PURCHASE_CATEGORIES.has(cat);
  const isBoth = cat === 'restaurant' || (!isService && !isPurchase);

  const activityLabel = isService ? 'Bookings' : 'Orders';
  const itemsLabel = isService ? 'Top Services' : 'Top Products';

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const since = getDateRange(period);

    try {
      if (isService && !isBoth) {
        await loadServiceData(supabase, since);
      } else if (isPurchase && !isBoth) {
        await loadPurchaseData(supabase, since);
      } else {
        await loadBothData(supabase, since);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadServiceData(supabase: ReturnType<typeof createClient>, since: string) {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, date, deposit_amount, guest_name, guest_phone, channel, status, created_at')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', since)
      .not('status', 'eq', 'cancelled')
      .limit(5000);

    const rows = reservations || [];
    processServiceRows(rows);
  }

  async function loadPurchaseData(supabase: ReturnType<typeof createClient>, since: string) {
    const [ordersRes, itemsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total, customer_name, customer_phone, order_type, status, created_at')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
        .not('status', 'eq', 'cancelled')
        .limit(5000),
      supabase
        .from('order_items')
        .select('name, quantity, line_total, order_id, orders!inner(restaurant_id, created_at, status)')
        .eq('orders.restaurant_id', restaurant.id)
        .gte('orders.created_at', since)
        .not('orders.status', 'eq', 'cancelled')
        .limit(5000),
    ]);

    const orders = ordersRes.data || [];
    const items = itemsRes.data || [];
    processPurchaseRows(orders, items);
  }

  async function loadBothData(supabase: ReturnType<typeof createClient>, since: string) {
    const [reservationsRes, ordersRes, itemsRes] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, date, deposit_amount, guest_name, guest_phone, channel, status, created_at')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
        .not('status', 'eq', 'cancelled')
        .limit(5000),
      supabase
        .from('orders')
        .select('id, total, customer_name, customer_phone, order_type, status, created_at')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
        .not('status', 'eq', 'cancelled')
        .limit(5000),
      supabase
        .from('order_items')
        .select('name, quantity, line_total, order_id, orders!inner(restaurant_id, created_at, status)')
        .eq('orders.restaurant_id', restaurant.id)
        .gte('orders.created_at', since)
        .not('orders.status', 'eq', 'cancelled')
        .limit(5000),
    ]);

    const reservations = reservationsRes.data || [];
    const orders = ordersRes.data || [];
    const items = itemsRes.data || [];

    // Combine revenue by day
    const dayMap = new Map<string, { revenue: number; count: number }>();

    for (const r of reservations) {
      const d = (r.created_at as string).split('T')[0];
      const entry = dayMap.get(d) || { revenue: 0, count: 0 };
      entry.revenue += (r.deposit_amount as number) || 0;
      entry.count += 1;
      dayMap.set(d, entry);
    }

    for (const o of orders) {
      const d = (o.created_at as string).split('T')[0];
      const entry = dayMap.get(d) || { revenue: 0, count: 0 };
      entry.revenue += (o.total as number) || 0;
      entry.count += 1;
      dayMap.set(d, entry);
    }

    const daily = Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyData(daily);

    // Total stats
    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalCount = daily.reduce((s, d) => s + d.count, 0);

    // Unique customers
    const phones = new Set<string>();
    const phoneCounts = new Map<string, number>();
    for (const r of reservations) {
      const p = r.guest_phone as string;
      if (p) { phones.add(p); phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1); }
    }
    for (const o of orders) {
      const p = o.customer_phone as string;
      if (p) { phones.add(p); phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1); }
    }
    const repeats = Array.from(phoneCounts.values()).filter(c => c > 1).length;
    const repeatRate = phones.size > 0 ? Math.round((repeats / phones.size) * 100) : 0;

    // Top items from order_items
    const itemMap = new Map<string, { quantity: number; revenue: number }>();
    for (const it of items) {
      const name = it.name as string;
      const entry = itemMap.get(name) || { quantity: 0, revenue: 0 };
      entry.quantity += (it.quantity as number) || 0;
      entry.revenue += (it.line_total as number) || 0;
      itemMap.set(name, entry);
    }
    const topItemsList = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    setTopItems(topItemsList);

    // Top customers (combined)
    const custMap = new Map<string, { name: string; phone: string; total: number; count: number }>();
    for (const r of reservations) {
      const phone = (r.guest_phone as string) || '';
      if (!phone) continue;
      const entry = custMap.get(phone) || { name: (r.guest_name as string) || '', phone, total: 0, count: 0 };
      entry.total += (r.deposit_amount as number) || 0;
      entry.count += 1;
      custMap.set(phone, entry);
    }
    for (const o of orders) {
      const phone = (o.customer_phone as string) || '';
      if (!phone) continue;
      const entry = custMap.get(phone) || { name: (o.customer_name as string) || '', phone, total: 0, count: 0 };
      entry.total += (o.total as number) || 0;
      entry.count += 1;
      custMap.set(phone, entry);
    }
    setTopCustomers(
      Array.from(custMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
    );

    // Breakdown: channel from reservations + order_type from orders
    const breakdownMap = new Map<string, number>();
    for (const r of reservations) {
      const ch = (r.channel as string) || 'other';
      breakdownMap.set(ch, (breakdownMap.get(ch) || 0) + 1);
    }
    for (const o of orders) {
      const typ = (o.order_type as string) || 'other';
      breakdownMap.set(typ, (breakdownMap.get(typ) || 0) + 1);
    }
    setBreakdown(
      Array.from(breakdownMap.entries()).map(([name, value]) => ({ name, value }))
    );

    setStats({
      totalRevenue,
      totalCount,
      avgValue: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
      uniqueCustomers: phones.size,
      mostPopularItem: topItemsList[0]?.name || 'N/A',
      repeatRate,
    });
  }

  function processServiceRows(rows: Record<string, unknown>[]) {
    const dayMap = new Map<string, { revenue: number; count: number }>();
    const phones = new Set<string>();
    const phoneCounts = new Map<string, number>();
    const custMap = new Map<string, { name: string; phone: string; total: number; count: number }>();
    const channelMap = new Map<string, number>();

    for (const r of rows) {
      const d = (r.created_at as string).split('T')[0];
      const entry = dayMap.get(d) || { revenue: 0, count: 0 };
      entry.revenue += (r.deposit_amount as number) || 0;
      entry.count += 1;
      dayMap.set(d, entry);

      const phone = (r.guest_phone as string) || '';
      if (phone) {
        phones.add(phone);
        phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
        const cEntry = custMap.get(phone) || { name: (r.guest_name as string) || '', phone, total: 0, count: 0 };
        cEntry.total += (r.deposit_amount as number) || 0;
        cEntry.count += 1;
        custMap.set(phone, cEntry);
      }

      const ch = (r.channel as string) || 'other';
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
    }

    const daily = Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyData(daily);
    setTopItems([]);
    setTopCustomers(
      Array.from(custMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
    );
    setBreakdown(
      Array.from(channelMap.entries()).map(([name, value]) => ({ name, value }))
    );

    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalCount = daily.reduce((s, d) => s + d.count, 0);
    const repeats = Array.from(phoneCounts.values()).filter(c => c > 1).length;

    setStats({
      totalRevenue,
      totalCount,
      avgValue: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
      uniqueCustomers: phones.size,
      mostPopularItem: 'N/A',
      repeatRate: phones.size > 0 ? Math.round((repeats / phones.size) * 100) : 0,
    });
  }

  function processPurchaseRows(orders: Record<string, unknown>[], items: Record<string, unknown>[]) {
    const dayMap = new Map<string, { revenue: number; count: number }>();
    const phones = new Set<string>();
    const phoneCounts = new Map<string, number>();
    const custMap = new Map<string, { name: string; phone: string; total: number; count: number }>();
    const typeMap = new Map<string, number>();

    for (const o of orders) {
      const d = (o.created_at as string).split('T')[0];
      const entry = dayMap.get(d) || { revenue: 0, count: 0 };
      entry.revenue += (o.total as number) || 0;
      entry.count += 1;
      dayMap.set(d, entry);

      const phone = (o.customer_phone as string) || '';
      if (phone) {
        phones.add(phone);
        phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
        const cEntry = custMap.get(phone) || { name: (o.customer_name as string) || '', phone, total: 0, count: 0 };
        cEntry.total += (o.total as number) || 0;
        cEntry.count += 1;
        custMap.set(phone, cEntry);
      }

      const typ = (o.order_type as string) || 'other';
      typeMap.set(typ, (typeMap.get(typ) || 0) + 1);
    }

    const daily = Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyData(daily);

    // Top items
    const itemMap = new Map<string, { quantity: number; revenue: number }>();
    for (const it of items) {
      const name = it.name as string;
      const entry = itemMap.get(name) || { quantity: 0, revenue: 0 };
      entry.quantity += (it.quantity as number) || 0;
      entry.revenue += (it.line_total as number) || 0;
      itemMap.set(name, entry);
    }
    const topItemsList = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    setTopItems(topItemsList);

    setTopCustomers(
      Array.from(custMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
    );
    setBreakdown(
      Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }))
    );

    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalCount = daily.reduce((s, d) => s + d.count, 0);
    const repeats = Array.from(phoneCounts.values()).filter(c => c > 1).length;

    setStats({
      totalRevenue,
      totalCount,
      avgValue: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
      uniqueCustomers: phones.size,
      mostPopularItem: topItemsList[0]?.name || 'N/A',
      repeatRate: phones.size > 0 ? Math.round((repeats / phones.size) * 100) : 0,
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Period Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Track your business performance</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                period === p
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Total Revenue" value={formatNaira(stats.totalRevenue)} isText />
          <StatCard label={`Total ${activityLabel}`} value={stats.totalCount} />
          <StatCard label="Average Value" value={formatNaira(stats.avgValue)} isText />
          <StatCard label="Unique Customers" value={stats.uniqueCustomers} />
          <StatCard label="Most Popular Item" value={stats.mostPopularItem} isText />
          <StatCard label="Repeat Customer Rate" value={`${stats.repeatRate}%`} isText />
        </div>
      )}

      {/* Revenue Trend */}
      {dailyData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Revenue Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [formatNaira(value), 'Revenue']}
                  labelFormatter={formatDate}
                />
                <Line type="monotone" dataKey="revenue" stroke="#F04E37" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity by Day */}
      {dailyData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{activityLabel} by Day</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [value, activityLabel]}
                  labelFormatter={formatDate}
                />
                <Bar dataKey="count" fill="#D93A24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two-column: Pie Chart + Top Items Bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel / Type Breakdown */}
        {breakdown.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              {isService ? 'Booking Channel' : 'Order Type'} Breakdown
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Items Horizontal Bar */}
        {topItems.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">{itemsLabel}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [formatNaira(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#F04E37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top Products/Services Table */}
      {topItems.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{itemsLabel}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Qty Sold</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topItems.map((item, i) => (
                  <tr key={item.name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNaira(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Customers Table */}
      {topCustomers.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Top Customers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Visits</th>
                  <th className="px-4 py-3 text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topCustomers.map((cust, i) => (
                  <tr key={cust.phone} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{cust.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-600">{cust.phone}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cust.count}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNaira(cust.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!stats || stats.totalCount === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No data for the selected period. {activityLabel} will appear here once you have activity.
        </div>
      ) : null}
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
