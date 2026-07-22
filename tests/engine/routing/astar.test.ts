import { describe, expect, it } from 'vitest'
import { findGridPath, type GridBounds } from '@/engine/routing/astar'

const BOUNDS: GridBounds = { minCol: 0, maxCol: 20, minRow: 0, maxRow: 20 }
const noneBlocked = () => false

describe('findGridPath — simple direct routes', () => {
  it('routes a straight horizontal line with zero turn cost', () => {
    const result = findGridPath({ col: 0, row: 0 }, { col: 5, row: 0 }, BOUNDS, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 1000,
    })
    expect(result).not.toBeNull()
    expect(result!.cost).toBe(5) // 5 steps, no turns
    expect(result!.cells[0]).toEqual({ col: 0, row: 0 })
    expect(result!.cells[result!.cells.length - 1]).toEqual({ col: 5, row: 0 })
  })

  it('routes an L-shaped path with exactly one turn when endpoints are offset', () => {
    const result = findGridPath({ col: 0, row: 0 }, { col: 3, row: 3 }, BOUNDS, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 1000,
    })
    expect(result).not.toBeNull()
    // Manhattan distance 6 steps + exactly 1 turn penalty (one bend, straight before/after)
    expect(result!.cost).toBe(6 + 3)
  })

  it('returns a trivial zero-cost path when start equals goal', () => {
    const result = findGridPath({ col: 4, row: 4 }, { col: 4, row: 4 }, BOUNDS, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 1000,
    })
    expect(result).toEqual({ cells: [{ col: 4, row: 4 }], cost: 0, expanded: 0 })
  })
})

describe('findGridPath — obstacle avoidance', () => {
  it('routes around a wall blocking the direct path', () => {
    // Vertical wall at col=5, rows 0..10, open below row 10 (gap at rows 11-20).
    const isBlocked = (col: number, row: number) => col === 5 && row <= 10
    const result = findGridPath({ col: 0, row: 5 }, { col: 10, row: 5 }, BOUNDS, isBlocked, {
      turnPenalty: 3,
      maxExpansions: 5000,
    })
    expect(result).not.toBeNull()
    for (const cell of result!.cells) {
      expect(isBlocked(cell.col, cell.row)).toBe(false)
    }
    // Must detour below the wall (row > 10) since the gap is there.
    expect(result!.cells.some((c) => c.row > 10)).toBe(true)
  })

  it('fails gracefully (returns null, no throw) when the goal is fully enclosed', () => {
    const isBlocked = (col: number, row: number) => {
      // A closed box around (10,10) with no gaps.
      const dCol = col - 10
      const dRow = row - 10
      const onRing = Math.max(Math.abs(dCol), Math.abs(dRow)) === 1
      return onRing
    }
    expect(() =>
      findGridPath({ col: 0, row: 0 }, { col: 10, row: 10 }, BOUNDS, isBlocked, { turnPenalty: 3, maxExpansions: 5000 }),
    ).not.toThrow()
    const result = findGridPath({ col: 0, row: 0 }, { col: 10, row: 10 }, BOUNDS, isBlocked, {
      turnPenalty: 3,
      maxExpansions: 5000,
    })
    expect(result).toBeNull()
  })

  it('returns null immediately when the start or goal cell itself is blocked', () => {
    const isBlocked = (col: number, row: number) => col === 0 && row === 0
    const result = findGridPath({ col: 0, row: 0 }, { col: 5, row: 5 }, BOUNDS, isBlocked, {
      turnPenalty: 3,
      maxExpansions: 5000,
    })
    expect(result).toBeNull()
  })

  it('returns null when endpoints fall outside the search bounds', () => {
    const result = findGridPath({ col: -5, row: 0 }, { col: 5, row: 5 }, BOUNDS, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 5000,
    })
    expect(result).toBeNull()
  })
})

