import { Group, Circle, Rect, Text } from 'react-konva';
import type { TableState } from '../store';

const STATE_COLORS: Record<string, { fill: string; stroke: string }> = {
  free: { fill: '#DCFCE7', stroke: '#22C55E' },
  reserved: { fill: '#FEF3C7', stroke: '#F59E0B' },
  seated: { fill: '#FEE2E2', stroke: '#EF4444' },
  check_dropped: { fill: '#E0E7FF', stroke: '#6366F1' },
  needs_bussing: { fill: '#FCE7F3', stroke: '#EC4899' },
  out_of_service: { fill: '#F3F4F6', stroke: '#9CA3AF' },
};

const STATE_ICONS: Record<string, string> = {
  free: '✓',
  reserved: '⏰',
  seated: '🍽',
  check_dropped: '💳',
  needs_bussing: '🧹',
  out_of_service: '⛔',
};

interface TableNodeProps {
  id: string;
  label: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  state?: TableState;
  mode: 'editor' | 'service';
  selected: boolean;
  onSelect: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
}

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return '0m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h${mins % 60}m`;
}

export function TableNode({
  id, label, shape, x, y, width, height, rotation, capacity,
  state, mode, selected, onSelect, onDragEnd,
}: TableNodeProps) {
  const stateValue = state?.state || 'free';
  const colors = STATE_COLORS[stateValue] || STATE_COLORS.free;
  const isLongSit = stateValue === 'seated' && state?.seated_at &&
    (Date.now() - new Date(state.seated_at).getTime()) > 90 * 60000;

  const draggable = mode === 'editor';
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable={draggable}
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd?.(id, Math.round(node.x() / 20) * 20, Math.round(node.y() / 20) * 20);
      }}
    >
      {/* Shape */}
      {shape === 'circle' || shape === 'round' ? (
        <Circle
          x={cx}
          y={cy}
          radius={Math.min(width, height) / 2 - 2}
          fill={colors.fill}
          stroke={selected ? '#F04E37' : isLongSit ? '#EF4444' : colors.stroke}
          strokeWidth={selected ? 3 : 2}
        />
      ) : (
        <Rect
          width={width}
          height={height}
          cornerRadius={shape === 'booth' ? 12 : shape === 'bar_stool' ? 20 : 6}
          fill={colors.fill}
          stroke={selected ? '#F04E37' : isLongSit ? '#EF4444' : colors.stroke}
          strokeWidth={selected ? 3 : 2}
        />
      )}

      {/* Label */}
      <Text
        x={0}
        y={cy - 14}
        width={width}
        text={label}
        fontSize={13}
        fontStyle="bold"
        fill="#111"
        align="center"
      />

      {/* Capacity or party size */}
      <Text
        x={0}
        y={cy + 2}
        width={width}
        text={state?.party_size ? `${state.party_size}/${capacity}` : `${capacity}`}
        fontSize={10}
        fill="#666"
        align="center"
      />

      {/* State icon + timer (service mode) */}
      {mode === 'service' && (
        <>
          <Text
            x={width - 18}
            y={2}
            text={STATE_ICONS[stateValue] || ''}
            fontSize={12}
          />
          {stateValue === 'seated' && state?.seated_at && (
            <Text
              x={0}
              y={cy + 16}
              width={width}
              text={`⏱ ${timeAgo(state.seated_at)}`}
              fontSize={9}
              fill={isLongSit ? '#EF4444' : '#666'}
              fontStyle={isLongSit ? 'bold' : 'normal'}
              align="center"
            />
          )}
        </>
      )}
    </Group>
  );
}
