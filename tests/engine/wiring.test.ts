import { describe, expect, it } from 'vitest'
import type { ComponentInstance } from '@/types/circuit'
import {
  dragWireSegment,
  findCrossings,
  findJunctions,
  getPinPosition,
  getWirePath,
  pathWithHops,
  routeOrthogonal,
} from '@/engine/wiring'

function instance(overrides: Partial<ComponentInstance> & Pick<ComponentInstance, 'id' | 'type' | 'x' | 'y'>): ComponentInstance {
  return { label: '', rotation: 0, properties: {}, ...overrides }
}

describe('getPinPosition', () => {
  it('resolves a pin at rotation 0 as its raw offset from the component origin', () => {
    const km1 = instance({ id: 'km1', type: 'contactor_3p', x: 0, y: 0 })
    expect(getPinPosition(km1, '1')).toEqual({ x: 0, y: 10 })
  })

  it('rotates pin positions around the component center, not its top-left corner', () => {
    // contactor_3p is 60x80; pin "1" sits at (0, 10), 30px left / 30px above center (30, 40).
    const km1 = instance({ id: 'km1', type: 'contactor_3p', x: 0, y: 0, rotation: 90 })
    expect(getPinPosition(km1, '1')).toEqual({ x: 60, y: 10 })
  })

  it('throws for an unknown pin id', () => {
    const km1 = instance({ id: 'km1', type: 'contactor_3p', x: 0, y: 0 })
    expect(() => getPinPosition(km1, 'nope')).toThrow()
  })
})

describe('routeOrthogonal', () => {
  it('routes a straight line when endpoints share an axis', () => {
    expect(routeOrthogonal({ x: 0, y: 10 }, { x: 100, y: 10 })).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
    ])
  })

  it('routes a single horizontal-then-vertical elbow otherwise', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 50 })).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ])
  })
})

describe('findJunctions', () => {
  // Bus wire A.14 -> B.13 runs horizontally through y=10 from x=40 to x=100.
  // C sits at x=70 (mid-span) and taps into it with a drop to D — a T-junction.
  // The bus wire needs an explicit manual route to be eligible as a tap host
  // (see findJunctions' doc comment) — it happens to match what auto-routing
  // would produce anyway, since A.14 and B.13 share a y-coordinate.
  const components: Record<string, ComponentInstance> = {
    a: instance({ id: 'a', type: 'push_button_no', x: 0, y: 0 }),
    b: instance({ id: 'b', type: 'push_button_no', x: 100, y: 0 }),
    c: instance({ id: 'c', type: 'push_button_no', x: 70, y: 0 }),
    d: instance({ id: 'd', type: 'lamp', x: 55, y: 50 }),
  }
  const busWire = {
    id: 'w1',
    from: { componentId: 'a', pinId: '14' },
    to: { componentId: 'b', pinId: '13' },
    points: [
      { x: 40, y: 10 },
      { x: 100, y: 10 },
    ],
  }
  const dropWire = { id: 'w2', from: { componentId: 'c', pinId: '13' }, to: { componentId: 'd', pinId: '1' } }

  it('detects a T-tap where one wire endpoint lands on another wire segment', () => {
    const junctions = findJunctions([busWire, dropWire], components)
    expect(junctions).toHaveLength(1)
    expect(junctions[0].point).toEqual({ x: 70, y: 10 })
    expect(junctions[0].wireIds.sort()).toEqual(['w1', 'w2'])
  })

  it('does not detect a tap when the host wire is auto-routed rather than manually placed', () => {
    const autoRoutedBusWire = { id: busWire.id, from: busWire.from, to: busWire.to }
    const junctions = findJunctions([autoRoutedBusWire, dropWire], components)
    expect(junctions).toHaveLength(0)
  })

  it('does not join two wires that merely cross without a shared endpoint', () => {
    // Horizontal wire through y=50, vertical wire through x=50 — they cross at
    // (50, 50), but neither wire actually terminates there.
    const crossComponents: Record<string, ComponentInstance> = {
      e1: instance({ id: 'e1', type: 'lamp', x: -15, y: 35 }), // pin '1' at (0,35)... use lamp pins (15,0)/(15,30)
      e2: instance({ id: 'e2', type: 'lamp', x: 85, y: 35 }),
      f1: instance({ id: 'f1', type: 'lamp', x: 35, y: -15 }),
      f2: instance({ id: 'f2', type: 'lamp', x: 35, y: 85 }),
    }
    // e1 pin '2' (offset 15,30) -> (0,65)?? simpler: build explicit wires using known pin offsets.
    const horizontal = { id: 'h', from: { componentId: 'e1', pinId: '1' }, to: { componentId: 'e2', pinId: '1' } }
    const vertical = { id: 'v', from: { componentId: 'f1', pinId: '1' }, to: { componentId: 'f2', pinId: '1' } }
    const junctions = findJunctions([horizontal, vertical], crossComponents)
    expect(junctions).toHaveLength(0)
  })
})

