import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useHistoryStore } from '@/store/history'

function reset() {
  useCanvasStore.setState({
    components: {},
    order: [],
    selectedId: null,
    scale: 1,
    position: { x: 0, y: 0 },
    showGrid: true,
    snapEnabled: true,
  })
  useHistoryStore.getState().clear()
}

describe('canvas store — command/undo/redo', () => {
  beforeEach(reset)

  it('undoes and redoes addComponent', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 10, 10)
    useHistoryStore.getState().flush()
    expect(useCanvasStore.getState().components[id]).toBeDefined()
    expect(useCanvasStore.getState().selectedId).toBe(id)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[id]).toBeUndefined()
    expect(useCanvasStore.getState().order).not.toContain(id)
    expect(useCanvasStore.getState().selectedId).toBeNull()

    useHistoryStore.getState().redo()
    expect(useCanvasStore.getState().components[id]).toBeDefined()
    expect(useCanvasStore.getState().selectedId).toBe(id)
  })

  it('undo restores the selection that existed before the add', () => {
    const first = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    const second = useCanvasStore.getState().addComponent('lamp', 50, 50)
    useHistoryStore.getState().flush()
    expect(useCanvasStore.getState().selectedId).toBe(second)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().selectedId).toBe(first)
  })

  it('undoes and redoes moveComponent', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()

    useCanvasStore.getState().moveComponent(id, 40, 70)
    useHistoryStore.getState().flush()
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 40, y: 70 })

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 0, y: 0 })

    useHistoryStore.getState().redo()
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 40, y: 70 })
  })

  it('coalesces rapid successive moves of the SAME component into one undo step', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()

    useCanvasStore.getState().moveComponent(id, 10, 10)
    useHistoryStore.getState().flush()
    useCanvasStore.getState().moveComponent(id, 20, 20)
    useHistoryStore.getState().flush()
    useCanvasStore.getState().moveComponent(id, 30, 30)
    useHistoryStore.getState().flush()

    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 30, y: 30 })
    // 1 add + 1 coalesced move-chain = 2 undo entries.
    expect(useHistoryStore.getState().undoStack).toHaveLength(2)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 0, y: 0 })
  })

  it('does not coalesce moves belonging to different components', () => {
    const a = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    const b = useCanvasStore.getState().addComponent('lamp', 100, 100)
    useHistoryStore.getState().flush()

    useCanvasStore.getState().moveComponent(a, 10, 10)
    useHistoryStore.getState().flush()
    useCanvasStore.getState().moveComponent(b, 110, 110)
    useHistoryStore.getState().flush()

    expect(useHistoryStore.getState().undoStack).toHaveLength(4)
    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[b]).toMatchObject({ x: 100, y: 100 })
    expect(useCanvasStore.getState().components[a]).toMatchObject({ x: 10, y: 10 })
  })

  it('undoes and redoes rotateComponent', () => {
    const id = useCanvasStore.getState().addComponent('motor_3p', 0, 0)
    useHistoryStore.getState().flush()

    useCanvasStore.getState().rotateComponent(id)
    useHistoryStore.getState().flush()
    expect(useCanvasStore.getState().components[id].rotation).toBe(90)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[id].rotation).toBe(0)

    useHistoryStore.getState().redo()
    expect(useCanvasStore.getState().components[id].rotation).toBe(90)
  })

  it('undoes and redoes removeComponent, restoring its original position in `order`', () => {
    const a = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    const b = useCanvasStore.getState().addComponent('lamp', 10, 10)
    useHistoryStore.getState().flush()
    const c = useCanvasStore.getState().addComponent('lamp', 20, 20)
    useHistoryStore.getState().flush()

    // c is the currently-selected component (addComponent selects the newest);
    // removing b (unselected) must leave the selection on c untouched.
    useCanvasStore.getState().removeComponent(b)
    useHistoryStore.getState().flush()
    expect(useCanvasStore.getState().order).toEqual([a, c])
    expect(useCanvasStore.getState().selectedId).toBe(c)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().order).toEqual([a, b, c])
    expect(useCanvasStore.getState().components[b]).toBeDefined()

    useHistoryStore.getState().redo()
    expect(useCanvasStore.getState().order).toEqual([a, c])
    expect(useCanvasStore.getState().components[b]).toBeUndefined()
  })

  it('caps history at 200 entries even under many single-component edits', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    for (let i = 0; i < 205; i++) {
      useCanvasStore.getState().rotateComponent(id)
      useHistoryStore.getState().flush()
    }
    expect(useHistoryStore.getState().undoStack.length).toBeLessThanOrEqual(200)
  })
})
