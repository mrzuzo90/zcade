import type { GridCell } from './types'

/**
 * Grid-agnostic 4-connected A* pathfinder.
 *
 * This module knows nothing about components, pins, or px coordinates —
 * it operates purely on integer (col, row) grid cells and caller-supplied
 * `isBlocked`/`extraStepCost` callbacks. `router.ts` is the layer that
 * translates world-px circuit geometry into this grid; keeping the two
 * separate makes the search itself trivial to unit-test in isolation with
 * a hand-built boolean grid, no ComponentInstance/library plumbing required.
 *
 * Cost model (Section 10.3 of COMPLETE_PROJECT_ROADMAP.md):
 *   cost = steps + turnPenalty * direction_changes + extraStepCost(...)
 * where extraStepCost is where router.ts folds in the soft crossing penalty
 * and the bus-alignment tie-break bias.
 *
 * Search state is (col, row, directionEnteredFrom) rather than plain
 * (col, row) — turn penalty depends on which direction you arrived from, so
 * two paths reaching the same cell from different directions are genuinely
 * different states with different future costs (e.g. one can go straight
 * through for free, the other must pay to turn). This bounds the state
 * space to 4x the number of cells, not a runaway per-path explosion.
 *
 * Termination/perf guarantees: closed-set (each state expanded at most
 * once) + a caller-supplied `maxExpansions` cap. Every edge cost is clamped
 * to a small positive minimum, so there is no zero/negative-cost cycle that
 * could make the search loop instead of converging. On a fully-blocked or
 * pathologically huge grid, this returns `null` once the open set empties
 * or the expansion cap is hit — never throws, never hangs.
 */

export interface GridBounds {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

export type IsBlocked = (col: number, row: number) => boolean

/** Extra cost added on top of the base unit step cost (1) for stepping from `a` to `b` in direction `dir`. May be negative (e.g. bus-alignment discount) — the caller is responsible for the total per-step cost never going below a small positive floor. */
export type ExtraStepCost = (a: GridCell, b: GridCell, dir: number) => number

export interface AStarOptions {
  turnPenalty: number
  maxExpansions: number
  extraStepCost?: ExtraStepCost
}

export interface AStarResult {
  cells: GridCell[]
  cost: number
  expanded: number
}

const MIN_STEP_COST = 0.01

/** dir index -> (dCol, dRow), 4-connected. */
const DIRS: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 1, dr: 0 }, // 0: +col (right)
  { dc: 0, dr: 1 }, // 1: +row (down)
  { dc: -1, dr: 0 }, // 2: -col (left)
  { dc: 0, dr: -1 }, // 3: -row (up)
]

function manhattan(a: GridCell, b: GridCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

function keyOf(col: number, row: number, dir: number): string {
  return `${col}:${row}:${dir}`
}

/** Binary min-heap keyed by an external priority number — avoids an O(n) sorted-array pop on grids with thousands of cells. */
class MinHeap<T> {
  private items: { priority: number; value: T }[] = []

  get size(): number {
    return this.items.length
  }

  push(priority: number, value: T): void {
    const items = this.items
    items.push({ priority, value })
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent].priority <= items[i].priority) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  pop(): T | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0].value
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = 2 * i + 2
        let smallest = i
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right
        if (smallest === i) break
        ;[items[smallest], items[i]] = [items[i], items[smallest]]
        i = smallest
      }
    }
    return top
  }
}

/**
 * Finds a 4-connected path from `start` to `goal` on an integer grid bounded
 * by `bounds`. Returns `null` (never throws) if the endpoints are blocked or
 * out of bounds, if no path exists, or if the search exceeds
 * `options.maxExpansions`.
 */
export function findGridPath(
  start: GridCell,
  goal: GridCell,
  bounds: GridBounds,
  isBlocked: IsBlocked,
  options: AStarOptions,
): AStarResult | null {
  if (start.col === goal.col && start.row === goal.row) {
    return { cells: [start], cost: 0, expanded: 0 }
  }
  const inBounds = (c: number, r: number) => c >= bounds.minCol && c <= bounds.maxCol && r >= bounds.minRow && r <= bounds.maxRow
  if (!inBounds(start.col, start.row) || !inBounds(goal.col, goal.row)) return null
  if (isBlocked(start.col, start.row) || isBlocked(goal.col, goal.row)) return null

  const { turnPenalty, maxExpansions, extraStepCost } = options

  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, { col: number; row: number; dir: number } | null>()
  const closed = new Set<string>()
  const open = new MinHeap<{ col: number; row: number; dir: number }>()

  // Direction -1 is a virtual "no direction yet" state so the very first move is never turn-penalized.
  const startKey = keyOf(start.col, start.row, -1)
  gScore.set(startKey, 0)
  cameFrom.set(startKey, null)
  open.push(manhattan(start, goal), { col: start.col, row: start.row, dir: -1 })

  let expanded = 0

  while (open.size > 0) {
    const current = open.pop()!
    const currentKey = keyOf(current.col, current.row, current.dir)
    if (closed.has(currentKey)) continue
    closed.add(currentKey)
    const currentG = gScore.get(currentKey)!

    if (current.col === goal.col && current.row === goal.row) {
      const cells: GridCell[] = []
      let cursor: { col: number; row: number; dir: number } | null = current
      let cursorKey = currentKey
      while (cursor) {
        cells.push({ col: cursor.col, row: cursor.row })
        const prev = cameFrom.get(cursorKey) ?? null
        if (!prev) break
        cursorKey = keyOf(prev.col, prev.row, prev.dir)
        cursor = prev
      }
      cells.reverse()
      return { cells, cost: currentG, expanded }
    }

    expanded++
    if (expanded > maxExpansions) return null

    for (let dir = 0; dir < DIRS.length; dir++) {
      const { dc, dr } = DIRS[dir]
      const nc = current.col + dc
      const nr = current.row + dr
      if (!inBounds(nc, nr)) continue
      if (isBlocked(nc, nr)) continue

      let stepCost = 1
      if (current.dir !== -1 && current.dir !== dir) stepCost += turnPenalty
      if (extraStepCost) {
        stepCost += extraStepCost({ col: current.col, row: current.row }, { col: nc, row: nr }, dir)
        if (stepCost < MIN_STEP_COST) stepCost = MIN_STEP_COST
      }

      const neighborKey = keyOf(nc, nr, dir)
      if (closed.has(neighborKey)) continue
      const tentativeG = currentG + stepCost
      const known = gScore.get(neighborKey)
      if (known === undefined || tentativeG < known) {
        gScore.set(neighborKey, tentativeG)
        cameFrom.set(neighborKey, { col: current.col, row: current.row, dir: current.dir })
        const f = tentativeG + manhattan({ col: nc, row: nr }, goal)
        open.push(f, { col: nc, row: nr, dir })
      }
    }
  }

  return null
}
