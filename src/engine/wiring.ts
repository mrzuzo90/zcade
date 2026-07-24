import type { ComponentInstance, Crossing, Junction, Overlap, Point, Rotation, Wire, WireType } from '@/types/circuit'
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

function sameEndpointPin(
  a: { componentId: string; pinId: string },
  b: { componentId: string; pinId: string },
): boolean {
  return a.componentId === b.componentId && a.pinId === b.pinId
}

/**
 * Applies a manual drag to one segment of a wire's rendered path, producing
 * a new explicit `points` override (see Wire.points / getWirePath) that
 * preserves both pin endpoints and the orthogonal (Manhattan) invariant of
 * every segment in the path. This is the core geometry behind the
 * waypoint-editing UI in WireLayer — its result is what gets committed via
 * the history-backed `setWirePoints` wire-store command, so it's the only
 * thing that ever needs testing in isolation from Konva/React.
 *
 * `segmentIndex` identifies the segment `path[segmentIndex] -> path[segmentIndex + 1]`.
 * Only the component of `delta` perpendicular to that segment's own
 * orientation is applied — dragging along a segment's own axis wouldn't
 * change its rendered shape, so that component is dropped rather than
 * silently producing a confusing no-op-looking edit.
 *
 * If the dragged segment touches a path endpoint (a pin — immovable), a new
 * bend point is inserted at that end instead of relocating the pin; this is
 * what lets even a bare 2-point (straight) or 3-point (single-elbow) wire
 * gain its first manual jog. An interior segment (already a bend on both
 * ends) is simply shifted in place with no new points needed: Manhattan
 * routing alternates orientation segment-to-segment, so both neighboring
 * segments stay perpendicular to the dragged one and merely get longer or
 * shorter — see the accompanying tests for the geometric argument.
 */
export function dragWireSegment(path: Point[], segmentIndex: number, delta: Point): Point[] {
  if (segmentIndex < 0 || segmentIndex >= path.length - 1) return path
  const a = path[segmentIndex]
  const b = path[segmentIndex + 1]
  const horizontal = Math.abs(a.y - b.y) <= EPSILON
  const perp: Point = horizontal ? { x: 0, y: delta.y } : { x: delta.x, y: 0 }
  if (Math.abs(perp.x) < EPSILON && Math.abs(perp.y) < EPSILON) return path

  const startIsEndpoint = segmentIndex === 0
  const endIsEndpoint = segmentIndex === path.length - 2

  const newStart: Point = { x: a.x + perp.x, y: a.y + perp.y }
  const newEnd: Point = { x: b.x + perp.x, y: b.y + perp.y }

  const before = path.slice(0, segmentIndex)
  const after = path.slice(segmentIndex + 2)
  const middle: Point[] = []
  middle.push(...(startIsEndpoint ? [a, newStart] : [newStart]))
  middle.push(...(endIsEndpoint ? [newEnd, b] : [newEnd]))

  return [...before, ...middle, ...after]
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
 *
 * `onlyInvolving`, if given, restricts the search to tap/host pairs where AT
 * LEAST ONE side's wire id is in the set — every pair where neither wire is
 * in the set is skipped entirely. This is purely a perf narrowing used by
 * `WireGeometryCache`'s incremental recompute (a single component move only
 * changes the handful of wires touching it, not all of them); omitting it
 * (the default) reproduces the exact full O(wires²) behavior every existing
 * caller (graph.ts, tests) already relies on, so this is additive and
 * backward compatible.
 */
