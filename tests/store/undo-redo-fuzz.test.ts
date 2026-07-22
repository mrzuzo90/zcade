import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useHistoryStore } from '@/store/history'

function resetAll() {
  useCanvasStore.setState({
    components: {},
    order: [],
    selectedId: null,
    scale: 1,
    position: { x: 0, y: 0 },
    showGrid: true,
    snapEnabled: true,
  })
  useWireStore.setState({ wires: {}, order: [], selectedWireId: null, pendingFrom: null })
  useHistoryStore.getState().clear()
}

describe('cross-store transaction grouping', () => {
  beforeEach(resetAll)

  it('deleting a component cascades to its wires as ONE undo step (mirrors CanvasStage/Toolbar delete-key handler)', () => {
    const km1 = useCanvasStore.getState().addComponent('contactor_3p', 0, 0)
    useHistoryStore.getState().flush()
    const lamp = useCanvasStore.getState().addComponent('lamp', 200, 0)
    useHistoryStore.getState().flush()
    useWireStore.getState().startWire({ componentId: km1, pinId: 'A1' })
    useWireStore.getState().completeWire({ componentId: lamp, pinId: '1' })
    useHistoryStore.getState().flush()

    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(1)
    const stackBefore = useHistoryStore.getState().undoStack.length

    // The EXACT call sequence CanvasStage's Delete/Backspace handler and
    // Toolbar's "Eliminar" button use — two independent store calls, with
    // neither call site aware of the other or of history.
    useWireStore.getState().removeWiresForComponent(km1)
    useCanvasStore.getState().removeComponent(km1)
    useHistoryStore.getState().flush()

    expect(useCanvasStore.getState().components[km1]).toBeUndefined()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(0)
    expect(useHistoryStore.getState().undoStack.length).toBe(stackBefore + 1)

    useHistoryStore.getState().undo()
    expect(useCanvasStore.getState().components[km1]).toBeDefined()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(1)

    useHistoryStore.getState().redo()
    expect(useCanvasStore.getState().components[km1]).toBeUndefined()
    expect(Object.keys(useWireStore.getState().wires)).toHaveLength(0)
  })
})

describe('undo/redo fuzz test', () => {
  beforeEach(resetAll)

  function randomInt(n: number) {
    return Math.floor(Math.random() * n)
  }

  it('random sequences of canvas operations fully undo back to the initial state', () => {
    const TYPES = ['lamp', 'motor_3p', 'contactor_3p', 'push_button_no', 'circuit_breaker_3p']
    const OPS_COUNT = 150 // stays comfortably under the 200-entry cap

    for (let i = 0; i < OPS_COUNT; i++) {
      const ids = useCanvasStore.getState().order
      const op = ids.length === 0 ? 'add' : (['add', 'move', 'rotate', 'remove'] as const)[randomInt(4)]

      switch (op) {
        case 'add':
          useCanvasStore.getState().addComponent(TYPES[randomInt(TYPES.length)], randomInt(500), randomInt(500))
          break
        case 'move':
          useCanvasStore.getState().moveComponent(ids[randomInt(ids.length)], randomInt(500), randomInt(500))
          break
        case 'rotate':
          useCanvasStore.getState().rotateComponent(ids[randomInt(ids.length)], Math.random() < 0.5 ? 1 : -1)
          break
        case 'remove':
          useCanvasStore.getState().removeComponent(ids[randomInt(ids.length)])
          break
      }
      // One flush per iteration: each fuzzed operation is its own undo step,
      // matching one discrete user gesture (a real drag/click/keypress is
      // always a separate JS turn from the next — see history.ts).
      useHistoryStore.getState().flush()
    }

    // Sanity check: the fuzz actually did something.
    expect(useHistoryStore.getState().undoStack.length).toBeGreaterThan(0)

    let guard = 0
    while (useHistoryStore.getState().undoStack.length > 0 && guard < 10_000) {
      useHistoryStore.getState().undo()
      guard++
    }

    expect(useHistoryStore.getState().redoStack.length).toBe(guard)

    const final = useCanvasStore.getState()
    expect(final.components).toEqual({})
    expect(final.order).toEqual([])
    expect(final.selectedId).toBeNull()

    // Redo everything and confirm no crash / stable end state (not
    // necessarily identical to the pre-undo snapshot component-for-component,
    // since ids are freshly generated per addComponent call — but the SHAPE
    // (counts) must match what we had right before undoing).
    const countBeforeUndo = guard
    let redone = 0
    while (useHistoryStore.getState().redoStack.length > 0) {
      useHistoryStore.getState().redo()
      redone++
    }
    expect(redone).toBe(countBeforeUndo)
  })

  it('random sequences of wire operations (paired start+complete, remove) fully undo back to the initial state', () => {
    // Seed a handful of components to wire up.
    const ids = Array.from({ length: 5 }, (_, i) => useCanvasStore.getState().addComponent('lamp', i * 40, 0))
    useHistoryStore.getState().flush()
    useHistoryStore.getState().clear() // only fuzzing wire history from here

    const OPS_COUNT = 100
    for (let i = 0; i < OPS_COUNT; i++) {
      const wireIds = useWireStore.getState().order
      const canConnect = ids.length >= 2
      const op = wireIds.length === 0 || !canConnect ? 'add' : (['add', 'remove'] as const)[randomInt(2)]

      if (op === 'add' && canConnect) {
        const a = ids[randomInt(ids.length)]
        let b = ids[randomInt(ids.length)]
        if (b === a) b = ids[(ids.indexOf(a) + 1) % ids.length]
        useWireStore.getState().startWire({ componentId: a, pinId: '1' })
        useWireStore.getState().completeWire({ componentId: b, pinId: '2' })
      } else if (wireIds.length > 0) {
        useWireStore.getState().removeWire(wireIds[randomInt(wireIds.length)])
      }
      useHistoryStore.getState().flush()
    }

    let guard = 0
    while (useHistoryStore.getState().undoStack.length > 0 && guard < 10_000) {
      useHistoryStore.getState().undo()
      guard++
    }

    expect(useWireStore.getState().wires).toEqual({})
    expect(useWireStore.getState().order).toEqual([])
  })
})
