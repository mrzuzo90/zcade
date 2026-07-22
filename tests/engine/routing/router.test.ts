import { describe, expect, it } from 'vitest'
import type { ComponentInstance, Point } from '@/types/circuit'
import { componentBoundingBox, obstaclesFromComponents, routeAStarPath, collapseCollinear } from '@/engine/routing/router'
import { routeWire, ASTAR_ROUTING_ENABLED } from '@/engine/routing'
import { routeOrthogonal } from '@/engine/wiring'

function instance(overrides: Partial<ComponentInstance> & Pick<ComponentInstance, 'id' | 'type' | 'x' | 'y'>): ComponentInstance {
  return { label: '', rotation: 0, properties: {}, ...overrides }
}

/** True if the straight segment [a,b] (assumed axis-aligned, as all our routed segments are) overlaps the interior of `box` at all. */
function segmentOverlapsBox(a: Point, b: Point, box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  const segMinX = Math.min(a.x, b.x)
  const segMaxX = Math.max(a.x, b.x)
  const segMinY = Math.min(a.y, b.y)
  const segMaxY = Math.max(a.y, b.y)
  const overlapX = segMinX < box.maxX && segMaxX > box.minX
  const overlapY = segMinY < box.maxY && segMaxY > box.minY
  return overlapX && overlapY
}

function pathAvoidsBox(points: Point[], box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentOverlapsBox(points[i], points[i + 1], box)) return false
  }
  return true
}

describe('componentBoundingBox', () => {
  it('returns the raw footprint bbox at rotation 0', () => {
    const km1 = instance({ id: 'km1', type: 'contactor_3p', x: 100, y: 200 })
    expect(componentBoundingBox(km1)).toEqual({ minX: 100, minY: 200, maxX: 160, maxY: 280 })
  })

  it('swaps width/height around the same center at rotation 90', () => {
    const km1 = instance({ id: 'km1', type: 'contactor_3p', x: 0, y: 0, rotation: 90 })
    // contactor_3p is 60x80; center is (30,40). Rotated, footprint becomes 80x60 around that same center.
    expect(componentBoundingBox(km1)).toEqual({ minX: -10, minY: 10, maxX: 70, maxY: 70 })
  })
})

describe('obstaclesFromComponents', () => {
  it('excludes the given component ids and inflates the rest by clearanceCells', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }), // 30x30
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    }
    const obstacles = obstaclesFromComponents(components, ['a'], 2, 10)
    expect(obstacles).toHaveLength(1)
    // lamp b: 30x30 at (100,0) -> inflated by 2 cells * 10px = 20px on every side.
    expect(obstacles[0]).toEqual({ minX: 80, minY: -20, maxX: 150, maxY: 50 })
  })
})

describe('routeAStarPath — simple direct routes', () => {
  it('routes a straight line with no obstacles between two points sharing a row', () => {
    const result = routeAStarPath({ x: 0, y: 50 }, { x: 200, y: 50 }, {}, [])
    expect(result).not.toBeNull()
    expect(result!.points).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ])
  })

  it('routes a clean single-elbow path with no obstacles between diagonally offset points (turn penalty prefers one bend)', () => {
    const result = routeAStarPath({ x: 0, y: 0 }, { x: 80, y: 80 }, {}, [])
    expect(result).not.toBeNull()
    expect(result!.points).toHaveLength(3)
    const elbow = result!.points[1]
    expect([
      { x: 80, y: 0 },
      { x: 0, y: 80 },
    ]).toContainEqual(elbow)
  })
})

