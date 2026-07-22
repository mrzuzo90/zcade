import type { ComponentInstance, Point } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { findGridPath, type GridBounds } from './astar'
import type { GridCell } from './types'
import { DEFAULT_ROUTE_OPTIONS, type Obstacle, type RouteOptions, type RouteResult } from './types'

const EPSILON = 0.01

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON
}

/**
 * Axis-aligned bbox (world px) a component instance occupies, accounting for
 * cardinal rotation — a 90/270 rotation swaps width/height around the same
 * center, mirroring the rotation pivot convention `getPinPosition` in
 * `wiring.ts` uses (rotate around center, not top-left corner).
 */
export function componentBoundingBox(instance: ComponentInstance): Obstacle {
  const def = getComponentDefinition(instance.type)
  const swapped = instance.rotation === 90 || instance.rotation === 270
  const w = swapped ? def.height : def.width
  const h = swapped ? def.width : def.height
  const centerX = instance.x + def.width / 2
  const centerY = instance.y + def.height / 2
  return {
    minX: centerX - w / 2,
    minY: centerY - h / 2,
    maxX: centerX + w / 2,
    maxY: centerY + h / 2,
  }
}

function inflate(box: Obstacle, cells: number, cellSize: number): Obstacle {
  const pad = cells * cellSize
  return { minX: box.minX - pad, minY: box.minY - pad, maxX: box.maxX + pad, maxY: box.maxY + pad }
}

/**
 * Builds the obstacle list for a route between two pins: every component's
 * bbox inflated by `clearanceCells`, except the components in
 * `excludeComponentIds` (normally the endpoints' own owning components —
 * a component's own body isn't an obstacle to a wire leaving its own pin).
 */
export function obstaclesFromComponents(
  components: Record<string, ComponentInstance>,
  excludeComponentIds: string[],
  clearanceCells: number,
  cellSize: number,
): Obstacle[] {
  const exclude = new Set(excludeComponentIds)
  return Object.values(components)
    .filter((c) => !exclude.has(c.id))
    .map((c) => inflate(componentBoundingBox(c), clearanceCells, cellSize))
}

function worldToCell(p: Point, origin: Point, cellSize: number): GridCell {
  return { col: Math.round((p.x - origin.x) / cellSize), row: Math.round((p.y - origin.y) / cellSize) }
}

function cellToWorld(c: GridCell, origin: Point, cellSize: number): Point {
  return { x: origin.x + c.col * cellSize, y: origin.y + c.row * cellSize }
}

function cellIntersectsBox(box: Obstacle, col: number, row: number, origin: Point, cellSize: number): boolean {
  const cx0 = origin.x + col * cellSize
  const cy0 = origin.y + row * cellSize
  const cx1 = cx0 + cellSize
  const cy1 = cy0 + cellSize
  return box.minX < cx1 && box.maxX > cx0 && box.minY < cy1 && box.maxY > cy0
}

/** Cross-product-sign based segment intersection test (interior crossings only — shared endpoints are connections, not crossings, per the same IEC convention `findJunctions` in wiring.ts uses). */
function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(val) < 1e-9) return 0
  return val > 0 ? 1 : 2
}

function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  if (pointsEqual(p1, p3) || pointsEqual(p1, p4) || pointsEqual(p2, p3) || pointsEqual(p2, p4)) return false
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4
}

/** True if a unit grid step runs along the same row (horizontal) or column (vertical) as an existing wire segment — a rough "these are part of the same bus line" heuristic used only as a soft tie-break bias, not a hard rule. */
function segmentAligned(aFrom: Point, aTo: Point, wFrom: Point, wTo: Point): boolean {
  const aHoriz = Math.abs(aFrom.y - aTo.y) < EPSILON
  const wHoriz = Math.abs(wFrom.y - wTo.y) < EPSILON
  if (aHoriz !== wHoriz) return false
  return aHoriz ? Math.abs(aFrom.y - wFrom.y) < EPSILON : Math.abs(aFrom.x - wFrom.x) < EPSILON
}

