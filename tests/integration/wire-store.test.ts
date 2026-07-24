import { beforeEach, describe, expect, it } from 'vitest'
import { useWireStore } from '@/store/wires'
import { useCanvasStore } from '@/store/canvas'

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

describe('wire store — suggestedWireType auto-assignment', () => {
  beforeEach(() => {
    resetStore()
    useCanvasStore.setState({ components: {}, order: [], selectedId: null })
  })

  it('auto-assigns wireType when only one endpoint declares a hint', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const buttonId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' }) // suggestedWireType 'N'
    const id = useWireStore.getState().completeWire({ componentId: buttonId, pinId: '13' })! // no hint
    expect(useWireStore.getState().wires[id].wireType).toBe('N')
  })

  it('auto-assigns wireType when both endpoints agree', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const contactorId = useCanvasStore.getState().addComponent('contactor_3p', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' }) // 'N'
    const id = useWireStore.getState().completeWire({ componentId: contactorId, pinId: 'A2' })! // 'N'
    expect(useWireStore.getState().wires[id].wireType).toBe('N')
  })

  it('does not auto-assign when both endpoints disagree', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const contactorId = useCanvasStore.getState().addComponent('contactor_3p', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '1' }) // 'L1'
    const id = useWireStore.getState().completeWire({ componentId: contactorId, pinId: 'A2' })! // 'N'
    expect(useWireStore.getState().wires[id].wireType).toBeUndefined()
  })

  it('does not auto-assign when neither endpoint declares a hint', () => {
    const aId = useCanvasStore.getState().addComponent('push_button_no', 0, 0)
    const bId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: aId, pinId: '13' })
    const id = useWireStore.getState().completeWire({ componentId: bId, pinId: '13' })!
    expect(useWireStore.getState().wires[id].wireType).toBeUndefined()
  })

  it('manual setWireType still overrides an auto-assigned value', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const buttonId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' })
    const id = useWireStore.getState().completeWire({ componentId: buttonId, pinId: '13' })!
    expect(useWireStore.getState().wires[id].wireType).toBe('N')

    useWireStore.getState().setWireType(id, 'PE')
    expect(useWireStore.getState().wires[id].wireType).toBe('PE')
  })
})
