import { describe, expect, it } from 'vitest'
import type { ComponentInstance } from '@/types/circuit'
import { findJunctions, getPinPosition, getWirePath, routeOrthogonal } from '@/engine/wiring'

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
