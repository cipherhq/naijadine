'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  time_slots: string[] | null;
  days_of_week: string[] | null;
}

export default function DealsPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    discount_pct: 10,
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    days_of_week: [] as string[],
  });

  async function fetchDeals() {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });
    setDeals(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchDeals(); }, [restaurant.id]);

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('deals').insert({
      restaurant_id: restaurant.id,
      title: form.title,
      description: form.description || null,
      discount_pct: form.discount_pct,
      valid_from: form.valid_from,
      valid_to: form.valid_to,
      days_of_week: form.days_of_week.length ? form.days_of_week : null,
      is_active: true,
    });
    setShowForm(false);
    setForm({ title: '', description: '', discount_pct: 10, valid_from: new Date().toISOString().split('T')[0], valid_to: '', days_of_week: [] });
    fetchDeals();
  }

  async function toggleDeal(id: string, active: boolean) {
    await supabase.from('deals').update({ is_active: !active }).eq('id', id);
    fetchDeals();
  }

  async function deleteDeal(id: string) {
    await supabase.from('deals').delete().eq('id', id);
    fetchDeals();
  }

  const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals & Promotions</h1>
          <p className="mt-1 text-sm text-gray-500">{deals.filter(d => d.is_active).length} active deals</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          + Create Deal
        </button>
      </div>

      {showForm && (
        <form onSubmit={createDeal} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Deal Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
              placeholder="e.g. 20% Off Tuesday Lunch" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Details about the deal..." className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Discount %</label>
              <input type="number" min={5} max={50} value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Active Days (optional — leave empty for all days)</label>
            <div className="flex gap-2">
              {dayOptions.map((d) => (
                <button key={d} type="button"
                  onClick={() => setForm({ ...form, days_of_week: form.days_of_week.includes(d) ? form.days_of_week.filter(x => x !== d) : [...form.days_of_week, d] })}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${form.days_of_week.includes(d) ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-gray-200 text-gray-600'}`}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={!form.title || !form.valid_to} className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">Create Deal</button>
          </div>
        </form>
      )}

      {deals.length === 0 ? (
        <div className="mt-12 text-center py-12"><p className="text-gray-400">No deals created yet</p><p className="mt-1 text-sm text-gray-300">Create a deal to fill empty tables on slow days</p></div>
      ) : (
        <div className="mt-6 space-y-3">
          {deals.map((deal) => (
            <div key={deal.id} className={`rounded-xl border bg-white p-5 ${deal.is_active ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{deal.title}</h3>
                    <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-white">{deal.discount_pct}% OFF</span>
                  </div>
                  {deal.description && <p className="mt-1 text-sm text-gray-500">{deal.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(deal.valid_from).toLocaleDateString()} — {new Date(deal.valid_to).toLocaleDateString()}
                    {deal.days_of_week && ` · ${(deal.days_of_week as string[]).join(', ')}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleDeal(deal.id, deal.is_active)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${deal.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {deal.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => deleteDeal(deal.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