describe('findGridPath — turn penalty behavior with multiple valid paths', () => {
  it('prefers the path with fewer turns when two routes have the same Manhattan length', () => {
    // Both an "L" (one bend) and a "staircase" (many bends) reach the same
    // goal in the same number of steps; a meaningfully positive turnPenalty
    // must make the search prefer the L.
    const result = findGridPath({ col: 0, row: 0 }, { col: 4, row: 4 }, BOUNDS, noneBlocked, {
      turnPenalty: 5,
      maxExpansions: 5000,
    })
    expect(result).not.toBeNull()
    // Count direction changes along the returned path.
    const cells = result!.cells
    let turns = 0
    for (let i = 2; i < cells.length; i++) {
      const d1 = { dc: cells[i - 1].col - cells[i - 2].col, dr: cells[i - 1].row - cells[i - 2].row }
      const d2 = { dc: cells[i].col - cells[i - 1].col, dr: cells[i].row - cells[i - 1].row }
      if (d1.dc !== d2.dc || d1.dr !== d2.dr) turns++
    }
    expect(turns).toBe(1) // straight-then-straight single elbow, not a staircase
    expect(result!.cost).toBe(8 + 5) // 8 steps + exactly one turn penalty
  })

  it('with turnPenalty=0, any shortest path is acceptable (cost is just step count)', () => {
    const result = findGridPath({ col: 0, row: 0 }, { col: 4, row: 4 }, BOUNDS, noneBlocked, {
      turnPenalty: 0,
      maxExpansions: 5000,
    })
    expect(result).not.toBeNull()
    expect(result!.cost).toBe(8)
  })
})

describe('findGridPath — extraStepCost hook', () => {
  it('lets a caller bias the search away from a soft-penalized cell without hard-blocking it', () => {
    // Heavily penalize landing on (2, 0) specifically — passable, just expensive.
    const extraStepCost = (_a: { col: number; row: number }, b: { col: number; row: number }) =>
      b.col === 2 && b.row === 0 ? 50 : 0
    const result = findGridPath({ col: 0, row: 0 }, { col: 4, row: 0 }, BOUNDS, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 5000,
      extraStepCost,
    })
    expect(result).not.toBeNull()
    // A detour via row 1 (a handful of extra steps + turns) is cheaper than
    // paying the 50-cost penalty, so the search should route around (2,0)
    // rather than through it, even though nothing blocks it outright.
    expect(result!.cells.some((c) => c.col === 2 && c.row === 0)).toBe(false)
    expect(result!.cells.some((c) => c.row !== 0)).toBe(true)
  })
})

describe('findGridPath — pathological cases never hang', () => {
  it('respects maxExpansions and returns null quickly on a huge open grid', () => {
    const hugeBounds: GridBounds = { minCol: 0, maxCol: 5000, minRow: 0, maxRow: 5000 }
    const start = Date.now()
    const result = findGridPath({ col: 0, row: 0 }, { col: 4999, row: 4999 }, hugeBounds, noneBlocked, {
      turnPenalty: 3,
      maxExpansions: 200,
    })
    const elapsedMs = Date.now() - start
    expect(result).toBeNull()
    expect(elapsedMs).toBeLessThan(500)
  })

  it('terminates promptly on a maze-like fully-blocked case', () => {
    // Checkerboard-ish blocking pattern with no valid path to the goal.
    const isBlocked = (col: number, row: number) => (col + row) % 2 === 0 && !(col === 0 && row === 0)
    const start = Date.now()
    const result = findGridPath({ col: 0, row: 0 }, { col: 19, row: 19 }, BOUNDS, isBlocked, {
      turnPenalty: 3,
      maxExpansions: 10_000,
    })
    const elapsedMs = Date.now() - start
    expect(elapsedMs).toBeLessThan(1000)
    // Not asserting a specific result here (checkerboard parity may or may
    // not admit a path) — only that it resolves quickly without throwing.
    expect(result === null || Array.isArray(result.cells)).toBe(true)
  })
})
