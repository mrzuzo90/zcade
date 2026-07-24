import { describe, expect, it } from 'vitest'
import type { ComponentInstance, Wire } from '@/types/circuit'
import { WireGeometryCache } from '@/engine/wireGeometryCache'

function instance(overrides: Partial<ComponentInstance> & Pick<ComponentInstance, 'id' | 'type' | 'x' | 'y'>): ComponentInstance {
  return { label: '', rotation: 0, properties: {}, ...overrides }
}

describe('WireGeometryCache', () => {
  it('reuses the same path array reference for a wire whose endpoints did not move', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 200, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 300, y: 0 }),
    }
    const wires: Wire[] = [
      { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } },
      { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } },
    ]

    const first = cache.update(wires, components)
    expect(first.changed).toEqual(new Set(['w1', 'w2'])) // everything is new on the first pass

    // Move only component 'a' (new object reference for 'a', b/c/d unchanged) — mirrors canvas.ts's moveComponent.
    const movedComponents = { ...components, a: { ...components.a, x: 10 } }
    const second = cache.update(wires, movedComponents)

    expect(second.changed).toEqual(new Set(['w1'])) // only the wire touching 'a' is affected
    expect(second.paths['w2']).toBe(first.paths['w2']) // w2's path array is the exact same reference — not recomputed
    expect(second.paths['w1']).not.toBe(first.paths['w1']) // w1 legitimately changed
  })

  it('recomputes only pairs touching a changed wire when finding junctions incrementally', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'push_button_no', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'push_button_no', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'push_button_no', x: 70, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 55, y: 50 }),
    }
    const bus: Wire = {
      id: 'bus',
      from: { componentId: 'a', pinId: '14' },
      to: { componentId: 'b', pinId: '13' },
      points: [{ x: 40, y: 10 }, { x: 100, y: 10 }],
    }
    const drop: Wire = { id: 'drop', from: { componentId: 'c', pinId: '13' }, to: { componentId: 'd', pinId: '1' } }

    const first = cache.update([bus, drop], components)
    expect(first.junctions).toHaveLength(1)
    expect(first.junctions[0].wireIds.sort()).toEqual(['bus', 'drop'])

    // Move an unrelated, unconnected component — the junction must survive untouched (same array reference).
    const unrelated = instance({ id: 'z', type: 'lamp', x: 500, y: 500 })
    const withUnrelated = { ...components, z: unrelated }
    const secondWires = [bus, drop]
    const second = cache.update(secondWires, withUnrelated)
    expect(second.changed.size).toBe(0) // nothing wire-relevant moved
    expect(second.junctions).toBe(first.junctions) // reused verbatim, no recompute
  })

  it('drops a junction when the wire that caused it is removed', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'push_button_no', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'push_button_no', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'push_button_no', x: 70, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 55, y: 50 }),
    }
    const bus: Wire = {
      id: 'bus',
      from: { componentId: 'a', pinId: '14' },
      to: { componentId: 'b', pinId: '13' },
      points: [{ x: 40, y: 10 }, { x: 100, y: 10 }],
    }
    const drop: Wire = { id: 'drop', from: { componentId: 'c', pinId: '13' }, to: { componentId: 'd', pinId: '1' } }

    cache.update([bus, drop], components)
    const after = cache.update([bus], components) // 'drop' removed
    expect(after.junctions).toHaveLength(0)
  })

  it('clear() resets memoized state so the next update behaves like a cold cache', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    }
    const wires: Wire[] = [{ id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }]
    cache.update(wires, components)
    cache.clear()
    const after = cache.update(wires, components)
    expect(after.changed).toEqual(new Set(['w1']))
  })

  it('recomputes overlaps only for pairs touching a changed wire', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
    }
    const w1: Wire = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    const w2: Wire = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }

    const first = cache.update([w1, w2], components)
    expect(first.overlaps).toHaveLength(1)
    expect(first.overlaps[0].wireIds.slice().sort()).toEqual(['w1', 'w2'])

    // Move an unrelated component — the overlap must survive untouched (same array reference).
    const unrelated = instance({ id: 'z', type: 'lamp', x: 500, y: 500 })
    const second = cache.update([w1, w2], { ...components, z: unrelated })
    expect(second.changed.size).toBe(0)
    expect(second.overlaps).toBe(first.overlaps)
  })

  it('drops an overlap when the wire that caused it is removed', () => {
    const cache = new WireGeometryCache()
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
    }
    const w1: Wire = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    const w2: Wire = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }

    cache.update([w1, w2], components)
    const after = cache.update([w1], components)
    expect(after.overlaps).toHaveLength(0)
  })
})