export function findJunctions(
  wires: Wire[],
  components: Record<string, ComponentInstance>,
  onlyInvolving?: Set<string>,
): Junction[] {
  const paths = wires.map((wire) => ({ wire, path: getWirePath(wire, components) }))
  const junctions = new Map<string, Junction>()

  // Only a wire with a manual `points` override can ever be a host (see doc
  // comment above) — in any real schematic that's a small minority of wires,
  // so narrowing the host candidate list up front turns the inner loop from
  // O(all wires) into O(manually-routed wires) for every tapWire, not just
  // the `onlyInvolving`-restricted case below.
  const hostCandidates = paths.filter((p) => p.wire.points && p.wire.points.length >= 2)

  function checkPair(tapWire: Wire, tapPoint: Point, hostWire: Wire, path: Point[]) {
    if (hostWire.id === tapWire.id) return
    const hostFrom = path[0]
    const hostTo = path[path.length - 1]
    if (pointsEqual(tapPoint, hostFrom) || pointsEqual(tapPoint, hostTo)) return

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

  function checkTapWire(tapWire: Wire, hosts: typeof hostCandidates) {
    for (const endpoint of [tapWire.from, tapWire.to]) {
      const tapPoint = resolveEndpoint(components, endpoint)
      if (!tapPoint) continue
      for (const { wire: hostWire, path } of hosts) {
        if (path) checkPair(tapWire, tapPoint, hostWire, path)
      }
    }
  }

  if (!onlyInvolving) {
    for (const { wire: tapWire } of paths) checkTapWire(tapWire, hostCandidates)
  } else {
    // Every (tapWire, hostWire) ordered pair where at least one side is in
    // `onlyInvolving`, visited exactly once, without ever iterating the full
    // O(wires) tapWire loop: pass A covers every changed wire as tap (host
    // list unrestricted, since an unchanged host can still gain/lose a tap
    // relationship with a changed wire); pass B covers the remaining
    // (unchanged) wires as tap, but only against changed hosts.
    const changedHostCandidates = hostCandidates.filter((p) => onlyInvolving.has(p.wire.id))
    for (const { wire: tapWire } of paths) {
      if (onlyInvolving.has(tapWire.id)) {
        checkTapWire(tapWire, hostCandidates)
      } else {
        checkTapWire(tapWire, changedHostCandidates)
      }
    }
  }

  return [...junctions.values()]
}

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function pathBBox(path: Point[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of path) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
}

/**
 * General 2D segment intersection (works for any pair of segments, though in
 * practice ours are always axis-aligned). Returns null for parallel/collinear
 * segments (denominator ~0 — treated as "no crossing" rather than reasoning
 * about overlapping-collinear geometry, out of scope for this cosmetic
 * feature) or when the intersection lands at or within EPS of either
 * segment's own endpoint — that's a shared-connection or T-tap case, handled
 * by completeWire's duplicate rejection / findJunctions respectively, never a
 * "just crossing" case.
 */
function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x
  const d1y = p2.y - p1.y
  const d2x = p4.x - p3.x
  const d2y = p4.y - p3.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return null

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom
  const EPS = 1e-6
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null

  return { x: p1.x + t * d1x, y: p1.y + t * d1y }
}

/**
 * Finds crossings: points where two wires' rendered paths pass over one
 * another at a point interior to BOTH paths — neither wire's own endpoint,
 * so never an electrical connection (that's findJunctions' job, and it only
 * fires at an endpoint-on-segment-interior point, which segmentIntersection
 * above deliberately excludes). Purely a rendering concern, consumed by
 * WireLayer/pathWithHops to draw a small arc "hop" on one of the two wires.
 *
 * A per-wire bounding-box broad phase culls most pairs before any segment
 * math runs — real schematics are sparse (most wire pairs are nowhere near
 * each other), which keeps this well under budget even at hundreds of wires
 * (see tests/engine/wiring-perf.test.ts). `onlyInvolving` has the same
 * incremental-recompute meaning as on findJunctions.
 */
interface CrossingEntry {
  wire: Wire
  path: Point[]
  bbox: BBox
}

function checkCrossingPair(a: CrossingEntry, b: CrossingEntry, crossings: Crossing[]) {
  if (
    sameEndpointPin(a.wire.from, b.wire.from) ||
    sameEndpointPin(a.wire.from, b.wire.to) ||
    sameEndpointPin(a.wire.to, b.wire.from) ||
    sameEndpointPin(a.wire.to, b.wire.to)
  ) {
    return
  }
  if (!bboxesOverlap(a.bbox, b.bbox)) return

  for (let si = 0; si < a.path.length - 1; si++) {
    for (let sj = 0; sj < b.path.length - 1; sj++) {
      const pt = segmentIntersection(a.path[si], a.path[si + 1], b.path[sj], b.path[sj + 1])
      if (pt) {
        crossings.push({ point: pt, wireIds: [a.wire.id, b.wire.id] })
        return
      }
    }
  }
}

export function findCrossings(
  wires: Wire[],
  components: Record<string, ComponentInstance>,
  onlyInvolving?: Set<string>,
): Crossing[] {
  const entries: CrossingEntry[] = wires
    .map((wire) => ({ wire, path: getWirePath(wire, components) }))
    .filter((e): e is { wire: Wire; path: Point[] } => e.path !== null && e.path.length >= 2)
    .map((e) => ({ ...e, bbox: pathBBox(e.path) }))

  const crossings: Crossing[] = []

  if (!onlyInvolving) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        checkCrossingPair(entries[i], entries[j], crossings)
      }
    }
    return crossings
  }

  // Only unordered pairs where at least one wire is in `onlyInvolving`:
  // changed-vs-changed (i<j within the small changed subset) plus
  // changed-vs-unchanged (full cross product against the small changed
  // subset) — never the O(wires²) unchanged-vs-unchanged combinations,
  // which are provably unaffected and already retained by the caller.
  const changed = entries.filter((e) => onlyInvolving.has(e.wire.id))
  const unchanged = entries.filter((e) => !onlyInvolving.has(e.wire.id))

  for (let i = 0; i < changed.length; i++) {
    for (let j = i + 1; j < changed.length; j++) {
      checkCrossingPair(changed[i], changed[j], crossings)
    }
  }
  for (const c of changed) {
    for (const u of unchanged) {
      checkCrossingPair(c, u, crossings)
    }
  }

  return crossings
}

