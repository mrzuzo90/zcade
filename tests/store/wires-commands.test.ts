import { beforeEach, describe, expect, it } from 'vitest'
import { useWireStore } from '@/store/wires'
import { useHistoryStore, Transaction } from '@/store/history'

function reset() {
  useWireStore.setState({ wires: {}, order: [], selectedWireId: null, pendingFrom: null })
  useHistoryStore.getState().clear()
}

describe('wire store — command/undo/redo', () => {
  beforeEach(reset)

  it('undoes and redoes wire creation (completeWire)', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    const id = useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })!
    useHistoryStore.getState().flush()
    expect(useWireStore.getState().wires[id]).toBeDefined()
    expect(useWireStore.getState().pendingFrom).toBeNull()

    useHistoryStore.getState().undo()
    expect(useWireStore.getState().wires[id]).toBeUndefined()

    useHistoryStore.getState().redo()
    expect(useWireStore.getState().wires[id]).toMatchObject({
      from: { componentId: 'a', pinId: '1' },
      to: { componentId: 'b', pinId: '1' },
    })
  })

  it('rejected completeWire attempts (same pin / duplicate) are not undoable content', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    const rejected = useWireStore.getState().completeWire({ componentId: 'a', pinId: '1' })
    expect(rejected).toBeNull()
    useHistoryStore.getState().flush()
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
  })

  it('undoes and redoes removeWire, restoring its position in `order`', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })
    useHistoryStore.getState().flush()
    useWireStore.getState().startWire({ componentId: 'a', pinId: '2' })
    const id = useWireStore.getState().completeWire({ componentId: 'c', pinId: '1' })!
    useHistoryStore.getState().flush()

    useWireStore.getState().removeWire(id)
    useHistoryStore.getState().flush()
    expect(useWireStore.getState().wires[id]).toBeUndefined()
    expect(useWireStore.getState().order).toHaveLength(1)

    useHistoryStore.getState().undo()
    expect(useWireStore.getState().wires[id]).toBeDefined()
    expect(useWireStore.getState().order).toHaveLength(2)

    useHistoryStore.getState().redo()
    expect(useWireStore.getState().wires[id]).toBeUndefined()
  })

  it('undoes and redoes setWireType', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    const id = useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })!
    useHistoryStore.getState().flush()

    useWireStore.getState().setWireType(id, 'L1')
    useHistoryStore.getState().flush()
    expect(useWireStore.getState().wires[id].wireType).toBe('L1')

    useHistoryStore.getState().undo()
    expect(useWireStore.getState().wires[id].wireType).toBeUndefined()

    useHistoryStore.getState().redo()
    expect(useWireStore.getState().wires[id].wireType).toBe('L1')
  })

  it('removeWiresForComponent cascades as ONE undo step (transaction group)', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })
    useHistoryStore.getState().flush()
    useWireStore.getState().startWire({ componentId: 'a', pinId: '2' })
    useWireStore.getState().completeWire({ componentId: 'c', pinId: '1' })
    useHistoryStore.getState().flush()
    useWireStore.getState().startWire({ componentId: 'b', pinId: '2' })
    useWireStore.getState().completeWire({ componentId: 'c', pinId: '2' })
    useHistoryStore.getState().flush()

    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(3)
    const stackBefore = useHistoryStore.getState().undoStack.length

    useWireStore.getState().removeWiresForComponent('a')
    useHistoryStore.getState().flush()

    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(1)
    const stack = useHistoryStore.getState().undoStack
    expect(stack.length).toBe(stackBefore + 1)
    expect(stack[stack.length - 1]).toBeInstanceOf(Transaction)

    useHistoryStore.getState().undo()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(3)

    useHistoryStore.getState().redo()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(1)
  })

  it('removeWiresForComponent with nothing to remove pushes no history entry', () => {
    useWireStore.getState().startWire({ componentId: 'a', pinId: '1' })
    useWireStore.getState().completeWire({ componentId: 'b', pinId: '1' })
    useHistoryStore.getState().flush()
    const stackBefore = useHistoryStore.getState().undoStack.length

    useWireStore.getState().removeWiresForComponent('unrelated')
    useHistoryStore.getState().flush()

    expect(useHistoryStore.getState().undoStack.length).toBe(stackBefore)
  })
})
