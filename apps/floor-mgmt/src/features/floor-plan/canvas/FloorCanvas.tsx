import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import { TableNode } from './TableNode';
import { useFloorPlanStore, type FloorTable, type TableState } from '../store';

interface FloorCanvasProps {
  mode: 'editor' | 'service';
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
}

export function FloorCanvas({ mode, selectedTableId, onSelectTable }: FloorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const { plan, tables, tableStates, updateTable, pushUndo } = useFloorPlanStore();

  const canvasWidth = plan?.width_px || 900;
  const canvasHeight = plan?.height_px || 600;

  // Responsive sizing
  useEffect(() => {
    function resize() {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const scale = w / canvasWidth;
        setDimensions({ width: w, height: canvasHeight * scale });
      }
    }
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  const scale = dimensions.width / canvasWidth;

  // Grid lines for editor
  const gridLines: { points: number[] }[] = [];
  if (mode === 'editor') {
    const gridSize = 20;
    for (let x = 0; x <= canvasWidth; x += gridSize) {
      gridLines.push({ points: [x, 0, x, canvasHeight] });
    }
    for (let y = 0; y <= canvasHeight; y += gridSize) {
      gridLines.push({ points: [0, y, canvasWidth, y] });
    }
  }

  function handleDragEnd(id: string, x: number, y: number) {
    pushUndo();
    updateTable(id, { x, y });
  }

  function handleStageClick(e: any) {
    if (e.target === e.target.getStage()) {
      onSelectTable(null);
    }
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* Background */}
        <Layer>
          <Rect
            width={canvasWidth}
            height={canvasHeight}
            fill={plan?.background_color || '#f5f5f4'}
          />
          {/* Grid (editor only) */}
          {gridLines.map((line, i) => (
            <Line key={i} points={line.points} stroke="#e5e7eb" strokeWidth={0.5} />
          ))}
        </Layer>

        {/* Tables */}
        <Layer>
          {tables.map((table) => (
            <TableNode
              key={table.id}
              id={table.id}
              label={table.label}
              shape={table.shape}
              x={table.x}
              y={table.y}
              width={table.width}
              height={table.height}
              rotation={table.rotation_deg}
              capacity={table.capacity}
              state={tableStates[table.id]}
              mode={mode}
              selected={table.id === selectedTableId}
              onSelect={onSelectTable}
              onDragEnd={mode === 'editor' ? handleDragEnd : undefined}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