interface LineEntry {
  wireId: string
  start: number
  end: number
}

/** `h:<y>` for a horizontal segment, `v:<x>` for vertical — null if the segment isn't axis-aligned (shouldn't happen for orthogonal routes, but guarded rather than assumed). */
function lineKey(a: Point, b: Point): string | null {
  if (Math.abs(a.y - b.y) <= EPSILON) return `h:${a.y}`
  if (Math.abs(a.x - b.x) <= EPSILON) return `v:${a.x}`
  return null
}

/**
 * Finds groups of wires whose routed paths share a fully-overlapping
 * collinear segment (same infinite line, overlapping ranges) — the case
 * `segmentIntersection` above deliberately excludes (parallel/collinear
 * pairs return null there, since that function only detects perpendicular
 * crossings). Purely a rendering concern, consumed by `pathWithLaneOffsets`
 * to fan overlapping wires into distinct parallel lanes so none of them
 * render fully hidden behind another.
 *
 * Groups are found via a standard "merge overlapping intervals" sweep per
 * canonical line: entries are sorted by their start coordinate, and any
 * entry whose start falls before the running cluster's end is folded into
 * that cluster (this is the same algorithm used to find connected
 * components of an interval-overlap graph, so a chain of 3+ wires with
 * staggered-but-connected ranges is grouped correctly, not just exact pairs).
 * Two clusters on the exact same infinite line that don't actually overlap
 * (e.g. a busbar row far to the left, and an unrelated pair of terminals far
 * to the right, both at the same y) are correctly kept as separate groups.
 *
 * `onlyInvolving` has the same incremental-recompute meaning as on
 * `findJunctions`/`findCrossings`.
 */
export function findOverlaps(
  wires: Wire[],
  components: Record<string, ComponentInstance>,
  onlyInvolving?: Set<string>,
): Overlap[] {
  const byLine = new Map<string, LineEntry[]>()

  for (const wire of wires) {
    const path = getWirePath(wire, components)
    if (!path) continue
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      const key = lineKey(a, b)
      if (!key) continue
      const horizontal = key.startsWith('h:')
      const start = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
      const end = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
      const entry: LineEntry = { wireId: wire.id, start, end }
      const list = byLine.get(key)
      if (list) list.push(entry)
      else byLine.set(key, [entry])
    }
  }

  const overlaps: Overlap[] = []

  for (const [key, entries] of byLine) {
    const horizontal = key.startsWith('h:')
    const fixed = Number(key.slice(2))
    const sorted = [...entries].sort((a, b) => a.start - b.start)

    let i = 0
    while (i < sorted.length) {
      let clusterEnd = sorted[i].end
      const clusterIdx = [i]
      let j = i + 1
      while (j < sorted.length && sorted[j].start < clusterEnd - EPSILON) {
        clusterEnd = Math.max(clusterEnd, sorted[j].end)
        clusterIdx.push(j)
        j++
      }

      const clusterEntries = clusterIdx.map((idx) => sorted[idx])
      const wireIds = [...new Set(clusterEntries.map((e) => e.wireId))]
      const clusterStart = Math.min(...clusterEntries.map((e) => e.start))

      if (wireIds.length >= 2 && (!onlyInvolving || wireIds.some((id) => onlyInvolving.has(id)))) {
        overlaps.push({ axis: horizontal ? 'h' : 'v', fixed, start: clusterStart, end: clusterEnd, wireIds })
      }
      i = j
    }
  }

  return overlaps
}

export interface LaneShift {
  axis: 'h' | 'v'
  /** The shared coordinate this shift applies to: y for a horizontal segment, x for a vertical one. */
  fixed: number
  /** Range along the moving axis (x for horizontal, y for vertical) the offset applies within. */
  start: number
  end: number
  /** Perpendicular offset to apply within [start, end], in px (positive = down/right). */
  offset: number
}

