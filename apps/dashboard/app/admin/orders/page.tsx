'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { formatNaira } from '@naijadine/shared';

type Tab = 'reservations' | 'food_orders';

interface Reservation {
  id: string;
  reference: string;
  guest_name: string;
  restaurant_name: string;
  date: string;
  time: string;
  party_size: number;
  channel: string;
  status: string;
  created_at: string;
}

interface FoodOrder {
  id: string;
  reference: string;
  customer_name: string;
  restaurant_name: string;
  order_type: string;
  total: number;
  status: string;
  created_at: string;
}

const RESERVATION_STATUSES = ['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
const ORDER_STATUSES = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];

export default function AdminOrdersPage() {
  const { verified } = useAdminGuard();
  const [tab, setTab] = useState<Tab>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('reservations')
      .select('id, reference, guest_name, date, time, party_size, channel, status, created_at, restaurants (name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data } = await query;

    let results = (data || []).map((r) => {
      const rest = r.restaurants as unknown as { name: string } | null;
      return {
        id: r.id,
        reference: r.reference || '—',
        guest_name: r.guest_name || '—',
        restaurant_name: rest?.name || '—',
        date: r.date,
        time: r.time || '—',
        party_size: r.party_size,
        channel: r.channel || 'web',
        status: r.status,
        created_at: r.created_at,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.guest_name.toLowerCase().includes(q) ||
          r.restaurant_name.toLowerCase().includes(q),
      );
    }

    setReservations(results);
    setLoading(false);
  }, [statusFilter, search, dateFrom, dateTo]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('orders')
      .select('id, reference, customer_name, order_type, total, status, created_at, restaurants (name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;

    let results = (data || []).map((o) => {
      const rest = o.restaurants as unknown as { name: string } | null;
      return {
        id: o.id,
        reference: o.reference || '—',
        customer_name: o.customer_name || '—',
        restaurant_name: rest?.name || '—',
        order_type: o.order_type || 'delivery',
        total: o.total || 0,
        status: o.status,
        created_at: o.created_at,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) =>
          o.reference.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.restaurant_name.toLowerCase().includes(q),
      );
    }

    setFoodOrders(results);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    if (!verified) return;
    setStatusFilter('all');
    setSearch('');
  }, [tab, verified]);

  useEffect(() => {
    if (!verified) return;
    if (tab === 'reservations') fetchReservations();
    else fetchOrders();
  }, [tab, verified, fetchReservations, fetchOrders]);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-700',
    seated: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-200 text-gray-600',
    preparing: 'bg-orange-100 text-orange-700',
    ready: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-green-100 text-green-700',
  };

  const statusPills = tab === 'reservations' ? RESERVATION_STATUSES : ORDER_STATUSES;

  if (!verified) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      <p className="mt-1 text-sm text-gray-500">
        {tab === 'reservations' ? `${reservations.length} reservations` : `${foodOrders.length} food orders`}
      </p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['reservations', 'food_orders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'reservations' ? 'Reservations' : 'Food Orders'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search ref, name, restaurant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {tab === 'reservations' && (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            />
          </>
        )}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1">
          {statusPills.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                statusFilter === s ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : tab === 'reservations' ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Restaurant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Party</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.reference}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.guest_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.restaurant_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.date}</td>
                  <td className="px-4 py-3 text-gray-600">{r.time}</td>
                  <td className="px-4 py-3 text-gray-600">{r.party_size}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600">
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    No reservations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Restaurant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {foodOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.reference}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{o.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{o.restaurant_name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600">
                      {o.order_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatNaira(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(o.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
              {foodOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No food orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
