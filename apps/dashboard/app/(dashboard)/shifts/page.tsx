'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Shift {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_covers_per_interval: number;
  interval_minutes: number;
  turn_time_minutes: number;
  is_active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ShiftsPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: 'Dinner', start_time: '18:00', end_time: '23:00',
    max_covers: 20, interval: 15, turn_time: 90, days: [1, 2, 3, 4, 5, 6] as number[],
  });

  async function fetchShifts() {
    const { data } = await supabase.from('restaurant_shifts').select('*')
      .eq('restaurant_id', restaurant.id).order('day_of_week').order('start_time');
    setShifts(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchShifts(); }, [restaurant.id]);

  async function createShifts(e: React.FormEvent) {
    e.preventDefault();
    const rows = form.days.map(day => ({
      restaurant_id: restaurant.id,
      name: form.name,
      day_of_week: day,
      start_time: form.start_time,
      end_time: form.end_time,
      max_covers_per_interval: form.max_covers,
      interval_minutes: form.interval,
      turn_time_minutes: form.turn_time,
      is_active: true,
    }));
    await supabase.from('restaurant_shifts').upsert(rows, { onConflict: 'restaurant_id,name,day_of_week' });
    setShowForm(false);
    fetchShifts();
  }

  async function toggleShift(id: string, active: boolean) {
    await supabase.from('restaurant_shifts').update({ is_active: !active }).eq('id', id);
    fetchShifts();
  }

  async function deleteShift(id: string) {
    await supabase.from('restaurant_shifts').delete().eq('id', id);
    fetchShifts();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  // Group by shift name
  const grouped = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    if (!acc[s.name]) acc[s.name] = [];
    acc[s.name].push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts & Pace Control</h1>
          <p className="mt-1 text-sm text-gray-500">Control booking flow to prevent kitchen overwhelm</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          + Add Shift
        </button>
      </div>

      {/* How it works */}
      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>How pace control works:</strong> Set max covers per time interval. If you set 20 covers per 15 minutes, the booking system won&apos;t accept more than 20 new guests in any 15-minute window. Turn time determines how long a table is reserved.
      </div>

      {showForm && (
        <form onSubmit={createShifts} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Shift Name</label>
              <select value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
                <option>Breakfast</option><option>Brunch</option><option>Lunch</option><option>Dinner</option><option>Late Night</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Start</label>
                <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">End</label>
                <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max Covers / Interval</label>
              <input type="number" value={form.max_covers} onChange={e => setForm({...form, max_covers: Number(e.target.value)})}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Interval (min)</label>
              <select value={form.interval} onChange={e => setForm({...form, interval: Number(e.target.value)})}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
                <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Turn Time (min)</label>
              <input type="number" value={form.turn_time} onChange={e => setForm({...form, turn_time: Number(e.target.value)})}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Active Days</label>
            <div className="flex gap-2">
              {DAYS.map((d, i) => (
                <button key={i} type="button"
                  onClick={() => setForm({...form, days: form.days.includes(i) ? form.days.filter(x => x !== i) : [...form.days, i]})}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${form.days.includes(i) ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-gray-200 text-gray-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white">Create Shift</button>
          </div>
        </form>
      )}

      {/* Existing shifts */}
      {Object.keys(grouped).length === 0 ? (
        <div className="mt-12 text-center py-12"><p className="text-gray-400">No shifts configured</p><p className="mt-1 text-sm text-gray-300">Add shifts to control booking pace</p></div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([name, dayShifts]) => (
            <div key={name} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{name}</h3>
                  <p className="text-xs text-gray-500">
                    {dayShifts[0].start_time} — {dayShifts[0].end_time} · {dayShifts[0].max_covers_per_interval} covers/{dayShifts[0].interval_minutes}min · {dayShifts[0].turn_time_minutes}min turns
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {dayShifts.map(s => (
                  <div key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${s.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 opacity-50'}`}>
                    <span className="font-medium">{DAYS[s.day_of_week]}</span>
                    <button onClick={() => toggleShift(s.id, s.is_active)} className="text-xs text-gray-400 hover:text-gray-600">
                      {s.is_active ? '✓' : '○'}
                    </button>
                    <button onClick={() => deleteShift(s.id)} className="text-xs text-red-400 hover:text-red-600">×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
