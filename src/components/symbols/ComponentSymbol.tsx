import { Circle, Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { ComponentInstance } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { snapToGrid } from '@/store/canvas'

const PIN_COLOR: Record<string, string> = {
  power: '#f59e0b',
  power_no: '#f59e0b',
  power_nc: '#f59e0b',
  coil: '#3b82f6',
  auxiliary_no: '#10b981',
  auxiliary_nc: '#ef4444',
  signal: '#a855f7',
}

interface ComponentSymbolProps {
  instance: ComponentInstance
  selected: boolean
  snapEnabled: boolean
  onSelect: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}

export function ComponentSymbol({
  instance,
  selected,
  snapEnabled,
  onSelect,
  onMove,
}: ComponentSymbolProps) {
  const def = getComponentDefinition(instance.type)
  const halfW = def.width / 2
  const halfH = def.height / 2

  // The group pivots around the symbol's own center (via offset) so rotation
  // swings it in place instead of around the top-left corner.
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const topLeftX = node.x() - halfW
    const topLeftY = node.y() - halfH
    const x = snapEnabled ? snapToGrid(topLeftX) : topLeftX
    const y = snapEnabled ? snapToGrid(topLeftY) : topLeftY
    node.position({ x: x + halfW, y: y + halfH })
    onMove(instance.id, x, y)
  }

  return (
    <Group
      x={instance.x + halfW}
      y={instance.y + halfH}
      offsetX={halfW}
      offsetY={halfH}
      rotation={instance.rotation}
      draggable
      onClick={() => onSelect(instance.id)}
      onTap={() => onSelect(instance.id)}
      onDragStart={() => onSelect(instance.id)}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={def.width}
        height={def.height}
        fill="#1f2937"
        stroke={selected ? '#60a5fa' : '#9ca3af'}
        strokeWidth={selected ? 2 : 1}
        cornerRadius={2}
      />
      <Text
        text={instance.label}
        width={def.width}
        height={def.height}
        align="center"
        verticalAlign="middle"
        fill="#e5e7eb"
        fontSize={12}
      />
      {def.pins.map((pin) => (
        <Circle
          key={pin.id}
          x={pin.offset.x}
          y={pin.offset.y}
          radius={3}
          fill={PIN_COLOR[pin.kind] ?? '#d1d5db'}
        />
      ))}
    </Group>
  )
}
