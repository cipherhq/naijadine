'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface TableLive {
  id: string;
  label: string;
  capacity: number;
  status: string;
  shape: string;
  section: string | null;
  server_id: string | null;
  // From joined reservation
  reservation?: {
    id: string;
    reference_code: string;
    guest_name: string;
    party_size: number;
    time: string;
    seated_at: string | null;
    special_requests: string | null;
  };
}

interface ServiceNote {
  id: string;
  note_type: string;
  content: string;
  table_label: string | null;
  priority: string;
  is_resolved: boolean;
}

interface WalkIn {
  id: string;
  guest_name: string;
  party_size: number;
  position: number;
  estimated_wait_minutes: number | null;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  available: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  occupied: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  reserved: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  blocked: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' },
};

const NOTE_ICONS: Record<string, string> = {
  vip: '⭐', allergy: '⚠️', birthday: '🎂', anniversary: '💕', general: '📝', kitchen: '👨‍🍳',
};

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Just sat';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function ServiceBoardPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const [tables, setTables] = useState<TableLive[]>([]);
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Tick every 30 seconds for timer updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = useCallback(async () => {
    // Get dining areas
    const { data: areas } = await supabase
      .from('dining_areas')
      .select('id')
      .eq('restaurant_id', restaurant.id);

    const areaIds = (areas || []).map(a => a.id);

    // Get tables
    const { data: tableData } = await supabase
      .from('tables')
      .select('id, table_number, max_seats, status, shape, section, server_id')
      .in('dining_area_id', areaIds.length ? areaIds : ['__none__'])
      .order('table_number');

    // Get today's reservations
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, reference_code, guest_name, party_size, time, status, seated_at, special_requests, table_id')
      .eq('restaurant_id', restaurant.id)
      .eq('date', today)
      .in('status', ['confirmed', 'seated', 'pending']);

    const resByTable = new Map<string, typeof reservations extends (infer T)[] | null ? T : never>();
    for (const r of reservations || []) {
      if (r.table_id) resByTable.set(r.table_id, r);
    }

    setTables((tableData || []).map(t => ({
      id: t.id,
      label: t.table_number || '',
      capacity: t.max_seats || 4,
      status: t.status || 'available',
      shape: t.shape || 'round',
      section: t.section,
      server_id: t.server_id,
      reservation: resByTable.get(t.id) ? {
        id: resByTable.get(t.id)!.id,
        reference_code: resByTable.get(t.id)!.reference_code,
        guest_name: resByTable.get(t.id)!.guest_name || 'Guest',
        party_size: resByTable.get(t.id)!.party_size,
        time: resByTable.get(t.id)!.time,
        seated_at: resByTable.get(t.id)!.seated_at,
        special_requests: resByTable.get(t.id)!.special_requests,
      } : undefined,
    })));

    // Service notes
    const { data: noteData } = await supabase
      .from('service_notes')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('date', today)
      .eq('is_resolved', false)
      .order('priority', { ascending: false });

    setNotes(noteData || []);

    // Walk-in queue
    const { data: walkInData } = await supabase
      .from('walkin_queue')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['waiting', 'notified'])
      .order('position');

    setWalkIns(walkInData || []);
    setLoading(false);
  }, [restaurant.id, today]);

  useEffect(() => {
    fetchAll();

    // Realtime subscriptions
    const ch1 = supabase.channel('service-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchAll())
      .subscribe();

    const ch2 = supabase.channel('service-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchAll())
      .subscribe();

    const ch3 = supabase.channel('service-walkins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walkin_queue' }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [fetchAll]);

  // Actions
  async function seatTable(tableId: string) {
    await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
    // Find reservation for this table and mark seated
    const table = tables.find(t => t.id === tableId);
    if (table?.reservation) {
      await supabase.from('reservations')
        .update({ status: 'seated', seated_at: new Date().toISOString() })
        .eq('id', table.reservation.id);
    }
    fetchAll();
  }

  async function clearTable(tableId: string) {
    await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
    const table = tables.find(t => t.id === tableId);
    if (table?.reservation?.seated_at) {
      await supabase.from('reservations')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', table.reservation.id);
    }
    fetchAll();
  }

  async function seatWalkIn(walkInId: string) {
    await supabase.from('walkin_queue')
      .update({ status: 'seated', seated_at: new Date().toISOString() })
      .eq('id', walkInId);
    fetchAll();
  }

  async function removeWalkIn(walkInId: string) {
    await supabase.from('walkin_queue')
      .update({ status: 'left' })
      .eq('id', walkInId);
    fetchAll();
  }

  async function addWalkIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const position = walkIns.length + 1;
    const avgTurn = 45; // minutes, could be calculated from history

    await supabase.from('walkin_queue').insert({
      restaurant_id: restaurant.id,
      guest_name: data.get('name') as string,
      guest_phone: data.get('phone') as string || null,
      party_size: Number(data.get('party_size')) || 2,
      position,
      estimated_wait_minutes: position * avgTurn,
    });
    form.reset();
    fetchAll();
  }

  async function resolveNote(noteId: string) {
    await supabase.from('service_notes').update({ is_resolved: true }).eq('id', noteId);
    fetchAll();
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  const occupied = tables.filter(t => t.status === 'occupied');
  const available = tables.filter(t => t.status === 'available');
  const reserved = tables.filter(t => t.status === 'reserved');
  const totalCovers = occupied.reduce((s, t) => s + (t.reservation?.party_size || 0), 0);

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Service</h1>
          <p className="text-sm text-gray-500">
            {occupied.length} occupied &middot; {available.length} available &middot; {reserved.length} reserved &middot; {totalCovers} covers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Live — updates every 30s
          </span>
        </div>
      </div>

      {/* Pre-shift notes banner */}
      {notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {notes.map(note => (
            <div key={note.id} className={`flex items-start gap-3 rounded-xl border p-3 ${
              note.priority === 'urgent' ? 'border-red-200 bg-red-50' :
              note.priority === 'high' ? 'border-amber-200 bg-amber-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              <span className="text-lg">{NOTE_ICONS[note.note_type] || '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{note.content}</p>
                {note.table_label && <p className="text-xs text-gray-500">Table {note.table_label}</p>}
              </div>
              <button onClick={() => resolveNote(note.id)} className="text-xs text-gray-400 hover:text-gray-600">✓ Done</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Table Grid — 2/3 width */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Tables</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tables.map(table => {
              const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
              const seatedMins = table.reservation?.seated_at
                ? Math.floor((now - new Date(table.reservation.seated_at).getTime()) / 60000)
                : null;
              const isLongSit = seatedMins !== null && seatedMins > 90;

              return (
                <div key={table.id} className={`rounded-xl border-2 p-3 ${colors.bg} ${isLongSit ? 'ring-2 ring-red-400' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">{table.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  </div>
                  <p className="text-xs text-gray-500">{table.capacity} seats{table.section ? ` · ${table.section}` : ''}</p>

                  {table.status === 'occupied' && table.reservation && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{table.reservation.guest_name}</p>
                      <p className="text-xs text-gray-500">{table.reservation.party_size} guests · {table.reservation.time}</p>
                      {seatedMins !== null && (
                        <p className={`text-xs font-semibold ${isLongSit ? 'text-red-600' : 'text-gray-600'}`}>
                          ⏱ {timeAgo(table.reservation.seated_at!)}
                          {isLongSit && ' — Long sit'}
                        </p>
                      )}
                      {table.reservation.special_requests && (
                        <p className="text-[10px] text-amber-600 truncate">⚠ {table.reservation.special_requests}</p>
                      )}
                      <button onClick={() => clearTable(table.id)}
                        className="mt-1 w-full rounded-lg bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                        Clear Table ✓
                      </button>
                    </div>
                  )}

                  {table.status === 'reserved' && table.reservation && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{table.reservation.guest_name}</p>
                      <p className="text-xs text-gray-500">{table.reservation.party_size} guests · {table.reservation.time}</p>
                      <button onClick={() => seatTable(table.id)}
                        className="mt-1 w-full rounded-lg bg-brand py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                        Seat Guest →
                      </button>
                    </div>
                  )}

                  {table.status === 'available' && (
                    <p className="mt-2 text-xs text-green-600 font-medium">Ready</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — Walk-in Queue */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Walk-in Queue ({walkIns.length})</h2>

          {/* Add walk-in form */}
          <form onSubmit={addWalkIn} className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex gap-2">
              <input name="name" required placeholder="Guest name" className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand" />
              <select name="party_size" className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                {[1,2,3,4,5,6,8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input name="phone" placeholder="Phone (optional)" className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand" />
              <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">+ Add</button>
            </div>
          </form>

          {/* Queue list */}
          {walkIns.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No walk-ins waiting</p>
          ) : (
            <div className="space-y-2">
              {walkIns.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{w.guest_name}</p>
                    <p className="text-xs text-gray-500">{w.party_size} guests · ~{w.estimated_wait_minutes || '?'}min wait</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => seatWalkIn(w.id)}
                      className="rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-green-700">Seat</button>
                    <button onClick={() => removeWalkIn(w.id)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
