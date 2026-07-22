import { Layer, Line } from 'react-konva'
import { GRID_SIZE } from '@/store/canvas'

interface GridLayerProps {
  scale: number
  position: { x: number; y: number }
  width: number
  height: number
}

/** Draws only the grid lines intersecting the current viewport, at a step that thins out as you zoom in/out. */
export function GridLayer({ scale, position, width, height }: GridLayerProps) {
  let step = GRID_SIZE
  while (step * scale < 12) step *= 5
  while (step * scale > 120) step /= 5

  const startX = Math.floor(-position.x / scale / step) * step
  const endX = startX + width / scale + step
  const startY = Math.floor(-position.y / scale / step) * step
  const endY = startY + height / scale + step

  const lines: React.ReactElement[] = []

  for (let x = startX; x <= endX; x += step) {
    const isAxis = x === 0
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, startY, x, endY]}
        stroke={isAxis ? '#6b7280' : '#374151'}
        strokeWidth={isAxis ? 1 / scale : 0.5 / scale}
        listening={false}
      />,
    )
  }
  for (let y = startY; y <= endY; y += step) {
    const isAxis = y === 0
    lines.push(
      <Line
        key={`h${y}`}
        points={[startX, y, endX, y]}
        stroke={isAxis ? '#6b7280' : '#374151'}
        strokeWidth={isAxis ? 1 / scale : 0.5 / scale}
        listening={false}
      />,
    )
  }

  return <Layer listening={false}>{lines}</Layer>
}
