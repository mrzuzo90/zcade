/**
 * ============================================================================
 * ROUTING ALGORITHM SPEC (Phase A, ROUTE — W1 D1-2, per COMPLETE_PROJECT_
 * ROADMAP.md Section 10.3 "Auto-Routing Algorithm Outline")
 * ============================================================================
 *
 * Problem: given two pin positions (world px) and the current canvas of
 * components, find an orthogonal wire route that avoids passing through
 * component bodies, prefers long straight runs over zig-zags, and prefers
 * (softly) aligning with already-routed wires for a tidy "bus" look —
 * without ever hanging or throwing, even when no route exists.
 *
 * Grid: an integer grid over the bounding span of the two pins, cell size =
 * 10px (matches the app's GRID_SIZE, kept as an independent constant here —
 * see types.ts's `cellSize` doc comment for why), inflated by `marginCells`
 * (default 8) of extra search room on every side so the router has room to
 * detour around obstacles between the pins.
 *
 * Obstacles: every OTHER component's bounding box (accounting for cardinal
 * rotation swapping width/height — see router.ts `componentBoundingBox`),
 * inflated by `clearanceCells` (default 2) grid cells on every side. The
 * two endpoint pins' own owning components are excluded entirely — a
 * component's own body is never an obstacle to its own pin's wire.
 *
 * Search: A* over 4-connected cells, state = (col, row, direction entered
 * from) so turn cost is charged correctly. Cost per step:
 *     1 (base)
 *   + turnPenalty        if this step's direction != the previous step's
 *   + crossPenalty       if this step's segment crosses an existing wire
 *                        segment at a non-shared point (soft — never blocks)
 *   - alignmentBias       if this step runs along the same row/column as an
 *                        existing wire segment (soft tie-break toward bus
 *                        aesthetics — clamped so total step cost never goes
 *                        below a small positive floor)
 * Each pin's own cell is always passable regardless of obstacles (a
 * simplified stand-in for a full directional "escape stub": since the
 * owning component is already excluded from obstacles, this only matters
 * when a *different* nearby component's clearance zone overlaps the pin).
 *
 * Post-processing: collapse collinear interior points into a clean
 * polyline (removes staircase artifacts from grid-stepping).
 *
 * Fallback: `routeOrthogonal` (the existing Manhattan single-elbow router)
 * — used whenever A* is disabled by the feature flag below, or whenever it
 * returns null (fully blocked / pathological grid), so every caller always
 * gets a usable polyline.
 *
 * Explicitly NOT in this session's scope (Week 2, per the roadmap): manual
 * waypoint editing, arc-hop rendering at unrelated crossings, incremental
 * re-route on component move, wiring this into the live editor UI, and the
 * full 500-component/1000-wire <16ms perf benchmark (this session only
 * measures a moderate obstacle-dense case — see routing.perf test).
 * ============================================================================
 */

import type { ComponentInstance, Point } from '@/types/circuit'
import { routeOrthogonal } from '../wiring'
import { routeAStarPath } from './router'
import type { RouteOptions } from './types'

/**
 * Feature flag: the A* router is implemented and unit-tested but NOT yet
 * wired into the live editor UI (CanvasStage/WireLayer still call
 * `routeOrthogonal` directly, per Phase 2/3's `getWirePath`). Flip to `true`
 * only once the editor is updated to call `routeWire` — Week 2 scope. Until
 * then this stays `false` so `routeWire` is purely additive/dark: existing
 * behavior is unchanged for every current caller.
 */
export const ASTAR_ROUTING_ENABLED = false

export interface RouteWireOptions extends RouteOptions {
  /** Bypasses the module-level feature flag — for tests/tools that want A* explicitly regardless of `ASTAR_ROUTING_ENABLED`. */
  forceAStar?: boolean
}

/**
 * Chooses a routing strategy for a wire between two resolved pin positions:
 * the A* grid router when enabled (or `forceAStar`), falling back to the
 * Manhattan elbow (`routeOrthogonal`) both when A* is disabled AND whenever
 * A* fails to find a path — so this function always returns a usable
 * polyline, never null.
 */
export function routeWire(
  from: Point,
  to: Point,
  components: Record<string, ComponentInstance>,
  excludeComponentIds: string[],
  existingWirePaths: Point[][] = [],
  options: RouteWireOptions = {},
): Point[] {
  const useAStar = options.forceAStar ?? ASTAR_ROUTING_ENABLED
  if (useAStar) {
    const result = routeAStarPath(from, to, components, excludeComponentIds, existingWirePaths, options)
    if (result) return result.points
  }
  return routeOrthogonal(from, to)
}

export { routeAStarPath, obstaclesFromComponents, componentBoundingBox, collapseCollinear } from './router'
export { findGridPath } from './astar'
export type { GridBounds, IsBlocked, ExtraStepCost, AStarOptions, AStarResult } from './astar'
export type { GridCell, Obstacle, RouteOptions, RouteResult } from './types'
export { DEFAULT_ROUTE_OPTIONS } from './types'