describe('getWirePath', () => {
  it('honors an explicit manual override over the live pin positions', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    }
    const wire = {
      id: 'w',
      from: { componentId: 'a', pinId: '1' },
      to: { componentId: 'b', pinId: '1' },
      points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    }
    expect(getWirePath(wire, components)).toEqual(wire.points)
  })

  it('returns null when an endpoint component no longer exists', () => {
    const wire = { id: 'w', from: { componentId: 'missing', pinId: '1' }, to: { componentId: 'missing2', pinId: '1' } }
    expect(getWirePath(wire, {})).toBeNull()
  })
})

describe('dragWireSegment', () => {
  it('inserts a jog at the pin end when dragging the first segment of a 3-point elbow', () => {
    // from(0,0) -> elbow(100,0) -> to(100,50); segment 0 is horizontal (y=0).
    const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]
    const result = dragWireSegment(path, 0, { x: 0, y: 20 })
    // Pin endpoints preserved exactly.
    expect(result[0]).toEqual({ x: 0, y: 0 })
    expect(result[result.length - 1]).toEqual({ x: 100, y: 50 })
    // A new jog point appears right after the pin, shifted by the perpendicular delta.
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 50 },
    ])
  })

  it('inserts a jog at the pin end when dragging the last segment of a 3-point elbow, shifting the shared bend in place', () => {
    const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]
    // Segment 1 is vertical (x=100); perpendicular drag is horizontal. Its
    // start (100,0) is a bend shared with segment 0, not a pin, so it's
    // shifted in place (segment 0 just gets longer, still horizontal); its
    // end (100,50) IS a pin, so a jog is inserted there instead.
    const result = dragWireSegment(path, 1, { x: 30, y: 0 })
    expect(result[0]).toEqual({ x: 0, y: 0 })
    expect(result[result.length - 1]).toEqual({ x: 100, y: 50 })
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 130, y: 0 },
      { x: 130, y: 50 },
      { x: 100, y: 50 },
    ])
  })

  it('shifts an interior segment in place without adding points, keeping both pins fixed', () => {
    // A 4-point path with two pin ends and one interior (already-jogged) segment.
    const path = [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 50 }]
    const result = dragWireSegment(path, 1, { x: 0, y: 15 })
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 35 },
      { x: 100, y: 35 },
      { x: 100, y: 50 },
    ])
  })

  it('creates a U-shaped jog dragging the only segment of a straight 2-point path', () => {
    const path = [{ x: 0, y: 10 }, { x: 100, y: 10 }]
    const result = dragWireSegment(path, 0, { x: 0, y: -25 })
    expect(result).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: -15 },
      { x: 100, y: -15 },
      { x: 100, y: 10 },
    ])
  })

  it('drops the component of delta parallel to the segment (no-op along its own axis)', () => {
    const path = [{ x: 0, y: 10 }, { x: 100, y: 10 }]
    const result = dragWireSegment(path, 0, { x: 40, y: 0 })
    expect(result).toBe(path)
  })

  it('is a no-op for an out-of-range segment index', () => {
    const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(dragWireSegment(path, 5, { x: 0, y: 10 })).toBe(path)
    expect(dragWireSegment(path, -1, { x: 0, y: 10 })).toBe(path)
  })

  it('end-to-end: a manually dragged wire that now routes through a third pin activates T-junction detection', () => {
    // Reproduces the exact scenario findJunctions' doc comment describes as
    // "dormant until manual waypoint editing ships" — this is that
    // activation, verified via the real dragWireSegment output rather than a
    // hand-built points array.
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'push_button_no', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'push_button_no', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'push_button_no', x: 70, y: -20 }),
      d: instance({ id: 'd', type: 'lamp', x: 55, y: 30 }),
    }
    // a.13 (0,10) -> b.13 (100,10): a straight auto-routed bus wire.
    const bus = { id: 'bus', from: { componentId: 'a', pinId: '13' }, to: { componentId: 'b', pinId: '13' } }
    const busPath = getWirePath(bus, components)!
    expect(busPath).toEqual([{ x: 0, y: 10 }, { x: 100, y: 10 }])

    // c.13 sits at (70, -10) — 20px above the bus. Dragging the bus's only
    // segment down by 20px would land it on c.13 instead, so drag it UP by
    // -20 makes the bus wire meet c's pin only if we align it there; instead
    // verify the general mechanism by dragging c's OWN drop wire so its
    // routed path is what's being tested: here we drag the bus wire itself
    // and check the resulting manual path passes through c's pin (70, -10).
    const draggedPath = dragWireSegment(busPath, 0, { x: 0, y: -20 })
    expect(draggedPath).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: -10 },
      { x: 100, y: -10 },
      { x: 100, y: 10 },
    ])

    const manualBus = { ...bus, points: draggedPath }
    const drop = { id: 'drop', from: { componentId: 'c', pinId: '13' }, to: { componentId: 'd', pinId: '1' } }

    const junctions = findJunctions([manualBus, drop], components)
    expect(junctions).toHaveLength(1)
    expect(junctions[0].point).toEqual({ x: 70, y: -10 })
    expect(junctions[0].wireIds.sort()).toEqual(['bus', 'drop'])
  })
})

