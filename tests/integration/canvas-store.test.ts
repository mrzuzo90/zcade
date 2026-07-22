import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'

function resetStore() {
  useCanvasStore.setState({
    components: {},
    order: [],
    selectedId: null,
    scale: 1,
    position: { x: 0, y: 0 },
    showGrid: true,
    snapEnabled: true,
  })
}

describe('canvas store', () => {
  beforeEach(resetStore)

  it('adds a component snapped to the grid and selects it', () => {
    const id = useCanvasStore.getState().addComponent('contactor_3p', 23, 47)
    const state = useCanvasStore.getState()
    expect(state.components[id]).toMatchObject({ x: 20, y: 50, type: 'contactor_3p', rotation: 0 })
    expect(state.selectedId).toBe(id)
    expect(state.order).toContain(id)
  })

  it('does not snap when snapping is disabled', () => {
    useCanvasStore.getState().toggleSnap()
    const id = useCanvasStore.getState().addComponent('motor_3p', 23, 47)
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 23, y: 47 })
  })

  it('rotates a component in 90 degree steps, wrapping around', () => {
    const id = useCanvasStore.getState().addComponent('motor_3p', 0, 0)
    useCanvasStore.getState().rotateComponent(id)
    expect(useCanvasStore.getState().components[id].rotation).toBe(90)
    useCanvasStore.getState().rotateComponent(id, -1)
    useCanvasStore.getState().rotateComponent(id, -1)
    expect(useCanvasStore.getState().components[id].rotation).toBe(270)
  })

  it('moves a component and snaps to grid', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useCanvasStore.getState().moveComponent(id, 34, 56)
    expect(useCanvasStore.getState().components[id]).toMatchObject({ x: 30, y: 60 })
  })

  it('removes a component and clears selection', () => {
    const id = useCanvasStore.getState().addComponent('lamp', 0, 0)
    useCanvasStore.getState().removeComponent(id)
    const state = useCanvasStore.getState()
    expect(state.components[id]).toBeUndefined()
    expect(state.order).not.toContain(id)
    expect(state.selectedId).toBeNull()
  })

  it('zooms toward the pointer, keeping the world point under it stable', () => {
    useCanvasStore.getState().zoomAt({ x: 100, y: 100 }, 2)
    const state = useCanvasStore.getState()
    expect(state.scale).toBe(2)
    expect(state.position).toEqual({ x: -100, y: -100 })
  })

  it('clamps zoom to the configured min/max scale', () => {
    useCanvasStore.getState().setScale(100)
    expect(useCanvasStore.getState().scale).toBeLessThanOrEqual(4)
    useCanvasStore.getState().setScale(0.0001)
    expect(useCanvasStore.getState().scale).toBeGreaterThanOrEqual(0.25)
  })
})
