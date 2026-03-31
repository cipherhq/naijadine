'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRestaurant } from '@/components/DashboardProvider';

interface WaitlistEntry {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  estimated_wait_minutes: number | null;
  status: string;
  notified_at: string | null;
  seated_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  notified: 'bg-blue-100 text-blue-800',
  seated: 'bg-green-100 text-green-800',
  left: 'bg-gray-100 text-gray-600',
};

export default function WaitlistPage() {
  const restaurant = useRestaurant();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    loadEntries();

    const supabase = createClient();
    const channel = supabase
      .channel('waitlist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries', filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        loadEntries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant.id]);

  async function loadEntries() {
    const supabase = createClient();
    let query = supabase
      .from('waitlist_entries')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: true });

    if (filter === 'active') {
      query = query.in('status', ['waiting', 'notified']);
    }

    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    loadEntries();
  }, [filter]);

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === 'notified') updates.notified_at = new Date().toISOString();
    if (status === 'seated') updates.seated_at = new Date().toISOString();

    await supabase.from('waitlist_entries').update(updates).eq('id', id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } as WaitlistEntry : e));
  }

  async function updateWait(id: string, minutes: number) {
    const supabase = createClient();
    await supabase.from('waitlist_entries').update({ estimated_wait_minutes: minutes }).eq('id', id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, estimated_wait_minutes: minutes } : e));
  }

  function timeSince(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }

  const activeCount = entries.filter((e) => ['waiting', 'notified'].includes(e.status)).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeCount} {activeCount === 1 ? 'guest' : 'guests'} waiting
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('active')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              filter === 'active' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              filter === 'all' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="mt-2 text-sm">No one on the waitlist</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="rounded-xl border border-gray-100 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{entry.guest_name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>{entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}</span>
                      <span>{timeSince(entry.created_at)}</span>
                      {entry.guest_phone && <span>{entry.guest_phone}</span>}
                    </div>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[entry.status] || 'bg-gray-100'}`}>
                  {entry.status}
                </span>
              </div>

              {/* Est. wait time */}
              {['waiting', 'notified'].includes(entry.status) && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Est. wait:</span>
                  <div className="flex gap-1">
                    {[10, 15, 20, 30, 45, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => updateWait(entry.id, m)}
                        className={`rounded px-2 py-0.5 text-xs ${
                          entry.estimated_wait_minutes === m
                            ? 'bg-brand text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {entry.status !== 'seated' && entry.status !== 'left' && (
                <div className="mt-3 flex gap-2">
                  {entry.status === 'waiting' && (
                    <button
                      onClick={() => updateStatus(entry.id, 'notified')}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Notify Guest
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(entry.id, 'seated')}
                    className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    Seat Guest
                  </button>
                  <button
                    onClick={() => updateStatus(entry.id, 'left')}
                    className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Mark Left
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
