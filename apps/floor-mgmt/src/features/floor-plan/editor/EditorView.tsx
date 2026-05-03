import { useState } from 'react';
import { FloorCanvas } from '../canvas/FloorCanvas';
import { useFloorPlanStore } from '../store';

const SHAPES = [
  { value: 'circle', label: '⬤ Round', w: 80, h: 80 },
  { value: 'square', label: '⬛ Square', w: 80, h: 80 },
  { value: 'rect', label: '▬ Rectangle', w: 120, h: 70 },
  { value: 'booth', label: '🛋 Booth', w: 140, h: 80 },
  { value: 'bar_stool', label: '🪑 Bar Stool', w: 50, h: 50 },
];

export function EditorView() {
  const { tables, dirty, addTable, removeTable, updateTable, savePlan, undo, redo, pushUndo, undoStack, redoStack } = useFloorPlanStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newShape, setNewShape] = useState('circle');
  const [newCapacity, setNewCapacity] = useState(4);

  const selected = tables.find(t => t.id === selectedId);

  function handleAddTable() {
    if (!newLabel) return;
    const shapeDef = SHAPES.find(s => s.value === newShape) || SHAPES[0];
    pushUndo();
    addTable({
      label: newLabel,
      shape: newShape,
      x: 100 + Math.random() * 400,
      y: 100 + Math.random() * 300,
      width: shapeDef.w,
      height: shapeDef.h,
      rotation_deg: 0,
      capacity: newCapacity,
      section: null,
    });
    setNewLabel('');
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Canvas */}
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={undo} disabled={undoStack.length === 0}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30">↩ Undo</button>
            <button onClick={redo} disabled={redoStack.length === 0}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30">↪ Redo</button>
          </div>
          <button onClick={savePlan} disabled={!dirty}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-30">
            {dirty ? '💾 Save Layout' : '✓ Saved'}
          </button>
        </div>
        <FloorCanvas mode="editor" selectedTableId={selectedId} onSelectTable={setSelectedId} />
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 space-y-4">
        {/* Add table */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Add Table</h3>
          <div className="mt-3 space-y-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (T1, Bar 3...)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-1">
              {SHAPES.map(s => (
                <button key={s.value} onClick={() => setNewShape(s.value)}
                  className={`rounded-lg border px-2 py-1 text-xs ${newShape === s.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Seats:</label>
              <input type="number" min={1} max={30} value={newCapacity} onChange={e => setNewCapacity(Number(e.target.value))}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
            </div>
            <button onClick={handleAddTable} disabled={!newLabel}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Add</button>
          </div>
        </div>

        {/* Selected table inspector */}
        {selected && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Table {selected.label}</h3>
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-xs text-gray-500">Label</label>
                <input value={selected.label} onChange={e => updateTable(selected.id, { label: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Capacity</label>
                <input type="number" min={1} max={30} value={selected.capacity}
                  onChange={e => updateTable(selected.id, { capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Section</label>
                <input value={selected.section || ''} onChange={e => updateTable(selected.id, { section: e.target.value || null })}
                  placeholder="e.g. patio, main, bar"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Rotation (°)</label>
                <input type="range" min={0} max={360} step={15} value={selected.rotation_deg}
                  onChange={e => updateTable(selected.id, { rotation_deg: Number(e.target.value) })}
                  className="w-full" />
                <span className="text-xs text-gray-400">{selected.rotation_deg}°</span>
              </div>
              <button onClick={() => { removeTable(selected.id); setSelectedId(null); }}
                className="w-full rounded-lg border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50">
                Delete Table
              </button>
            </div>
          </div>
        )}

        {/* Table list */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">{tables.length} Tables</h3>
          <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
            {tables.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left rounded-lg px-2 py-1.5 text-sm ${selectedId === t.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50'}`}>
                <span className="font-medium">{t.label}</span>
                <span className="text-gray-400 ml-1">· {t.capacity} seats · {t.shape}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