describe('findCrossings / pathWithHops', () => {
  const crossComponents: Record<string, ComponentInstance> = {
    e1: instance({ id: 'e1', type: 'lamp', x: -15, y: 35 }),
    e2: instance({ id: 'e2', type: 'lamp', x: 85, y: 35 }),
    f1: instance({ id: 'f1', type: 'lamp', x: 35, y: -15 }),
    f2: instance({ id: 'f2', type: 'lamp', x: 35, y: 85 }),
  }
  const horizontal = { id: 'h', from: { componentId: 'e1', pinId: '1' }, to: { componentId: 'e2', pinId: '1' } }
  const vertical = { id: 'v', from: { componentId: 'f1', pinId: '1' }, to: { componentId: 'f2', pinId: '1' } }

  it('finds a crossing at the interior intersection of two unrelated wires', () => {
    // e1.1 (0,35) -> e2.1 (100,35): horizontal at y=35.
    // f1.1 (50,-15) -> f2.1 (50,85): vertical at x=50. They cross at (50,35).
    const crossings = findCrossings([horizontal, vertical], crossComponents)
    expect(crossings).toHaveLength(1)
    expect(crossings[0].point).toEqual({ x: 50, y: 35 })
    expect(crossings[0].wireIds.slice().sort()).toEqual(['h', 'v'])
  })

  it('does not report a crossing for wires sharing an endpoint pin', () => {
    const shared = { id: 'h2', from: { componentId: 'e1', pinId: '1' }, to: { componentId: 'f1', pinId: '1' } }
    const crossings = findCrossings([shared, vertical], crossComponents)
    expect(crossings).toHaveLength(0)
  })

  it('does not report a crossing for parallel wires', () => {
    const parallel = { id: 'h2', from: { componentId: 'e1', pinId: '2' }, to: { componentId: 'e2', pinId: '2' } }
    const crossings = findCrossings([horizontal, parallel], crossComponents)
    expect(crossings).toHaveLength(0)
  })

  it('onlyInvolving restricts results to pairs touching one of the given wire ids', () => {
    // A third wire crossing `vertical` too, but positioned well clear of `horizontal`.
    const g1 = instance({ id: 'g1', type: 'lamp', x: -15, y: 65 })
    const g2 = instance({ id: 'g2', type: 'lamp', x: 85, y: 65 })
    const componentsWithThird = { ...crossComponents, g1, g2 }
    const third = { id: 'w3', from: { componentId: 'g1', pinId: '1' }, to: { componentId: 'g2', pinId: '1' } }

    const all = findCrossings([horizontal, vertical, third], componentsWithThird)
    expect(all).toHaveLength(2) // h x v, and w3 x v

    const restricted = findCrossings([horizontal, vertical, third], componentsWithThird, new Set(['w3']))
    expect(restricted).toHaveLength(1) // only the w3 x v pair — h x v has neither wire in the restriction set
    expect(restricted[0].wireIds.slice().sort()).toEqual(['v', 'w3'])
  })

  it('pathWithHops inserts a semicircular bump around a hop point without changing the path endpoints', () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    const hopped = pathWithHops(path, [{ x: 50, y: 50 }], 6)
    expect(hopped[0]).toEqual({ x: 0, y: 50 })
    expect(hopped[hopped.length - 1]).toEqual({ x: 100, y: 50 })
    expect(hopped.length).toBeGreaterThan(path.length)
    // The bump bulges away from the straight line at its midpoint.
    const mid = hopped[Math.floor(hopped.length / 2)]
    expect(Math.abs(mid.y - 50)).toBeCloseTo(6, 5)
  })

  it('pathWithHops is a no-op when there are no hop points', () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    expect(pathWithHops(path, [])).toBe(path)
  })

  it('pathWithHops skips a hop too close to a segment end rather than drawing a clipped bump', () => {
    const path = [{ x: 0, y: 50 }, { x: 4, y: 50 }, { x: 100, y: 50 }]
    const hopped = pathWithHops(path, [{ x: 2, y: 50 }], 6)
    expect(hopped).toEqual(path)
  })
})
