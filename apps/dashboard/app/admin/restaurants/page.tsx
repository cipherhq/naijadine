'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  city: string;
  neighborhood: string;
  status: string;
  product_type: string;
  avg_rating: number;
  total_reviews: number;
  owner_email: string;
  created_at: string;
}

const statusOptions = ['all', 'active', 'approved', 'pending_review', 'suspended', 'rejected'];

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchRestaurants = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood, status, product_type, avg_rating, total_reviews, created_at, profiles:owner_id (email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;

    let results = (data || []).map((r) => {
      const profileRaw = r.profiles as unknown;
      const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        city: r.city,
        neighborhood: r.neighborhood,
        status: r.status,
        product_type: r.product_type,
        avg_rating: r.avg_rating,
        total_reviews: r.total_reviews,
        owner_email: profile?.email || '—',
        created_at: r.created_at,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.owner_email.toLowerCase().includes(q) ||
          r.slug.includes(q),
      );
    }

    setRestaurants(results);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from('restaurants').update({ status }).eq('id', id);
    fetchRestaurants();
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    pending_review: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
      <p className="mt-1 text-sm text-gray-500">{restaurants.length} restaurants</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name, city, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                statusFilter === s ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Restaurant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Rating</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {restaurants.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.neighborhood}, {r.city.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-500">{r.product_type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.avg_rating > 0 ? `${r.avg_rating.toFixed(1)} (${r.total_reviews})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.owner_email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="approved">Approved</option>
                      <option value="pending_review">Pending</option>
                      <option value="suspended">Suspended</option>
                      <option value="rejected">Rejected</option>
                    </select>
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
