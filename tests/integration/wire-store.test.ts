import { beforeEach, describe, expect, it } from 'vitest'
import { useWireStore } from '@/store/wires'

function resetStore() {
  useWireStore.setState({ wires: {}, order: [], selectedWireId: null, pendingFrom: null })
}

describe('wire store', () => {
  beforeEach(resetStore)

  it('completes a pending wire between two distinct pins', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    expect(useWireStore.getState().pendingFrom).toEqual({ componentId: 'a', pinId: '1' })

    const id = useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })
    expect(id).not.toBeNull()
    const state = useWireStore.getState()
    expect(state.wires[id!]).toMatchObject({
      from: { componentId: 'a', pinId: '1' },
      to: { componentId: 'b', pinId: '1' },
    })
    expect(state.pendingFrom).toBeNull()
    expect(state.selectedWireId).toBe(id)
  })

  it('rejects completing a wire onto the same pin it started from', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    const id = useWireStore.getState().completeWire({ componentId: 'a', pinId: '1' })
    expect(id).toBeNull()
    expect(useWireStore.getState().wires).toEqual({})
    expect(useWireStore.getState().pendingFrom).toBeNull()
  })

  it('rejects a duplicate wire between an already-connected pin pair', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })

    // Same pair, reversed direction — still a duplicate.
    useWireStore.getState().startWire({ componentId: 'b', pinId: '1' })
    const id = useWireStore.getState().completeWire({ componentId: 'a', pinId: '1' })
    expect(id).toBeNull()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(1)
  })

  it('cancelWire clears a pending wire without creating one', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().cancelWire()
    expect(useWireStore.getState().pendingFrom).toBeNull()
  })

  it('removeWiresForComponent purges every wire touching that component', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })
    useWireStore.getState().startWire({ componentId: 'a', pinId: '2' })
    useWireStore.getState().completeWire({ componentId: 'c', pinId: '1' })
    useWireStore.getState().startWire({ componentId: 'b', pinId: '2' })
    useWireStore.getState().completeWire({ componentId: 'c', pinId: '2' })

    useWireStore.getState().removeWiresForComponent('a')
    const state = useWireStore.getState()
    expect(Object.keys(state.wires)).toHaveLength(1)
    const remaining = Object.values(state.wires)[0]
    expect(remaining.from.componentId === 'a' || remaining.to.componentId === 'a').toBe(false)
  })

  it('setWireType assigns an electrical role to a wire', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    const id = useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })!
    useWireStore.getState().setWireType(id, 'L1')
    expect(useWireStore.getState().wires[id].wireType).toBe('L1')
  })
})
