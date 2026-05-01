'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatTime, WHATSAPP_BOT } from '@dineroot/shared';

interface Reservation {
  id: string;
  reference_code: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  channel: string;
  special_requests: string | null;
  deposit_amount: number;
  deposit_status: string;
  created_at: string;
  confirmed_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  booking_type: string | null;
}

const statuses = ['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  seated: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
};

const nextActions: Record<string, { label: string; next: string; color: string }[]> = {
  pending: [
    { label: 'Confirm', next: 'confirmed', color: 'text-green-600 hover:bg-green-50' },
    { label: 'Cancel', next: 'cancelled', color: 'text-red-600 hover:bg-red-50' },
  ],
  confirmed: [
    { label: 'Seat', next: 'seated', color: 'text-blue-600 hover:bg-blue-50' },
    { label: 'No Show', next: 'no_show', color: 'text-red-600 hover:bg-red-50' },
    { label: 'Cancel', next: 'cancelled', color: 'text-red-600 hover:bg-red-50' },
  ],
  seated: [
    { label: 'Complete', next: 'completed', color: 'text-gray-600 hover:bg-gray-50' },
  ],
};

export default function WhatsAppBookingsPage() {
  const restaurant = useRestaurant();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchReservations = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('reservations')
      .select('id, reference_code, date, time, party_size, status, guest_name, guest_phone, guest_email, channel, special_requests, deposit_amount, deposit_status, created_at, confirmed_at, seated_at, completed_at, cancelled_at, booking_type')
      .eq('restaurant_id', restaurant.id)
      .eq('channel', 'whatsapp')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    if (dateFilter) {
      query = query.eq('date', dateFilter);
    }

    const { data } = await query;
    let results = data || [];

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (r) =>
          r.guest_name?.toLowerCase().includes(q) ||
          r.guest_phone?.includes(q) ||
          r.reference_code?.toLowerCase().includes(q),
      );
    }

    setReservations(results as Reservation[]);
    setLoading(false);
  }, [restaurant.id, filter, dateFilter, search]);

  useEffect(() => {
    fetchReservations();

    const supabase = createClient();
    const channel = supabase
      .channel('whatsapp-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => fetchReservations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations, restaurant.id]);

  async function updateStatus(id: string, newStatus: string) {
    const supabase = createClient();
    const extra: Record<string, unknown> = {};
    if (newStatus === 'confirmed') extra.confirmed_at = new Date().toISOString();
    if (newStatus === 'seated') extra.seated_at = new Date().toISOString();
    if (newStatus === 'completed') extra.completed_at = new Date().toISOString();
    if (newStatus === 'cancelled') extra.cancelled_at = new Date().toISOString();

    await supabase
      .from('reservations')
      .update({ status: newStatus, ...extra })
      .eq('id', id);
    fetchReservations();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reservations received via{' '}
            <span className="font-medium text-[#25D366]">{WHATSAPP_BOT.name}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                filter === s
                  ? 'bg-[#25D366] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#25D366]"
        />
        <input
          type="text"
          placeholder="Search name, phone, ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#25D366]"
        />
        {(dateFilter || search) && (
          <button
            onClick={() => { setDateFilter(''); setSearch(''); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#25D366] border-t-transparent" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <p className="mt-3 text-sm text-gray-400">No WhatsApp bookings yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Bookings from your DineRoot WhatsApp WhatsApp bot will appear here
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Party</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.guest_name || '\u2014'}</p>
                    <p className="text-xs text-gray-400">{r.guest_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.date + 'T00:00').toLocaleDateString('en-NG', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    at {formatTime(r.time)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.party_size}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.reference_code}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(nextActions[r.status] || []).map((action) => (
                        <button
                          key={action.next}
                          onClick={() => updateStatus(r.id, action.next)}
                          className={`rounded px-2 py-1 text-xs font-medium ${action.color}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
