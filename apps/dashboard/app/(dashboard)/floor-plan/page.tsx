'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Table {
  id: string;
  label: string;
  capacity: number;
  status: string;
  x: number;
  y: number;
  shape: string;
  reservation_id: string | null;
  guest_name?: string;
}

const tableStatusColors: Record<string, { bg: string; border: string; text: string }> = {
  available: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  occupied: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  reserved: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700' },
  blocked: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' },
};

export default function FloorPlanPage() {
  const restaurant = useRestaurant();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTable, setNewTable] = useState({ label: '', capacity: 2, shape: 'round' });
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  async function fetchTables() {
    const supabase = createClient();
    const { data } = await supabase
      .from('tables')
      .select('id, label, capacity, status, x_position, y_position, shape, reservation_id')
      .eq('restaurant_id', restaurant.id)
      .order('label');

    const mapped = (data || []).map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      status: t.status || 'available',
      x: t.x_position || 0,
      y: t.y_position || 0,
      shape: t.shape || 'round',
      reservation_id: t.reservation_id,
    }));

    setTables(mapped);
    setLoading(false);
  }

  useEffect(() => {
    fetchTables();

    const supabase = createClient();
    const channel = supabase
      .channel('floor-plan')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => fetchTables(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function addTable() {
    if (!newTable.label) return;
    const supabase = createClient();
    await supabase.from('tables').insert({
      restaurant_id: restaurant.id,
      label: newTable.label,
      capacity: newTable.capacity,
      shape: newTable.shape,
      status: 'available',
      x_position: Math.floor(Math.random() * 5),
      y_position: Math.floor(Math.random() * 5),
    });
    setNewTable({ label: '', capacity: 2, shape: 'round' });
    setShowAddForm(false);
    fetchTables();
  }

  async function updateTableStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase
      .from('tables')
      .update({ status, reservation_id: status === 'available' ? null : undefined })
      .eq('id', id);
    setSelectedTable(null);
    fetchTables();
  }

  async function deleteTable(id: string) {
    const supabase = createClient();
    await supabase.from('tables').delete().eq('id', id);
    setSelectedTable(null);
    fetchTables();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const statusCounts = tables.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Floor Plan</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tables.length} tables &middot;{' '}
            {statusCounts.available || 0} available &middot;{' '}
            {statusCounts.occupied || 0} occupied &middot;{' '}
            {statusCounts.reserved || 0} reserved
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          + Add Table
        </button>
      </div>

      {/* Add table form */}
      {showAddForm && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="font-medium text-gray-900">New Table</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Table label (e.g. T1, VIP-A)"
              value={newTable.label}
              onChange={(e) => setNewTable({ ...newTable, label: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <select
              value={newTable.capacity}
              onChange={(e) => setNewTable({ ...newTable, capacity: Number(e.target.value) })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                <option key={n} value={n}>{n} seats</option>
              ))}
            </select>
            <select
              value={newTable.shape}
              onChange={(e) => setNewTable({ ...newTable, shape: e.target.value })}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="round">Round</option>
              <option value="square">Square</option>
              <option value="rectangle">Rectangle</option>
            </select>
            <button
              onClick={addTable}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4">
        {Object.entries(tableStatusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-full border ${colors.border} ${colors.bg}`} />
            <span className="text-xs capitalize text-gray-500">{status}</span>
          </div>
        ))}
      </div>

      {/* Tables grid */}
      {tables.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-400">No tables configured yet</p>
          <p className="mt-1 text-sm text-gray-300">Add tables to manage your floor plan</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map((table) => {
            const colors = tableStatusColors[table.status] || tableStatusColors.available;
            return (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 text-center transition hover:shadow-md ${
                  table.shape === 'round' ? 'aspect-square rounded-full' : ''
                }`}
              >
                <p className={`text-lg font-bold ${colors.text}`}>{table.label}</p>
                <p className="mt-1 text-xs text-gray-500">{table.capacity} seats</p>
                <p className={`mt-0.5 text-xs capitalize ${colors.text}`}>{table.status}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Table detail modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Table {selectedTable.label}
              </h3>
              <button
                onClick={() => setSelectedTable(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p>Capacity: {selectedTable.capacity} seats</p>
              <p>Shape: {selectedTable.shape}</p>
              <p>Status: <span className="capitalize font-medium">{selectedTable.status}</span></p>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">Change Status</p>
              <div className="flex flex-wrap gap-2">
                {['available', 'occupied', 'reserved', 'blocked'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateTableStatus(selectedTable.id, s)}
                    disabled={s === selectedTable.status}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                      s === selectedTable.status
                        ? 'bg-gray-100 text-gray-400'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => deleteTable(selectedTable.id)}
              className="mt-4 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
