'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatTime } from '@naijadine/shared';

interface Guest {
  user_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  visit_count: number;
  last_visit: string;
  total_guests: number;
  no_show_count: number;
  tags: string[];
}

export default function GuestsPage() {
  const restaurant = useRestaurant();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestHistory, setGuestHistory] = useState<
    { id: string; date: string; time: string; party_size: number; status: string }[]
  >([]);

  useEffect(() => {
    async function fetchGuests() {
      const supabase = createClient();
      // Get all reservations and group by guest
      const { data } = await supabase
        .from('reservations')
        .select('user_id, guest_name, guest_phone, guest_email, date, party_size, status')
        .eq('restaurant_id', restaurant.id)
        .order('date', { ascending: false });

      if (!data) {
        setLoading(false);
        return;
      }

      // Group by guest (user_id or phone fallback)
      const guestMap = new Map<string, Guest>();
      for (const r of data) {
        const key = r.user_id || r.guest_phone || r.guest_email || 'unknown';
        const existing = guestMap.get(key);
        if (existing) {
          existing.visit_count++;
          existing.total_guests += r.party_size;
          if (r.status === 'no_show') existing.no_show_count++;
          if (r.date > existing.last_visit) {
            existing.last_visit = r.date;
            existing.guest_name = r.guest_name || existing.guest_name;
          }
        } else {
          guestMap.set(key, {
            user_id: key,
            guest_name: r.guest_name || '—',
            guest_phone: r.guest_phone || '',
            guest_email: r.guest_email || '',
            visit_count: 1,
            last_visit: r.date,
            total_guests: r.party_size,
            no_show_count: r.status === 'no_show' ? 1 : 0,
            tags: [],
          });
        }
      }

      // Tag guests
      for (const guest of guestMap.values()) {
        if (guest.visit_count >= 10) guest.tags.push('VIP');
        else if (guest.visit_count >= 5) guest.tags.push('Regular');
        if (guest.no_show_count >= 2) guest.tags.push('No-show risk');
        if (guest.total_guests / guest.visit_count >= 6) guest.tags.push('Large party');
      }

      const sorted = Array.from(guestMap.values()).sort(
        (a, b) => b.visit_count - a.visit_count,
      );
      setGuests(sorted);
      setLoading(false);
    }

    fetchGuests();
  }, [restaurant.id]);

  async function viewHistory(guest: Guest) {
    setSelectedGuest(guest);
    const supabase = createClient();

    let query = supabase
      .from('reservations')
      .select('id, date, time, party_size, status')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: false })
      .limit(20);

    if (guest.user_id && !guest.user_id.includes('@') && guest.user_id !== 'unknown') {
      query = query.eq('user_id', guest.user_id);
    } else if (guest.guest_phone) {
      query = query.eq('guest_phone', guest.guest_phone);
    } else {
      query = query.eq('guest_email', guest.guest_email);
    }

    const { data } = await query;
    setGuestHistory(data || []);
  }

  const filtered = search
    ? guests.filter(
        (g) =>
          g.guest_name.toLowerCase().includes(search.toLowerCase()) ||
          g.guest_phone.includes(search) ||
          g.guest_email.toLowerCase().includes(search.toLowerCase()),
      )
    : guests;

  const tagColors: Record<string, string> = {
    VIP: 'bg-gold-100 text-gold-700',
    Regular: 'bg-brand-50 text-brand',
    'No-show risk': 'bg-red-100 text-red-700',
    'Large party': 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Directory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {guests.length} unique guests
          </p>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No guests found</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Visits</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Visit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tags</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((g) => (
                <tr key={g.user_id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-medium text-brand">
                        {g.guest_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{g.guest_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600">{g.guest_phone}</p>
                    <p className="text-xs text-gray-400">{g.guest_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.visit_count}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(g.last_visit + 'T00:00').toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {g.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewHistory(g)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Guest history modal */}
      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedGuest.guest_name}
              </h3>
              <button
                onClick={() => setSelectedGuest(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {selectedGuest.visit_count} visits &middot; {selectedGuest.total_guests} total covers
            </p>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {guestHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(h.date + 'T00:00').toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTime(h.time)} &middot; {h.party_size} guests
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