describe('routeAStarPath — obstacle avoidance', () => {
  it('detours around a component sitting directly on the straight path', () => {
    const wall = instance({ id: 'wall', type: 'contactor_3p', x: 150, y: 0 }) // bbox 150-210 x, 0-80 y
    const components: Record<string, ComponentInstance> = { wall }
    const from = { x: 0, y: 50 }
    const to = { x: 400, y: 50 }
    const result = routeAStarPath(from, to, components, [], [])
    expect(result).not.toBeNull()
    expect(result!.points[0]).toEqual(from)
    expect(result!.points[result!.points.length - 1]).toEqual(to)

    // wall inflated by the default 2-cell (20px) clearance: 130-230 x, -20-100 y.
    const inflatedWall = { minX: 130, minY: -20, maxX: 230, maxY: 100 }
    expect(pathAvoidsBox(result!.points, inflatedWall)).toBe(true)
  })

  it('excludes the two endpoint components own bodies from the obstacle set', () => {
    // "a" and "b" are the components the endpoints belong to — even though the
    // straight path runs directly across both bodies, they must not count as
    // obstacles to their own pins' wire.
    const a = instance({ id: 'a', type: 'contactor_3p', x: 0, y: 0 })
    const b = instance({ id: 'b', type: 'contactor_3p', x: 200, y: 0 })
    const components: Record<string, ComponentInstance> = { a, b }
    const result = routeAStarPath({ x: 30, y: 40 }, { x: 230, y: 40 }, components, ['a', 'b'], [])
    expect(result).not.toBeNull()
    expect(result!.points).toEqual([
      { x: 30, y: 40 },
      { x: 230, y: 40 },
    ])
  })

  it('fails gracefully (null, no throw, no hang) when the goal is deep inside a solid tiled block of components', () => {
    const components: Record<string, ComponentInstance> = {}
    let n = 0
    // Tile contactor_3p (60x80) edge-to-edge into a solid 360x320 block with no gaps.
    for (const x of [400, 460, 520, 580, 640, 700]) {
      for (const y of [400, 480, 560, 640]) {
        const id = `tile${n++}`
        components[id] = instance({ id, type: 'contactor_3p', x, y })
      }
    }
    const from = { x: 0, y: 0 }
    const to = { x: 550, y: 550 } // deep inside the tiled block, far from any edge

    const start = Date.now()
    expect(() => routeAStarPath(from, to, components, [], [])).not.toThrow()
    const result = routeAStarPath(from, to, components, [], [])
    const elapsedMs = Date.now() - start
    expect(result).toBeNull()
    expect(elapsedMs).toBeLessThan(1000)
  })
})

describe('collapseCollinear', () => {
  it('removes redundant interior points on a straight run', () => {
    expect(
      collapseCollinear([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ])
  })

  it('leaves a 2-point path untouched', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]
    expect(collapseCollinear(points)).toEqual(points)
  })
})

describe('routeWire (feature-flag dispatcher)', () => {
  it('defaults to the Manhattan fallback while ASTAR_ROUTING_ENABLED is false', () => {
    expect(ASTAR_ROUTING_ENABLED).toBe(false)
    const from = { x: 0, y: 0 }
    const to = { x: 80, y: 40 }
    const result = routeWire(from, to, {}, [])
    expect(result).toEqual(routeOrthogonal(from, to))
  })

  it('uses the A* result when forceAStar is set and a path exists', () => {
    const from = { x: 0, y: 50 }
    const to = { x: 200, y: 50 }
    const result = routeWire(from, to, {}, [], [], { forceAStar: true })
    expect(result).toEqual([from, to])
  })

  it('falls back to the Manhattan route when forceAStar is set but A* finds no path', () => {
    const components: Record<string, ComponentInstance> = {}
    let n = 0
    for (const x of [400, 460, 520, 580, 640, 700]) {
      for (const y of [400, 480, 560, 640]) {
        const id = `tile${n++}`
        components[id] = instance({ id, type: 'contactor_3p', x, y })
      }
    }
    const from = { x: 0, y: 0 }
    const to = { x: 550, y: 550 }
    const result = routeWire(from, to, components, [], [], { forceAStar: true })
    expect(result).toEqual(routeOrthogonal(from, to))
  })
})
