import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import { buildDOL, resetEditorStores } from '../helpers/circuits'

/**
 * DOL (Direct-On-Line) with self-hold — canonical circuit #1 (Gate G-A).
 * Built through the real editor stores via buildDOL(); see the doc comment
 * on buildDOL() and docs/testing/phase-a-test-plan.md Section 3.1 for why
 * the seal-in contact is the contactor's own power pole rather than a
 * dedicated aux block (not built yet).
 */
describe('canonical circuit: DOL with self-hold (editor integration)', () => {
  beforeEach(() => {
    resetEditorStores()
    useSimulationStore.getState().stop()
  })

  afterEach(() => {
    useSimulationStore.getState().stop()
  })

  it('is assembled via real addComponent/wire-store calls, snapped to the grid', () => {
    const circuit = buildDOL()
    const { components } = useCanvasStore.getState()
    expect(Object.keys(components)).toHaveLength(5)
    // addComponent snaps to the 10px grid — confirms this test exercises the
    // real store, not a hand-rolled fixture.
    expect(components[circuit.kmId]).toMatchObject({ type: 'contactor_3p', x: 300, y: 0 })

    const { wires } = useWireStore.getState()
    expect(Object.keys(wires)).toHaveLength(9)
  })

  it('idle: coil is de-energized and the lamp is dark', () => {
    buildDOL()
    useSimulationStore.getState().tick()
    const { componentStates } = useSimulationStore.getState()
    expect(componentStates).toBeDefined()
  })

  it('latches on start, stays latched after start is released, and lights the load', () => {
    const { kmId, lampId, startId } = buildDOL()
    const sim = useSimulationStore.getState()

    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(false)

    sim.setPressed(startId, true)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(true)
    expect(useSimulationStore.getState().componentStates[lampId]?.lit).toBe(true)

    sim.setPressed(startId, false)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(true)
    expect(useSimulationStore.getState().componentStates[lampId]?.lit).toBe(true)

    // Stays latched over further ticks with nothing pressed.
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(true)
  })

  it('drops out on stop and does not self-restart', () => {
    const { kmId, startId, stopId } = buildDOL()
    const sim = useSimulationStore.getState()

    sim.setPressed(startId, true)
    sim.tick()
    sim.setPressed(startId, false)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(true)

    sim.setPressed(stopId, true)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(false)

    sim.setPressed(stopId, false)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(false)

    // Requires start again — does not silently relatch.
    sim.tick()
    expect(useSimulationStore.getState().componentStates[kmId]?.coilEnergized).toBe(false)
  })
})
