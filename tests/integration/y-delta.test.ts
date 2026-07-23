import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from '@/store/simulation'
import { buildYDelta, resetEditorStores } from '../helpers/circuits'

/**
 * Auto Y-Δ (star-delta) starter — canonical circuit #3 (Gate G-A).
 *
 * Was BLOCKED (no TON timer, no 6-wire motor) — see the git history of this
 * file and `tests/helpers/circuits.ts`'s `buildYDelta()` doc comment. Both
 * landed this session (SOLV, Phase A Week 2): `timer_ton` and
 * `motor_3p_6wire` in `src/components/symbols/library.ts`, tick-accumulation
 * and Y/Δ wiring detection in `src/engine/solver.ts`. `presetMs` is set to
 * 60ms (3 ticks at the 20ms/50Hz tick) so these tests advance a small,
 * deterministic number of ticks instead of the 150 ticks a real 3s preset
 * would need.
 */
describe('canonical circuit: Auto Y-Δ (star-delta)', () => {
  beforeEach(() => {
    resetEditorStores()
    useSimulationStore.getState().stop()
  })

  afterEach(() => {
    useSimulationStore.getState().stop()
  })

  it('star closes immediately on start (delta stays open), and the motor runs', () => {
    const { km1Id, km2Id, km3Id, motorId, startId } = buildYDelta(60)
    const sim = useSimulationStore.getState()

    sim.setPressed(startId, true)
    sim.tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[km3Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[motorId]?.motorWiring).toBe('star')
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
  })

  it('stays in star with no premature switch until the timer preset elapses', () => {
    const { km2Id, km3Id, startId } = buildYDelta(60) // 60ms preset = 3 ticks
    const sim = useSimulationStore.getState()

    sim.setPressed(startId, true)
    for (let i = 0; i < 3; i++) sim.tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[km3Id]?.coilEnergized).toBe(false)
  })

  it('switches star -> delta in the SAME tick transition once the timer preset elapses, and the motor keeps running', () => {
    const { km2Id, km3Id, motorId, startId } = buildYDelta(60)
    const sim = useSimulationStore.getState()

    sim.setPressed(startId, true)
    for (let i = 0; i < 4; i++) sim.tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[km3Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[motorId]?.motorWiring).toBe('delta')
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
  })

  it('never has star and delta simultaneously closed across the whole start sequence (no line-to-line short across the motor windings)', () => {
    const { km2Id, km3Id, startId } = buildYDelta(60)
    const sim = useSimulationStore.getState()

    sim.setPressed(startId, true)
    for (let i = 0; i < 20; i++) {
      sim.tick()
      const state = useSimulationStore.getState()
      const starClosed = state.componentStates[km2Id]?.coilEnergized ?? false
      const deltaClosed = state.componentStates[km3Id]?.coilEnergized ?? false
      expect(starClosed && deltaClosed).toBe(false)
    }
  })

  it('with nothing pressed, nothing energizes and the motor does not run', () => {
    const { km1Id, km2Id, km3Id, motorId } = buildYDelta(60)
    useSimulationStore.getState().tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[km3Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[motorId]?.motorRunning).toBe(false)
  })
})