/**
 * Returns `path` with each segment nudged perpendicular by its matching
 * `LaneShift`'s offset, within that shift's [start, end] range along the
 * segment — the rendering counterpart to `findOverlaps`. A segment with no
 * matching shift (different axis, or `fixed` coordinate not within
 * EPSILON) is left untouched. A segment only partially covered by its
 * shift's range gets a short perpendicular jog in and out of the offset
 * corridor rather than being fully displaced, so it still meets its own
 * pin/bend endpoints exactly. Endpoints of the overall path are always
 * preserved. When a shift covers a segment's entire span, the jog-in/out
 * points land exactly on that segment's own start/end (offset 0) —
 * harmless zero-length duplicate points, not a bug.
 *
 * Note: this looks up at most one matching shift per segment (by
 * axis+fixed), so a single wire with two separate segments on the exact
 * same canonical line but different shift ranges is not supported — not a
 * real scenario for the Manhattan-routed wires this app produces.
 */
export function pathWithLaneOffsets(path: Point[], shifts: LaneShift[]): Point[] {
  if (shifts.length === 0 || path.length < 2) return path

  const result: Point[] = [path[0]]
  for (let i = 0; i < path.length - 1; i++) {
    const segStart = path[i]
    const segEnd = path[i + 1]
    const horizontal = Math.abs(segStart.y - segEnd.y) <= EPSILON
    const axis: 'h' | 'v' = horizontal ? 'h' : 'v'
    const fixed = horizontal ? segStart.y : segStart.x
    const shift = shifts.find((s) => s.axis === axis && Math.abs(s.fixed - fixed) <= EPSILON)

    if (!shift) {
      result.push(segEnd)
      continue
    }

    const segMin = horizontal ? Math.min(segStart.x, segEnd.x) : Math.min(segStart.y, segEnd.y)
    const segMax = horizontal ? Math.max(segStart.x, segEnd.x) : Math.max(segStart.y, segEnd.y)
    const overlapStart = Math.max(segMin, shift.start)
    const overlapEnd = Math.min(segMax, shift.end)

    if (overlapEnd <= overlapStart + EPSILON) {
      result.push(segEnd)
      continue
    }

    const increasing = horizontal ? segEnd.x > segStart.x : segEnd.y > segStart.y
    const enter = increasing ? overlapStart : overlapEnd
    const exit = increasing ? overlapEnd : overlapStart

    const pointAt = (pos: number, offsetPerp: number): Point =>
      horizontal ? { x: pos, y: fixed + offsetPerp } : { x: fixed + offsetPerp, y: pos }

    result.push(pointAt(enter, 0))
    result.push(pointAt(enter, shift.offset))
    result.push(pointAt(exit, shift.offset))
    result.push(pointAt(exit, 0))
    result.push(segEnd)
  }
  return result
}

const HOP_SAMPLES = 8

/**
 * Returns `path` with a small semicircular "hop" bump inserted at each point
 * in `hopPoints` that lies on one of its segments — the visual counterpart
 * to findCrossings. A hop this function inserts always fully connects back
 * into the original polyline (same start/end, same overall route), so it's
 * safe to feed the result straight into a Konva Line's `points` in place of
 * the plain path.
 *
 * Hops too close to a segment's own ends (closer than `radius`) are skipped
 * rather than drawn squashed/clipped — that segment is short enough relative
 * to the hop that a plain crossing (no bump) reads fine.
 */
export function pathWithHops(path: Point[], hopPoints: Point[], radius = 8): Point[] {
  if (hopPoints.length === 0 || path.length < 2) return path

  const result: Point[] = [path[0]]
  for (let i = 0; i < path.length - 1; i++) {
    const segStart = path[i]
    const segEnd = path[i + 1]
    const dx = segEnd.x - segStart.x
    const dy = segEnd.y - segStart.y
    const len = Math.hypot(dx, dy)
    if (len < EPSILON) {
      result.push(segEnd)
      continue
    }
    const dirX = dx / len
    const dirY = dy / len
    const perpX = -dirY
    const perpY = dirX

    const onSegment = hopPoints
      .map((hp) => ({ hp, t: (hp.x - segStart.x) * dirX + (hp.y - segStart.y) * dirY }))
      .filter(({ hp, t }) => t > radius && t < len - radius && pointOnSegment(hp, segStart, segEnd))
      .sort((a, b) => a.t - b.t)

    for (const { hp } of onSegment) {
      for (let s = 0; s <= HOP_SAMPLES; s++) {
        const theta = (Math.PI * s) / HOP_SAMPLES
        result.push({
          x: hp.x - dirX * radius * Math.cos(theta) + perpX * radius * Math.sin(theta),
          y: hp.y - dirY * radius * Math.cos(theta) + perpY * radius * Math.sin(theta),
        })
      }
    }
    result.push(segEnd)
  }
  return result
}
