'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Guest {
  name: string;
  phone: string;
  visitCount: number;
  lastVisit: string;
  totalGuests: number;
  noShowCount: number;
  tags: string[];
}

export default function StandaloneGuestsPage() {
  const restaurant = useRestaurant();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    const supabase = createClient();
    const { data: reservations } = await supabase
      .from('reservations')
      .select('guest_name, guest_phone, date, party_size, status')
      .eq('restaurant_id', restaurant.id)
      .not('guest_phone', 'is', null)
      .order('date', { ascending: false });

    if (!reservations) {
      setLoading(false);
      return;
    }

    // Aggregate by phone number
    const guestMap = new Map<string, Guest>();
    for (const r of reservations) {
      const phone = r.guest_phone as string;
      if (!phone) continue;

      const existing = guestMap.get(phone);
      if (existing) {
        existing.visitCount++;
        existing.totalGuests += (r.party_size as number) || 0;
        if (r.status === 'no_show') existing.noShowCount++;
        if (r.date > existing.lastVisit) existing.lastVisit = r.date as string;
      } else {
        guestMap.set(phone, {
          name: (r.guest_name as string) || 'Unknown',
          phone,
          visitCount: 1,
          lastVisit: r.date as string,
          totalGuests: (r.party_size as number) || 0,
          noShowCount: r.status === 'no_show' ? 1 : 0,
          tags: [],
        });
      }
    }

    // Add tags
    const guestList = Array.from(guestMap.values()).map((g) => {
      const tags: string[] = [];
      if (g.visitCount >= 10) tags.push('VIP');
      else if (g.visitCount >= 5) tags.push('Regular');
      if (g.noShowCount >= 2) tags.push('No-show risk');
      if (g.totalGuests / g.visitCount >= 6) tags.push('Large party');
      g.tags = tags;
      return g;
    });

    guestList.sort((a, b) => b.visitCount - a.visitCount);
    setGuests(guestList);
    setLoading(false);
  }

  const filtered = search
    ? guests.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.phone.includes(search),
      )
    : guests;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
          <p className="text-sm text-gray-500">{guests.length} unique guests</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-gray-200 px-4 py-2 text-sm"
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400">
          No guests found.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Visits</th>
                  <th className="px-5 py-3 font-medium">Avg Party</th>
                  <th className="px-5 py-3 font-medium">Last Visit</th>
                  <th className="px-5 py-3 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((g) => (
                  <tr key={g.phone} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-5 py-3 text-gray-600">{g.phone}</td>
                    <td className="px-5 py-3 text-gray-600">{g.visitCount}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {(g.totalGuests / g.visitCount).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{g.lastVisit}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              tag === 'VIP'
                                ? 'bg-purple-50 text-purple-700'
                                : tag === 'Regular'
                                  ? 'bg-blue-50 text-blue-700'
                                  : tag === 'No-show risk'
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
