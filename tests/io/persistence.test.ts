import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useHistoryStore } from '@/store/history'
import { useSimulationStore } from '@/store/simulation'
import { loadProject, serializeProject } from '@/io/persistence'
import { emptyZcadeFile } from '@/io/schema'
import { resetEditorStores } from '../helpers/circuits'

describe('serializeProject', () => {
  beforeEach(() => {
    resetEditorStores()
    useHistoryStore.getState().clear()
  })

  it('serializes an empty project with the current schema version and grid size', () => {
    const file = serializeProject()
    expect(file.version).toBe('1.0.0')
    expect(file.components).toEqual([])
    expect(file.wires).toEqual([])
    expect(file.meta.gridSize).toBe(10)
    expect(file.plcPrograms).toEqual({})
  })

  it('applies meta overrides', () => {
    const file = serializeProject({ title: 'My Circuit', author: 'Zuzo' })
    expect(file.meta.title).toBe('My Circuit')
    expect(file.meta.author).toBe('Zuzo')
  })

  it('serializes components/wires in their store insertion order', () => {
    const canvas = useCanvasStore.getState()
    const a = canvas.addComponent('lamp', 0, 0)
    const b = canvas.addComponent('lamp', 100, 0)
    useWireStore.getState().startWire({ componentId: a, pinId: '1' })
    useWireStore.getState().completeWire({ componentId: b, pinId: '1' })

    const file = serializeProject()
    expect(file.components.map((c) => c.id)).toEqual([a, b])
    expect(file.wires).toHaveLength(1)
    expect(file.wires[0].from).toEqual({ componentId: a, pinId: '1' })
    expect(file.wires[0].to).toEqual({ componentId: b, pinId: '1' })
  })

  it('round-trips an optional wire.points override untouched', () => {
    const canvas = useCanvasStore.getState()
    const a = canvas.addComponent('lamp', 0, 0)
    const b = canvas.addComponent('lamp', 100, 0)
    useWireStore.getState().startWire({ componentId: a, pinId: '1' })
    const wireId = useWireStore.getState().completeWire({ componentId: b, pinId: '1' })!
    useWireStore.setState((state) => ({
      wires: { ...state.wires, [wireId]: { ...state.wires[wireId], points: [{ x: 1, y: 2 }] } },
    }))

    const file = serializeProject()
    expect(file.wires[0].points).toEqual([{ x: 1, y: 2 }])
  })
})

describe('loadProject', () => {
  beforeEach(() => {
    resetEditorStores()
    useHistoryStore.getState().clear()
    useSimulationStore.getState().stop()
  })

  it('replaces canvas + wire store content wholesale', () => {
    useCanvasStore.getState().addComponent('lamp', 0, 0)
    expect(Object.keys(useCanvasStore.getState().components)).toHaveLength(1)

    loadProject(emptyZcadeFile())
    expect(useCanvasStore.getState().components).toEqual({})
    expect(useWireStore.getState().wires).toEqual({})
  })

  it('clears undo history on load', () => {
    useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    expect(useHistoryStore.getState().undoStack.length).toBeGreaterThan(0)

    loadProject(emptyZcadeFile())
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })

  it('stops a running simulation on load', () => {
    useCanvasStore.getState().addComponent('lamp', 0, 0)
    useSimulationStore.getState().start()
    expect(useSimulationStore.getState().isRunning).toBe(true)

    loadProject(emptyZcadeFile())
    expect(useSimulationStore.getState().isRunning).toBe(false)
  })

  it('preserves loaded component/wire ids verbatim (pin references stay valid)', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        {
          id: 'comp_km1',
          type: 'contactor_3p',
          label: 'KM1',
          x: 200,
          y: 150,
          rotation: 0 as const,
          properties: {},
        },
        {
          id: 'comp_h1',
          type: 'lamp',
          label: 'H1',
          x: 300,
          y: 150,
          rotation: 0 as const,
          properties: {},
        },
      ],
      wires: [
        {
          id: 'wire_1',
          from: { componentId: 'comp_km1', pinId: '2' },
          to: { componentId: 'comp_h1', pinId: '1' },
        },
      ],
    }
    loadProject(file)
    expect(useCanvasStore.getState().components['comp_km1']).toBeDefined()
    expect(useWireStore.getState().wires['wire_1']).toEqual({
      id: 'wire_1',
      from: { componentId: 'comp_km1', pinId: '2' },
      to: { componentId: 'comp_h1', pinId: '1' },
    })
  })

  it("bumps the id generator past loaded ids so a later addComponent can't collide", () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        {
          id: 'lamp_5',
          type: 'lamp',
          label: 'H1',
          x: 0,
          y: 0,
          rotation: 0 as const,
          properties: {},
        },
      ],
    }
    loadProject(file)

    const newId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    expect(newId).not.toBe('lamp_5')
    expect(useCanvasStore.getState().components[newId]).toBeDefined()
  })

  it("bumps the wire id generator past loaded wire ids so a later completeWire can't collide", () => {
    const canvas = useCanvasStore.getState()
    const a = canvas.addComponent('lamp', 0, 0)
    const b = canvas.addComponent('lamp', 100, 0)
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: a, type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0 as const, properties: {} },
        { id: b, type: 'lamp', label: 'H2', x: 100, y: 0, rotation: 0 as const, properties: {} },
      ],
      wires: [
        { id: 'wire_9', from: { componentId: a, pinId: '1' }, to: { componentId: b, pinId: '2' } },
      ],
    }
    loadProject(file)

    useWireStore.getState().startWire({ componentId: a, pinId: '2' })
    const newWireId = useWireStore.getState().completeWire({ componentId: b, pinId: '1' })
    expect(newWireId).not.toBe('wire_9')
  })

  it('does not reset view state (scale/position/grid/snap) on load', () => {
    useCanvasStore.getState().setScale(2)
    useCanvasStore.getState().setPosition({ x: 123, y: 45 })
    useCanvasStore.getState().toggleGrid()

    loadProject(emptyZcadeFile())

    expect(useCanvasStore.getState().scale).toBe(2)
    expect(useCanvasStore.getState().position).toEqual({ x: 123, y: 45 })
    expect(useCanvasStore.getState().showGrid).toBe(false)
  })
})
