import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore, TICK_MS } from '@/store/simulation'

function resetStores() {
  useSimulationStore.getState().stop()
  useCanvasStore.setState({ components: {}, order: [], selectedId: null, scale: 1, position: { x: 0, y: 0 } })
  useWireStore.setState({ wires: {}, order: [], selectedWireId: null, pendingFrom: null })
}

describe('simulation store', () => {
  beforeEach(() => {
    resetStores()
  })

  afterEach(() => {
    useSimulationStore.getState().stop()
    vi.useRealTimers()
  })

  it('lights a directly-wired lamp after starting and ticking', () => {
    vi.useFakeTimers()
    const srcId = useCanvasStore.getState().addComponent('power_source_dc', 0, 0)
    const lampId = useCanvasStore.getState().addComponent('lamp', 100, 0)
    useWireStore.setState({
      wires: {
        w1: { id: 'w1', from: { componentId: srcId, pinId: '+24V' }, to: { componentId: lampId, pinId: '1' } },
        w2: { id: 'w2', from: { componentId: srcId, pinId: '0V' }, to: { componentId: lampId, pinId: '2' } },
      },
      order: ['w1', 'w2'],
      selectedWireId: null,
      pendingFrom: null,
    })

    useSimulationStore.getState().start()
    expect(useSimulationStore.getState().isRunning).toBe(true)

    vi.advanceTimersByTime(TICK_MS)
    const state = useSimulationStore.getState()
    expect(state.tickCount).toBeGreaterThanOrEqual(1)
    expect(state.componentStates[lampId].lit).toBe(true)
  })

  it('resets everything on stop, like a cabinet losing power', () => {
    vi.useFakeTimers()
    const srcId = useCanvasStore.getState().addComponent('power_source_dc', 0, 0)
    const lampId = useCanvasStore.getState().addComponent('lamp', 100, 0)
    useWireStore.setState({
      wires: {
        w1: { id: 'w1', from: { componentId: srcId, pinId: '+24V' }, to: { componentId: lampId, pinId: '1' } },
        w2: { id: 'w2', from: { componentId: srcId, pinId: '0V' }, to: { componentId: lampId, pinId: '2' } },
      },
      order: ['w1', 'w2'],
      selectedWireId: null,
      pendingFrom: null,
    })

    useSimulationStore.getState().start()
    vi.advanceTimersByTime(TICK_MS)
    expect(useSimulationStore.getState().componentStates[lampId].lit).toBe(true)

    useSimulationStore.getState().stop()
    const state = useSimulationStore.getState()
    expect(state.isRunning).toBe(false)
    expect(state.tickCount).toBe(0)
    expect(state.componentStates).toEqual({})

    // The interval must actually be cleared — advancing time after stop shouldn't tick.
    vi.advanceTimersByTime(TICK_MS * 5)
    expect(useSimulationStore.getState().tickCount).toBe(0)
  })

  it('setPressed drives a pushbutton input that tick() picks up', () => {
    const srcId = useCanvasStore.getState().addComponent('power_source_dc', 0, 0)
    const buttonId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)
    const lampId = useCanvasStore.getState().addComponent('lamp', 200, 0)
    useWireStore.setState({
      wires: {
        w1: { id: 'w1', from: { componentId: srcId, pinId: '+24V' }, to: { componentId: buttonId, pinId: '13' } },
        w2: { id: 'w2', from: { componentId: buttonId, pinId: '14' }, to: { componentId: lampId, pinId: '1' } },
        w3: { id: 'w3', from: { componentId: srcId, pinId: '0V' }, to: { componentId: lampId, pinId: '2' } },
      },
      order: ['w1', 'w2', 'w3'],
      selectedWireId: null,
      pendingFrom: null,
    })

    useSimulationStore.getState().tick()
    expect(useSimulationStore.getState().componentStates[lampId].lit).toBe(false)

    useSimulationStore.getState().setPressed(buttonId, true)
    useSimulationStore.getState().tick()
    expect(useSimulationStore.getState().componentStates[lampId].lit).toBe(true)

    useSimulationStore.getState().setPressed(buttonId, false)
    useSimulationStore.getState().tick()
    expect(useSimulationStore.getState().componentStates[lampId].lit).toBe(false)
  })
})
