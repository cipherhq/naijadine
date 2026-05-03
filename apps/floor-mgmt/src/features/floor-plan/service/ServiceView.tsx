import { useState, useEffect } from 'react';
import { FloorCanvas } from '../canvas/FloorCanvas';
import { useFloorPlanStore, type TableState } from '../store';
import { updateWithVersion } from '@/lib/concurrency';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/features/auth/store';

const STATES: { value: TableState['state']; label: string; icon: string; color: string }[] = [
  { value: 'free', label: 'Free', icon: '✓', color: 'bg-green-100 text-green-700' },
  { value: 'reserved', label: 'Reserved', icon: '⏰', color: 'bg-amber-100 text-amber-700' },
  { value: 'seated', label: 'Seated', icon: '🍽', color: 'bg-red-100 text-red-700' },
  { value: 'check_dropped', label: 'Check Dropped', icon: '💳', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'needs_bussing', label: 'Needs Bussing', icon: '🧹', color: 'bg-pink-100 text-pink-700' },
  { value: 'out_of_service', label: 'Out of Service', icon: '⛔', color: 'bg-gray-100 text-gray-600' },
];

export function ServiceView() {
  const { tables, tableStates, mergeTableState } = useFloorPlanStore();
  const restaurantId = useSessionStore(s => s.restaurantId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Timer refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('service-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_states',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        if (payload.new) mergeTableState(payload.new as TableState);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, mergeTableState]);

  const selected = tables.find(t => t.id === selectedId);
  const selectedState = selectedId ? tableStates[selectedId] : undefined;

  async function changeState(newState: TableState['state']) {
    if (!selectedId || !selectedState) return;

    const patch: Partial<TableState> = {
      state: newState,
    };

    if (newState === 'seated') {
      patch.seated_at = new Date().toISOString();
    }
    if (newState === 'free') {
      patch.party_size = null;
      patch.seated_at = null;
      patch.notes = null;
    }

    const result = await updateWithVersion(
      'table_states',
      selectedId,
      selectedState.version,
      patch,
    );

    if (result.ok) {
      mergeTableState(result.row as TableState);
      setSelectedId(null);
    } else if (result.reason === 'stale') {
      setToast('Someone else updated this table — refreshing');
      // Refetch
      const { data } = await supabase.from('table_states').select('*').eq('table_id', selectedId).single();
      if (data) mergeTableState(data);
      setTimeout(() => setToast(null), 3000);
    }
  }

  // Stats
  const stateCounts = Object.values(tableStates).reduce<Record<string, number>>((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});

  const totalCovers = Object.values(tableStates)
    .filter(s => s.state === 'seated')
    .reduce((sum, s) => sum + (s.party_size || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Canvas */}
      <div className="flex-1">
        {/* Status bar */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-3 text-sm">
            {STATES.slice(0, 4).map(s => (
              <span key={s.value} className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
                {s.icon} {stateCounts[s.value] || 0}
              </span>
            ))}
            <span className="text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">{totalCovers} covers</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Live
          </span>
        </div>

        <FloorCanvas mode="service" selectedTableId={selectedId} onSelectTable={setSelectedId} />
      </div>

      {/* Sidebar — table inspector */}
      <div className="w-full lg:w-72">
        {toast && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ {toast}
          </div>
        )}

        {selected && selectedState ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Table {selected.label}</h3>
              <p className="text-sm text-gray-500">
                {selected.capacity} seats · {selected.section || 'No section'} · {selected.shape}
              </p>
            </div>

            {/* Current state */}
            <div className={`rounded-lg p-3 text-center ${STATES.find(s => s.value === selectedState.state)?.color || ''}`}>
              <span className="text-lg">{STATES.find(s => s.value === selectedState.state)?.icon}</span>
              <span className="ml-2 font-semibold">{STATES.find(s => s.value === selectedState.state)?.label}</span>
              {selectedState.seated_at && (
                <p className="mt-1 text-xs">
                  Seated {Math.floor((Date.now() - new Date(selectedState.seated_at).getTime()) / 60000)}m ago
                </p>
              )}
            </div>

            {/* Party size */}
            {(selectedState.state === 'reserved' || selectedState.state === 'seated') && (
              <div>
                <label className="text-xs text-gray-500">Party Size</label>
                <p className="text-lg font-bold">{selectedState.party_size || '—'}</p>
              </div>
            )}

            {/* Notes */}
            {selectedState.notes && (
              <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                📝 {selectedState.notes}
              </div>
            )}

            {/* State transition buttons */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Change State</p>
              <div className="grid grid-cols-2 gap-2">
                {STATES.map(s => (
                  <button key={s.value} onClick={() => changeState(s.value)}
                    disabled={s.value === selectedState.state}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      s.value === selectedState.state ? 'opacity-30' : 'hover:bg-gray-50'
                    } ${s.color}`}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setSelectedId(null)}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50">
              Close
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">Select a table to view details</p>
            <p className="mt-1 text-xs text-gray-300">Click any table on the floor plan</p>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Legend</h4>
          <div className="mt-2 space-y-1">
            {STATES.map(s => (
              <div key={s.value} className="flex items-center gap-2 text-xs text-gray-600">
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
