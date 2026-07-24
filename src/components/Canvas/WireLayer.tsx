import { useMemo, useRef } from 'react'
import { Circle, Layer, Line } from 'react-konva'
import type Konva from 'konva'
import type { ComponentInstance, Point } from '@/types/circuit'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import { dragWireSegment, getPinPosition, pathWithHops, pathWithLaneOffsets, routeOrthogonal, wireColor } from '@/engine/wiring'
import type { LaneShift } from '@/engine/wiring'
import { buildCircuitGraph } from '@/engine/graph'
import { WireGeometryCache } from '@/engine/wireGeometryCache'

interface WireLayerProps {
  components: Record<string, ComponentInstance>
  previewPoint: Point | null
}

/** Midpoint of each segment in a path, paired with that segment's index — used to place drag handles. */
function segmentMidpoints(path: Point[]): { index: number; point: Point }[] {
  const result: { index: number; point: Point }[] = []
  for (let i = 0; i < path.length - 1; i++) {
    result.push({ index: i, point: { x: (path[i].x + path[i + 1].x) / 2, y: (path[i].y + path[i + 1].y) / 2 } })
  }
  return result
}

export function WireLayer({ components, previewPoint }: WireLayerProps) {
  const wires = useWireStore((s) => s.wires)
  const order = useWireStore((s) => s.order)
  const selectedWireId = useWireStore((s) => s.selectedWireId)
  const pendingFrom = useWireStore((s) => s.pendingFrom)
  const selectWire = useWireStore((s) => s.selectWire)
  const setWirePoints = useWireStore((s) => s.setWirePoints)
  const selectComponent = useCanvasStore((s) => s.selectComponent)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const simPinToNet = useSimulationStore((s) => s.pinToNet)
  const simNetPotentials = useSimulationStore((s) => s.netPotentials)

  // Held across renders (see engine/wireGeometryCache.ts): memoizes each
  // wire's resolved path plus junction/crossing detection, so dragging one
  // component only redoes geometry work for the wires actually touching it
  // instead of every wire on the sheet (Phase A W2 ROUTE perf budget).
  const geometryCache = useRef(new WireGeometryCache()).current

  const wireList = useMemo(() => order.map((id) => wires[id]).filter(Boolean), [order, wires])
  const { paths, junctions, crossings, overlaps } = useMemo(
    () => geometryCache.update(wireList, components),
    [geometryCache, wireList, components],
  )
  const graph = useMemo(() => buildCircuitGraph(components, wireList), [components, wireList])

  // wireId -> hop points to render ON that wire. Deterministic tie-break: of
  // a crossing pair, whichever wire is LATER in draw order gets the hop
  // (reads as "this one passes over the other").
  const hopsByWire = useMemo(() => {
    const map = new Map<string, Point[]>()
    for (const crossing of crossings) {
      const [idA, idB] = crossing.wireIds
      const laterId = order.indexOf(idA) > order.indexOf(idB) ? idA : idB
      const list = map.get(laterId)
      if (list) list.push(crossing.point)
      else map.set(laterId, [crossing.point])
    }
    return map
  }, [crossings, order])

  const LANE_SPACING = 4

  // wireId -> LaneShift[] to apply to that wire's path. Lane index within a
  // group is assigned by each wire's position in `order` (same determinism
  // rule as hopsByWire), then centered around 0 so the group fans out
  // symmetrically instead of all shifting the same direction.
  const laneShiftsByWire = useMemo(() => {
    const map = new Map<string, LaneShift[]>()
    for (const overlap of overlaps) {
      const sortedIds = [...overlap.wireIds].sort((a, b) => order.indexOf(a) - order.indexOf(b))
      const count = sortedIds.length
      sortedIds.forEach((wireId, laneIndex) => {
        const offset = (laneIndex - (count - 1) / 2) * LANE_SPACING
        const shift: LaneShift = { axis: overlap.axis, fixed: overlap.fixed, start: overlap.start, end: overlap.end, offset }
        const list = map.get(wireId)
        if (list) list.push(shift)
        else map.set(wireId, [shift])
      })
    }
    return map
  }, [overlaps, order])

  const selectedNetId = selectedWireId ? graph.nets.find((net) => net.wireIds.includes(selectedWireId))?.id : undefined

  const pendingComponent = pendingFrom ? components[pendingFrom.componentId] : undefined
  const previewFrom = pendingFrom && pendingComponent ? getPinPosition(pendingComponent, pendingFrom.pinId) : null
  const previewPath = previewFrom && previewPoint ? routeOrthogonal(previewFrom, previewPoint) : null

  return (
    <Layer>
      {wireList.map((wire) => {
        const path = paths[wire.id]
        if (!path) return null
        const isSelected = wire.id === selectedWireId
        const isInSelectedNet = selectedNetId !== undefined && graph.pinToNet[`${wire.from.componentId}:${wire.from.pinId}`] === selectedNetId
        const fromKey = `${wire.from.componentId}:${wire.from.pinId}`
        const isEnergized = isRunning && (simNetPotentials[simPinToNet[fromKey]]?.length ?? 0) > 0
        const laneShifts = laneShiftsByWire.get(wire.id)
        const laneAdjustedPath = laneShifts && laneShifts.length > 0 ? pathWithLaneOffsets(path, laneShifts) : path
        const hops = hopsByWire.get(wire.id)
        const renderedPath = hops && hops.length > 0 ? pathWithHops(laneAdjustedPath, hops) : laneAdjustedPath
        const points = renderedPath.flatMap((p) => [p.x, p.y])
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

      {!isRunning &&
        selectedWireId &&
        (() => {
          const selectedPath = paths[selectedWireId]
          if (!selectedPath) return null
          return segmentMidpoints(selectedPath).map(({ index, point }) => (
            <Circle
              key={`handle-${selectedWireId}-${index}`}
              x={point.x}
              y={point.y}
              radius={5}
              fill="#60a5fa"
              stroke="#1e3a8a"
              strokeWidth={1}
              draggable
              dragBoundFunc={function (this: Konva.Node, pos) {
                // Lock the drag gesture to the axis perpendicular to the
                // segment's own orientation — dragging along a segment's own
                // axis wouldn't change its rendered shape (see
                // dragWireSegment's doc comment), so that component is fixed
                // rather than left to wobble uncontrollably.
                const start = this.getAbsolutePosition()
                const segStart = selectedPath[index]
                const segEnd = selectedPath[index + 1]
                const horizontal = Math.abs(segStart.y - segEnd.y) < 0.01
                return horizontal ? { x: start.x, y: pos.y } : { x: pos.x, y: start.y }
              }}
              onDragEnd={(e) => {
                // Read the drag's local-coordinate delta, then hand off to
                // dragWireSegment/setWirePoints as the new source of truth.
                // No need to manually reset this node's position: the
                // resulting store update re-renders WireLayer with a fresh
                // `selectedPath`, and this Circle's x/y are controlled props
                // recomputed from it every render.
                const delta = { x: e.target.x() - point.x, y: e.target.y() - point.y }
                const nextPoints = dragWireSegment(selectedPath, index, delta)
                // dragWireSegment returns the SAME array reference when the
                // perpendicular delta rounds to ~0 (see its doc comment) —
                // skip committing a no-op edit so merely selecting a wire
                // and releasing the handle without really dragging it can't
                // freeze an until-then-live auto-routed wire into a manual
                // override.
                if (nextPoints === selectedPath) return
                setWirePoints(selectedWireId, nextPoints)
              }}
              onClick={(e) => {
                e.cancelBubble = true
              }}
            />
          ))
        })()}

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
