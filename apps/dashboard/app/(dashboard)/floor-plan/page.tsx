'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Table {
  id: string;
  label: string;
  capacity: number;
  status: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  dining_area_id: string;
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  available: { fill: '#DCFCE7', stroke: '#22C55E', text: '#166534' },
  occupied: { fill: '#FEE2E2', stroke: '#EF4444', text: '#991B1B' },
  reserved: { fill: '#FEF3C7', stroke: '#F59E0B', text: '#92400E' },
  blocked: { fill: '#F3F4F6', stroke: '#9CA3AF', text: '#6B7280' },
};

const CANVAS_W = 900;
const CANVAS_H = 600;
const GRID_SIZE = 20;

export default function FloorPlanPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const svgRef = useRef<SVGSVGElement>(null);

  const [tables, setTables] = useState<Table[]>([]);
  const [diningAreaId, setDiningAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTable, setNewTable] = useState({ label: '', capacity: 4, shape: 'round' as string });

  const selected = tables.find((t) => t.id === selectedId) || null;

  // ── Ensure a default dining area exists ──
  const ensureDiningArea = useCallback(async () => {
    const { data: areas } = await supabase
      .from('dining_areas')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order')
      .limit(1);

    if (areas && areas.length > 0) {
      setDiningAreaId(areas[0].id);
      return areas[0].id;
    }

    // Create default dining area
    const { data: newArea } = await supabase
      .from('dining_areas')
      .insert({ restaurant_id: restaurant.id, name: 'Main Floor', sort_order: 0 })
      .select('id')
      .single();

    if (newArea) {
      setDiningAreaId(newArea.id);
      return newArea.id;
    }
    return null;
  }, [restaurant.id]);

  // ── Load tables ──
  const fetchTables = useCallback(async () => {
    const { data } = await supabase
      .from('tables')
      .select('id, table_number, max_seats, status, position_x, position_y, width, height, shape, dining_area_id')
      .in('dining_area_id', (
        await supabase
          .from('dining_areas')
          .select('id')
          .eq('restaurant_id', restaurant.id)
      ).data?.map((d: { id: string }) => d.id) || [])
      .order('table_number');

    setTables(
      (data || []).map((t) => ({
        id: t.id,
        label: t.table_number || '',
        capacity: t.max_seats || 4,
        status: t.status || 'available',
        x: t.position_x || 50,
        y: t.position_y || 50,
        width: t.width || (t.shape === 'rectangle' ? 120 : 80),
        height: t.height || 80,
        shape: t.shape || 'round',
        dining_area_id: t.dining_area_id,
      })),
    );
    setLoading(false);
  }, [restaurant.id]);

  useEffect(() => {
    async function init() {
      await ensureDiningArea();
      await fetchTables();
    }
    init();

    const channel = supabase
      .channel('floor-plan-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ensureDiningArea, fetchTables]);

  // ── SVG mouse helpers ──
  function getSvgPoint(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  function handleMouseDown(e: React.MouseEvent, table: Table) {
    if (!editMode) { setSelectedId(table.id); return; }
    e.preventDefault();
    const pt = getSvgPoint(e);
    setDragging({ id: table.id, offsetX: pt.x - table.x, offsetY: pt.y - table.y });
    setSelectedId(table.id);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const pt = getSvgPoint(e);
    let nx = Math.round((pt.x - dragging.offsetX) / GRID_SIZE) * GRID_SIZE;
    let ny = Math.round((pt.y - dragging.offsetY) / GRID_SIZE) * GRID_SIZE;
    nx = Math.max(10, Math.min(CANVAS_W - 90, nx));
    ny = Math.max(10, Math.min(CANVAS_H - 90, ny));
    setTables((prev) => prev.map((t) => (t.id === dragging.id ? { ...t, x: nx, y: ny } : t)));
  }

  async function handleMouseUp() {
    if (!dragging) return;
    const table = tables.find((t) => t.id === dragging.id);
    if (table) {
      await supabase.from('tables').update({ position_x: table.x, position_y: table.y }).eq('id', table.id);
    }
    setDragging(null);
  }

  // ── CRUD ──
  async function addTable() {
    if (!newTable.label || !diningAreaId) return;
    const w = newTable.shape === 'rectangle' ? 120 : 80;
    await supabase.from('tables').insert({
      dining_area_id: diningAreaId,
      table_number: newTable.label,
      min_seats: 1,
      max_seats: newTable.capacity,
      shape: newTable.shape,
      status: 'available',
      position_x: 100 + Math.floor(Math.random() * 400),
      position_y: 100 + Math.floor(Math.random() * 300),
      width: w,
      height: 80,
    });
    setNewTable({ label: '', capacity: 4, shape: 'round' });
    setShowAddForm(false);
    fetchTables();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('tables').update({ status }).eq('id', id);
    setSelectedId(null);
    fetchTables();
  }

  async function deleteTable(id: string) {
    await supabase.from('tables').delete().eq('id', id);
    setSelectedId(null);
    fetchTables();
  }

  // ── Render table ──
  function renderTable(table: Table) {
    const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
    const isSelected = table.id === selectedId;
    const isDragged = dragging?.id === table.id;
    const cx = table.x + table.width / 2;
    const cy = table.y + table.height / 2;

    const shapeProps = {
      fill: colors.fill,
      stroke: isSelected ? '#F04E37' : colors.stroke,
      strokeWidth: isSelected ? 2.5 : 1.5,
      style: {
        cursor: editMode ? (isDragged ? 'grabbing' : 'grab') : 'pointer',
        filter: isDragged ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : undefined,
        transition: isDragged ? 'none' : 'filter 0.15s',
      },
    };

    return (
      <g key={table.id} onMouseDown={(e) => handleMouseDown(e, table)} aria-label={`Table ${table.label}`}>
        {/* Shape */}
        {table.shape === 'round' ? (
          <ellipse cx={cx} cy={cy} rx={table.width / 2 - 2} ry={table.height / 2 - 2} {...shapeProps} />
        ) : (
          <rect x={table.x} y={table.y} width={table.width} height={table.height}
            rx={table.shape === 'square' ? 8 : 4} {...shapeProps} />
        )}

        {/* Chairs */}
        {Array.from({ length: Math.min(table.capacity, 10) }).map((_, i) => {
          const angle = (i / Math.min(table.capacity, 10)) * Math.PI * 2 - Math.PI / 2;
          const rx = (table.shape === 'round' ? table.width / 2 : table.width / 2) + 14;
          const ry = (table.shape === 'round' ? table.height / 2 : table.height / 2) + 14;
          return (
            <circle key={i} cx={cx + Math.cos(angle) * rx} cy={cy + Math.sin(angle) * ry}
              r={5} fill={colors.stroke} opacity={0.35} />
          );
        })}

        {/* Label */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={colors.text}>
          {table.label}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="10" fill={colors.text} opacity={0.6}>
          {table.capacity} seats
        </text>
      </g>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const counts = tables.reduce<Record<string, number>>((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Floor Plan</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tables.length} tables &middot; {counts.available || 0} available &middot; {counts.occupied || 0} occupied &middot; {counts.reserved || 0} reserved
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditMode(!editMode)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${editMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {editMode ? '🔓 Editing' : '✏️ Edit Layout'}
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + Add Table
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-medium text-gray-900">New Table</h3>
          <div className="mt-3 flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Label</label>
              <input type="text" placeholder="T1, VIP-A..." value={newTable.label}
                onChange={(e) => setNewTable({ ...newTable, label: e.target.value })}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand w-32" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Seats</label>
              <select value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: Number(e.target.value) })}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              {(['round', 'square', 'rectangle'] as const).map((s) => (
                <button key={s} onClick={() => setNewTable({ ...newTable, shape: s })}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize ${newTable.shape === s ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {s === 'round' ? '⬤' : s === 'square' ? '⬛' : '▬'} {s}
                </button>
              ))}
            </div>
            <button onClick={addTable} disabled={!newTable.label}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Add</button>
            <button onClick={() => setShowAddForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.fill, border: `2px solid ${c.stroke}` }} />
            <span className="text-xs capitalize text-gray-500">{s}</span>
          </div>
        ))}
        {editMode && <span className="ml-auto text-xs text-amber-600">Drag tables to reposition</span>}
      </div>

      {/* Canvas */}
      {tables.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 p-20 text-center">
          <p className="text-lg text-gray-400">No tables yet</p>
          <p className="mt-1 text-sm text-gray-300">Click &quot;+ Add Table&quot; to design your floor plan</p>
        </div>
      ) : (
        <div className="mt-6 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <svg ref={svgRef} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full" style={{ minHeight: 400 }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
            <rect x={10} y={10} width={CANVAS_W - 20} height={CANVAS_H - 20} fill="none" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="6 3" rx="8" />
            <text x={CANVAS_W / 2} y={30} textAnchor="middle" fontSize="11" fill="#d1d5db">ENTRANCE</text>
            <text x={CANVAS_W / 2} y={CANVAS_H - 16} textAnchor="middle" fontSize="11" fill="#d1d5db">KITCHEN</text>
            {tables.map(renderTable)}
          </svg>
        </div>
      )}

      {/* Selection panel */}
      {selected && !editMode && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Table {selected.label}</h3>
              <p className="text-sm text-gray-500">{selected.capacity} seats &middot; {selected.shape} &middot; <span className="capitalize">{selected.status}</span></p>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['available', 'occupied', 'reserved', 'blocked'].map((s) => (
              <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={s === selected.status}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${s === selected.status ? 'bg-gray-100 text-gray-400' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
            <button onClick={() => deleteTable(selected.id)}
              className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
