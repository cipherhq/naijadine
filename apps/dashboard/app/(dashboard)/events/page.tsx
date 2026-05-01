'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  price_per_person: number | null;
  max_capacity: number | null;
  spots_remaining: number | null;
  is_private_dining: boolean;
  is_active: boolean;
}

export default function EventsPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', start_time: '19:00',
    end_time: '22:00', price_per_person: 0, max_capacity: 20, is_private_dining: false,
  });

  async function fetchEvents() {
    const { data } = await supabase
      .from('restaurant_events')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('event_date', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchEvents(); }, [restaurant.id]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('restaurant_events').insert({
      restaurant_id: restaurant.id,
      ...form,
      spots_remaining: form.max_capacity,
      is_active: true,
    });
    setShowForm(false);
    setForm({ title: '', description: '', event_date: '', start_time: '19:00', end_time: '22:00', price_per_person: 0, max_capacity: 20, is_private_dining: false });
    fetchEvents();
  }

  async function toggleEvent(id: string, active: boolean) {
    await supabase.from('restaurant_events').update({ is_active: !active }).eq('id', id);
    fetchEvents();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events & Private Dining</h1>
          <p className="mt-1 text-sm text-gray-500">{events.filter(e => e.is_active).length} active events</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Create Event</button>
      </div>

      {showForm && (
        <form onSubmit={createEvent} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Event Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                placeholder="e.g. Wine Tasting Night, Private Dinner" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Start</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">End</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price/Person (₦)</label>
              <input type="number" value={form.price_per_person || ''} onChange={(e) => setForm({ ...form, price_per_person: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max Capacity</label>
              <input type="number" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_private_dining} onChange={(e) => setForm({ ...form, is_private_dining: e.target.checked })} className="rounded" />
            This is a private dining experience
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={!form.title || !form.event_date} className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create</button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="mt-12 text-center py-12"><p className="text-gray-400">No events created yet</p></div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((event) => (
            <div key={event.id} className={`rounded-xl border bg-white p-5 ${event.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                    {event.is_private_dining && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">Private</span>}
                  </div>
                  {event.description && <p className="mt-1 text-sm text-gray-500">{event.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(event.event_date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })} · {event.start_time} — {event.end_time}
                    {event.price_per_person ? ` · ₦${event.price_per_person.toLocaleString()}/person` : ' · Free'}
                    {event.max_capacity ? ` · ${event.spots_remaining}/${event.max_capacity} spots` : ''}
                  </p>
                </div>
                <button onClick={() => toggleEvent(event.id, event.is_active)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${event.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {event.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
