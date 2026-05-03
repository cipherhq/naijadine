import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface FloorTable {
  id: string;
  label: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation_deg: number;
  capacity: number;
  section: string | null;
  version: number;
}

export interface TableState {
  table_id: string;
  state: 'free' | 'reserved' | 'seated' | 'check_dropped' | 'needs_bussing' | 'out_of_service';
  party_size: number | null;
  seated_at: string | null;
  server_user_id: string | null;
  notes: string | null;
  version: number;
}

export interface FloorPlan {
  id: string;
  restaurant_id: string;
  name: string;
  is_active: boolean;
  width_px: number;
  height_px: number;
  background_color: string;
  version: number;
}

interface FloorPlanState {
  plan: FloorPlan | null;
  tables: FloorTable[];
  tableStates: Record<string, TableState>;
  loading: boolean;
  dirty: boolean;
  undoStack: FloorTable[][];
  redoStack: FloorTable[][];

  loadPlan: (restaurantId: string) => Promise<void>;
  savePlan: () => Promise<void>;
  addTable: (table: Omit<FloorTable, 'id' | 'version'>) => void;
  updateTable: (id: string, patch: Partial<FloorTable>) => void;
  removeTable: (id: string) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  mergeTableState: (state: TableState) => void;
  setTableStates: (states: TableState[]) => void;
}

export const useFloorPlanStore = create<FloorPlanState>((set, get) => ({
  plan: null,
  tables: [],
  tableStates: {},
  loading: true,
  dirty: false,
  undoStack: [],
  redoStack: [],

  loadPlan: async (restaurantId: string) => {
    // Get active floor plan
    const { data: plans } = await supabase
      .from('floor_plans')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .limit(1);

    const plan = plans?.[0] || null;

    if (!plan) {
      set({ plan: null, tables: [], loading: false });
      return;
    }

    // Get tables for this plan
    const { data: tables } = await supabase
      .from('tables')
      .select('id, label:table_number, shape, x:position_x, y:position_y, width, height, rotation_deg:rotation, capacity:max_seats, section, version')
      .eq('floor_plan_id', plan.id);

    // Get table states
    const { data: states } = await supabase
      .from('table_states')
      .select('*')
      .eq('restaurant_id', restaurantId);

    const stateMap: Record<string, TableState> = {};
    for (const s of states || []) {
      stateMap[s.table_id] = s;
    }

    set({
      plan,
      tables: (tables || []).map(t => ({
        ...t,
        x: Number(t.x) || 0,
        y: Number(t.y) || 0,
        width: Number(t.width) || 80,
        height: Number(t.height) || 80,
        rotation_deg: Number(t.rotation_deg) || 0,
      })),
      tableStates: stateMap,
      loading: false,
      dirty: false,
    });
  },

  savePlan: async () => {
    const { plan, tables } = get();
    if (!plan) return;

    for (const table of tables) {
      if (table.id.startsWith('new_')) {
        // Insert new table
        await supabase.from('tables').insert({
          floor_plan_id: plan.id,
          restaurant_id: plan.restaurant_id,
          table_number: table.label,
          shape: table.shape,
          position_x: table.x,
          position_y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation_deg,
          max_seats: table.capacity,
          min_seats: 1,
          section: table.section,
        });
      } else {
        // Update existing
        await supabase.from('tables').update({
          position_x: table.x,
          position_y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation_deg,
          table_number: table.label,
          max_seats: table.capacity,
          section: table.section,
        }).eq('id', table.id);
      }
    }

    set({ dirty: false });
  },

  addTable: (table) => {
    const id = `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set((s) => ({
      tables: [...s.tables, { ...table, id, version: 1 }],
      dirty: true,
    }));
  },

  updateTable: (id, patch) => {
    set((s) => ({
      tables: s.tables.map(t => t.id === id ? { ...t, ...patch } : t),
      dirty: true,
    }));
  },

  removeTable: (id) => {
    set((s) => ({
      tables: s.tables.filter(t => t.id !== id),
      dirty: true,
    }));
    if (!id.startsWith('new_')) {
      supabase.from('tables').delete().eq('id', id);
    }
  },

  pushUndo: () => {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-20), [...s.tables]],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack, tables } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      tables: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, tables],
      dirty: true,
    });
  },

  redo: () => {
    const { redoStack, tables } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      tables: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, tables],
      dirty: true,
    });
  },

  mergeTableState: (state) => {
    set((s) => ({
      tableStates: { ...s.tableStates, [state.table_id]: state },
    }));
  },

  setTableStates: (states) => {
    const map: Record<string, TableState> = {};
    for (const s of states) map[s.table_id] = s;
    set({ tableStates: map });
  },
}));
