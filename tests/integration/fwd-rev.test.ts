import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from '@/store/simulation'
import { buildFwdRev, resetEditorStores } from '../helpers/circuits'

/**
 * Forward-Reverse interlock — canonical circuit #2 (Gate G-A).
 *
 * The interlock itself is BLOCKED today: the solver has no cross-instance
 * linked-contact resolution (a component's contacts only ever respond to its
 * own coil — see CLAUDE.md's Phase 3 "Not yet built" note and
 * docs/testing/phase-a-test-plan.md Section 3.2). What's asserted here is
 * everything that *is* buildable today: each direction runs independently
 * and reports the correct rotation. The interlock assertion is written out
 * in full below as `it.skip` so it's ready to activate the moment SOLV lands
 * cross-instance `linkedTo` contacts — do not delete it.
 */
describe('canonical circuit: Forward-Reverse (editor integration)', () => {
  beforeEach(() => {
    resetEditorStores()
    useSimulationStore.getState().stop()
  })

  afterEach(() => {
    useSimulationStore.getState().stop()
  })

  it('forward (km1) runs the motor CCW', () => {
    const { km1Id, motorId, start1Id } = buildFwdRev()
    const sim = useSimulationStore.getState()

    sim.setPressed(start1Id, true)
    sim.tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
    expect(state.componentStates[motorId]?.motorDirection).toBe('CCW')
  })

  it('reverse (km2) runs the motor CW', () => {
    const { km2Id, motorId, start2Id } = buildFwdRev()
    const sim = useSimulationStore.getState()

    sim.setPressed(start2Id, true)
    sim.tick()

    const state = useSimulationStore.getState()
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
    expect(state.componentStates[motorId]?.motorDirection).toBe('CW')
  })

  it('with neither start pressed, the motor does not run', () => {
    const { motorId } = buildFwdRev()
    useSimulationStore.getState().tick()
    expect(useSimulationStore.getState().componentStates[motorId]?.motorRunning).toBe(false)
  })

  // Intentionally pending on SOLV's cross-instance linked contacts — see file-level doc comment.
  it.skip(
    'PENDING (SOLV: cross-instance linked contacts) — km1 running blocks km2 from energizing even if both starts are pressed, and vice versa',
    () => {
      const { km1Id, km2Id, start1Id, start2Id } = buildFwdRev()
      const sim = useSimulationStore.getState()

      // Latch forward first.
      sim.setPressed(start1Id, true)
      sim.tick()
      sim.setPressed(start1Id, false)
      expect(useSimulationStore.getState().componentStates[km1Id]?.coilEnergized).toBe(true)

      // Pressing reverse's start while forward is latched must NOT energize
      // km2 — this requires km1's own NC auxiliary contact (cross-instance
      // `linkedTo: 'km1'`) wired in series with km2's coil circuit, which
      // does not exist in src/engine/solver.ts yet. Once it does, this
      // assertion should hold:
      sim.setPressed(start2Id, true)
      sim.tick()
      expect(useSimulationStore.getState().componentStates[km2Id]?.coilEnergized).toBe(false)
    },
  )
})
