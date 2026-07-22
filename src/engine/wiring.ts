import type { ComponentInstance, Point, Rotation, Wire, WireType, Junction } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'

/** IEC 60617-standard colors, per the wire palette documented in CLAUDE.md. */
export const WIRE_TYPE_COLORS: Record<WireType, string> = {
  L1: '#8b5a2b',
  L2: '#1f2937',
  L3: '#6b7280',
  N: '#3b82f6',
  PE: '#22c55e',
  DC_POS: '#ef4444',
  DC_0: '#1f2937',
  signal: '#a855f7',
}

/** Color for a wire with no assigned electrical role yet. */
export const DEFAULT_WIRE_COLOR = '#9ca3af'

export function wireColor(wireType: WireType | undefined): string {
  return wireType ? WIRE_TYPE_COLORS[wireType] : DEFAULT_WIRE_COLOR
}

/** Rotates a point (already relative to the pivot) by a quarter-turn multiple, clockwise in screen (y-down) space. */
function rotatePoint(p: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return p
    case 90:
      return { x: -p.y, y: p.x }
    case 180:
      return { x: -p.x, y: -p.y }
    case 270:
      return { x: p.y, y: -p.x }
  }
}

/**
 * Absolute canvas position of a component pin, accounting for the component's
 * position and rotation. Mirrors the rotation pivot used by ComponentSymbol
 * (rotate around the symbol's own center, not its top-left corner).
 */
export function getPinPosition(instance: ComponentInstance, pinId: string): Point {
  const def = getComponentDefinition(instance.type)
  const pin = def.pins.find((p) => p.id === pinId)
  if (!pin) throw new Error(`Unknown pin "${pinId}" on component type "${instance.type}"`)

  const halfW = def.width / 2
  const halfH = def.height / 2
  const center = { x: instance.x + halfW, y: instance.y + halfH }
  const local = { x: pin.offset.x - halfW, y: pin.offset.y - halfH }
  const rotated = rotatePoint(local, instance.rotation)
  return { x: center.x + rotated.x, y: center.y + rotated.y }
}

function resolveEndpoint(components: Record<string, ComponentInstance>, endpoint: { componentId: string; pinId: string }): Point | null {
  const instance = components[endpoint.componentId]
  if (!instance) return null
  return getPinPosition(instance, endpoint.pinId)
}

/** Manhattan (orthogonal) route between two points: a single elbow, horizontal leg first. */
export function routeOrthogonal(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) return [from, to]
  const elbow: Point = { x: to.x, y: from.y }
  return [from, elbow, to]
}

/** Resolves a wire's rendered polyline: explicit manual points if set, otherwise a live orthogonal route. */
export function getWirePath(wire: Wire, components: Record<string, ComponentInstance>): Point[] | null {
  if (wire.points && wire.points.length >= 2) return wire.points
  const from = resolveEndpoint(components, wire.from)
  const to = resolveEndpoint(components, wire.to)
  if (!from || !to) return null
  return routeOrthogonal(from, to)
}

const EPSILON = 0.01

/** True if point p lies on segment [a,b] (inclusive of endpoints), for axis-aligned or general segments. */
function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)
  if (Math.abs(cross) > EPSILON) return false
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
  if (dot < -EPSILON) return false
  const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  return dot <= lenSq + EPSILON
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON
}

/**
 * Finds T-junctions: points where one wire's endpoint pin lands on the
 * interior of another wire's routed segment (not on that other wire's own
 * endpoints, which would just be a shared-pin connection, not a tap).
 * Two independent wires merely crossing at a non-endpoint point on both
 * sides are NOT joined here — per IEC convention, a crossing without a
 * shared endpoint is not an electrical connection.
 *
 * Only a wire with an explicit manual `points` override can be a tap
 * *host*. Every wire is auto-routed today (see getWirePath), and
 * routeOrthogonal's elbow bend is an arbitrary algorithmic choice, not
 * something the user placed — on any grid-aligned layout (the common case
 * for ladder-style schematics) an unrelated component's pin will routinely
 * end up sitting on some other wire's auto-routed leg purely by coincidence.
 * Treating that as a real electrical tap produced silently wrong circuits
 * (verified via engine/solver.ts tests). Once manual waypoint editing ships,
 * a host wire the user explicitly routed through a pin reflects real intent
 * and this will start finding taps again with no further changes needed.
 */
export function findJunctions(wires: Wire[], components: Record<string, ComponentInstance>): Junction[] {
  const paths = wires.map((wire) => ({ wire, path: getWirePath(wire, components) }))
  const junctions = new Map<string, Junction>()

  for (const { wire: tapWire } of paths) {
    for (const endpoint of [tapWire.from, tapWire.to]) {
      const tapPoint = resolveEndpoint(components, endpoint)
      if (!tapPoint) continue

      for (const { wire: hostWire, path } of paths) {
        if (hostWire.id === tapWire.id || !path) continue
        if (!hostWire.points || hostWire.points.length < 2) continue
        const hostFrom = path[0]
        const hostTo = path[path.length - 1]
        if (pointsEqual(tapPoint, hostFrom) || pointsEqual(tapPoint, hostTo)) continue

        for (let i = 0; i < path.length - 1; i++) {
          if (pointOnSegment(tapPoint, path[i], path[i + 1])) {
            const key = `${Math.round(tapPoint.x)}:${Math.round(tapPoint.y)}`
            const existing = junctions.get(key)
            if (existing) {
              if (!existing.wireIds.includes(tapWire.id)) existing.wireIds.push(tapWire.id)
              if (!existing.wireIds.includes(hostWire.id)) existing.wireIds.push(hostWire.id)
            } else {
              junctions.set(key, { point: tapPoint, wireIds: [tapWire.id, hostWire.id] })
            }
            break
          }
        }
      }
    }
  }

  return [...junctions.values()]
}
