import type { Point } from '@/types/circuit'

/** A cell on the integer routing grid (not world px — see router.ts's origin/cellSize conversion). */
export interface GridCell {
  col: number
  row: number
}

/** Axis-aligned bounding box in world px, already inflated by clearance where relevant. */
export interface Obstacle {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface RouteOptions {
  /** World-px size of one grid cell. Defaults to the app's GRID_SIZE (10px, see store/canvas.ts) — kept as its own constant here rather than importing the store, so `engine/routing` has no dependency on `store/` (see CLAUDE.md's engine/store separation-of-concerns rule). */
  cellSize?: number
  /** Grid cells of clearance padded onto every component bbox before it becomes an obstacle. */
  clearanceCells?: number
  /** Extra cells of search room around the straight-line span between the two pins, so the router has room to detour. */
  marginCells?: number
  /** Extra cost charged when a step's direction differs from the previous step's — biases the search toward long straight runs. */
  turnPenalty?: number
  /** Soft extra cost charged when a step's segment crosses another already-routed wire at a non-shared point. Never blocks — just discourages. */
  crossPenalty?: number
  /** Small cost *discount* (clamped so total step cost never goes below MIN_STEP_COST) when a step runs along the same row/column as an existing wire segment — nudges the router toward bus-aesthetic alignment. This is a tie-break heuristic, not a guarantee of global optimality. */
  alignmentBias?: number
  /** Hard cap on nodes expanded before giving up and returning null — guarantees the router never hangs on a pathological (fully-enclosed / huge) grid. */
  maxExpansions?: number
}

export const DEFAULT_ROUTE_OPTIONS: Required<RouteOptions> = {
  cellSize: 10,
  clearanceCells: 2,
  marginCells: 8,
  turnPenalty: 3,
  crossPenalty: 0.5,
  alignmentBias: 0.05,
  maxExpansions: 20_000,
}

export interface RouteResult {
  /** Collinear-collapsed polyline in world px; first/last points are exactly `from`/`to`. */
  points: Point[]
  /** Total A* path cost (steps + turn/cross/alignment adjustments) — mostly useful for tests/perf comparison, not shown to users. */
  cost: number
  /** Nodes expanded during the search — exposed for perf benchmarking (Section 10.3's <16ms budget, verified in Week 2). */
  expanded: number
}
