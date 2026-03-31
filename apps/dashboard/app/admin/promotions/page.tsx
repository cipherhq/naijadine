'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  restaurant_name: string;
  created_at: string;
}

export default function PromotionsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'expired' | 'all'>('active');

  async function fetchDeals() {
    setLoading(true);
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('deals')
      .select('id, title, description, discount_pct, valid_from, valid_to, is_active, created_at, restaurants (name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'active') {
      query = query.eq('is_active', true).gte('valid_to', today);
    } else if (filter === 'expired') {
      query = query.lt('valid_to', today);
    }

    const { data } = await query;

    setDeals(
      (data || []).map((d) => {
        const restRaw = d.restaurants as unknown;
        const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name?: string } | null;
        return {
          id: d.id,
          title: d.title,
          description: d.description,
          discount_pct: d.discount_pct,
          valid_from: d.valid_from,
          valid_to: d.valid_to,
          is_active: d.is_active,
          restaurant_name: rest?.name || '—',
          created_at: d.created_at,
        };
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('deals').update({ is_active: !current }).eq('id', id);
    fetchDeals();
  }

  async function deleteDeal(id: string) {
    const supabase = createClient();
    await supabase.from('deals').delete().eq('id', id);
    fetchDeals();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Promotions & Deals</h1>
      <p className="mt-1 text-sm text-gray-500">{deals.length} deals</p>

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['active', 'expired', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              filter === f ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : deals.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No deals found</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {deals.map((deal) => (
            <div key={deal.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{deal.title}</h3>
                    <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-white">
                      {deal.discount_pct}% OFF
                    </span>
                    {!deal.is_active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">Inactive</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{deal.restaurant_name}</p>
                  {deal.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{deal.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    {new Date(deal.valid_from + 'T00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    {' — '}
                    {new Date(deal.valid_to + 'T00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(deal.id, deal.is_active)}
                    className="rounded px-3 py-1 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {deal.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteDeal(deal.id)}
                    className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
