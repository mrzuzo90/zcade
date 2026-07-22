import { useMemo } from 'react'
import { Circle, Layer, Line } from 'react-konva'
import type { ComponentInstance, Point } from '@/types/circuit'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import { findJunctions, getPinPosition, getWirePath, routeOrthogonal, wireColor } from '@/engine/wiring'
import { buildCircuitGraph } from '@/engine/graph'

interface WireLayerProps {
  components: Record<string, ComponentInstance>
  previewPoint: Point | null
}

export function WireLayer({ components, previewPoint }: WireLayerProps) {
  const wires = useWireStore((s) => s.wires)
  const order = useWireStore((s) => s.order)
  const selectedWireId = useWireStore((s) => s.selectedWireId)
  const pendingFrom = useWireStore((s) => s.pendingFrom)
  const selectWire = useWireStore((s) => s.selectWire)
  const selectComponent = useCanvasStore((s) => s.selectComponent)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const simPinToNet = useSimulationStore((s) => s.pinToNet)
  const simNetPotentials = useSimulationStore((s) => s.netPotentials)

  const wireList = useMemo(() => order.map((id) => wires[id]).filter(Boolean), [order, wires])
  const junctions = useMemo(() => findJunctions(wireList, components), [wireList, components])
  const graph = useMemo(() => buildCircuitGraph(components, wireList), [components, wireList])

  const selectedNetId = selectedWireId ? graph.nets.find((net) => net.wireIds.includes(selectedWireId))?.id : undefined

  const pendingComponent = pendingFrom ? components[pendingFrom.componentId] : undefined
  const previewFrom = pendingFrom && pendingComponent ? getPinPosition(pendingComponent, pendingFrom.pinId) : null
  const previewPath = previewFrom && previewPoint ? routeOrthogonal(previewFrom, previewPoint) : null

  return (
    <Layer>
      {wireList.map((wire) => {
        const path = getWirePath(wire, components)
        if (!path) return null
        const isSelected = wire.id === selectedWireId
        const isInSelectedNet = selectedNetId !== undefined && graph.pinToNet[`${wire.from.componentId}:${wire.from.pinId}`] === selectedNetId
        const fromKey = `${wire.from.componentId}:${wire.from.pinId}`
        const isEnergized = isRunning && (simNetPotentials[simPinToNet[fromKey]]?.length ?? 0) > 0
        const points = path.flatMap((p) => [p.x, p.y])
        return (
          <Line
            key={wire.id}
            points={points}
            stroke={isEnergized ? '#facc15' : isSelected || isInSelectedNet ? '#60a5fa' : wireColor(wire.wireType)}
            strokeWidth={isEnergized || isSelected ? 3 : isInSelectedNet ? 2.5 : 2}
            shadowColor={isEnergized ? '#facc15' : undefined}
            shadowBlur={isEnergized ? 6 : 0}
            shadowOpacity={isEnergized ? 0.7 : 0}
            hitStrokeWidth={10}
            lineJoin="round"
            onClick={(e) => {
              e.cancelBubble = true
              selectWire(wire.id)
              selectComponent(null)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              selectWire(wire.id)
              selectComponent(null)
            }}
          />
        )
      })}

      {previewPath && (
        <Line
          points={previewPath.flatMap((p) => [p.x, p.y])}
          stroke="#60a5fa"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}

      {junctions.map((junction) => (
        <Circle
          key={`${junction.point.x}:${junction.point.y}`}
          x={junction.point.x}
          y={junction.point.y}
          radius={3.5}
          fill="#e5e7eb"
          listening={false}
        />
      ))}
    </Layer>
  )
}
