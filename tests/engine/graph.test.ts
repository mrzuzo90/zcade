import { describe, expect, it } from 'vitest'
import type { ComponentInstance, Wire } from '@/types/circuit'
import { buildCircuitGraph } from '@/engine/graph'

function instance(overrides: Partial<ComponentInstance> & Pick<ComponentInstance, 'id' | 'type' | 'x' | 'y'>): ComponentInstance {
  return { label: '', rotation: 0, properties: {}, ...overrides }
}

describe('buildCircuitGraph', () => {
  it('groups two directly wired pins into one net', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    }
    const wires: Wire[] = [{ id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }]

    const { nets, pinToNet } = buildCircuitGraph(components, wires)
    expect(nets).toHaveLength(1)
    expect(nets[0].pins).toHaveLength(2)
    expect(nets[0].wireIds).toEqual(['w1'])
    expect(pinToNet['a:1']).toBe(nets[0].id)
    expect(pinToNet['b:1']).toBe(nets[0].id)
  })

  it('keeps electrically separate wires in separate nets', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 0, y: 200 }),
      d: instance({ id: 'd', type: 'lamp', x: 100, y: 200 }),
    }
    const wires: Wire[] = [
      { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } },
      { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } },
    ]

    const { nets } = buildCircuitGraph(components, wires)
    expect(nets).toHaveLength(2)
  })

  it('merges a T-junction tap into the host wire net', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'push_button_no', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'push_button_no', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'push_button_no', x: 70, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 55, y: 50 }),
    }
    const wires: Wire[] = [
      // Needs an explicit manual route to be eligible as a tap host — see findJunctions' doc comment.
      {
        id: 'w1',
        from: { componentId: 'a', pinId: '14' },
        to: { componentId: 'b', pinId: '13' },
        points: [
          { x: 40, y: 10 },
          { x: 100, y: 10 },
        ],
      },
      { id: 'w2', from: { componentId: 'c', pinId: '13' }, to: { componentId: 'd', pinId: '1' } },
    ]

    const { nets } = buildCircuitGraph(components, wires)
    expect(nets).toHaveLength(1)
    expect(nets[0].pins).toHaveLength(4)
    expect(nets[0].wireIds.sort()).toEqual(['w1', 'w2'])
  })

  it('produces no nets when there are no wires', () => {
    const { nets, pinToNet } = buildCircuitGraph({}, [])
    expect(nets).toEqual([])
    expect(pinToNet).toEqual({})
  })
})