/** Removes redundant interior points on a straight run (post-processing step from Section 10.3: "collapse collinear runs -> polyline; simplify staircase artifacts"). */
export function collapseCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points.map((p) => ({ ...p }))
  const result: Point[] = [{ ...points[0] }]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1]
    const cur = points[i]
    const next = points[i + 1]
    const collinear = (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y)
    if (!collinear) result.push({ ...cur })
  }
  result.push({ ...points[points.length - 1] })
  return result
}

/**
 * A* grid router between two pin positions. Builds a grid over the
 * bounding span of `from`/`to` (inflated by `marginCells` of search room),
 * marks component bboxes (+clearance) as obstacles, and searches with a
 * turn penalty + soft crossing penalty + bus-alignment tie-break bias (see
 * astar.ts's cost model doc comment).
 *
 * Returns `null` — never throws — when no path exists (e.g. the goal pin is
 * fully enclosed by obstacles) or the search hits its expansion cap.
 * Callers needing a guaranteed polyline should fall back to
 * `routeOrthogonal` in that case (see index.ts's `routeWire`).
 */
export function routeAStarPath(
  from: Point,
  to: Point,
  components: Record<string, ComponentInstance>,
  excludeComponentIds: string[],
  existingWirePaths: Point[][] = [],
  options: RouteOptions = {},
): RouteResult | null {
  const opts = { ...DEFAULT_ROUTE_OPTIONS, ...options }
  const { cellSize, clearanceCells, marginCells, turnPenalty, crossPenalty, alignmentBias, maxExpansions } = opts

  const origin = from
  const startCell: GridCell = { col: 0, row: 0 }
  const goalCell = worldToCell(to, origin, cellSize)

  const bounds: GridBounds = {
    minCol: Math.min(0, goalCell.col) - marginCells,
    maxCol: Math.max(0, goalCell.col) + marginCells,
    minRow: Math.min(0, goalCell.row) - marginCells,
    maxRow: Math.max(0, goalCell.row) + marginCells,
  }

  const obstacles = obstaclesFromComponents(components, excludeComponentIds, clearanceCells, cellSize)

  const isBlocked = (col: number, row: number): boolean => {
    // Each pin's own cell is always passable regardless of nearby obstacles
    // (the "except each pin's own cell" carve-out from Section 10.3's spec —
    // a simplified stand-in for a full directional escape-stub, sufficient
    // since the endpoint's own component is already excluded from `obstacles`
    // above; this only matters when a *different*, non-excluded component's
    // clearance zone happens to overlap the pin).
    if ((col === startCell.col && row === startCell.row) || (col === goalCell.col && row === goalCell.row)) return false
    return obstacles.some((box) => cellIntersectsBox(box, col, row, origin, cellSize))
  }

  const wireSegments: [Point, Point][] = []
  for (const path of existingWirePaths) {
    for (let i = 0; i < path.length - 1; i++) wireSegments.push([path[i], path[i + 1]])
  }

  const extraStepCost = wireSegments.length === 0
    ? undefined
    : (a: GridCell, b: GridCell): number => {
        const segA = cellToWorld(a, origin, cellSize)
        const segB = cellToWorld(b, origin, cellSize)
        let extra = 0
        for (const [wFrom, wTo] of wireSegments) {
          if (segmentsCross(segA, segB, wFrom, wTo)) extra += crossPenalty
          if (segmentAligned(segA, segB, wFrom, wTo)) extra -= alignmentBias
        }
        return extra
      }

  const result = findGridPath(startCell, goalCell, bounds, isBlocked, { turnPenalty, maxExpansions, extraStepCost })
  if (!result) return null

  const points = result.cells.map((c) => cellToWorld(c, origin, cellSize))
  points[0] = { ...from }
  points[points.length - 1] = { ...to }

  return { points: collapseCollinear(points), cost: result.cost, expanded: result.expanded }
}
