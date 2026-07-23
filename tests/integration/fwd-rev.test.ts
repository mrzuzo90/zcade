import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from '@/store/simulation'
import { buildFwdRev, buildFwdRevInterlocked, resetEditorStores } from '../helpers/circuits'

/**
 * Forward-Reverse interlock — canonical circuit #2 (Gate G-A).
 *
 * SOLV's cross-instance linked-contact resolution
 * (`resolveCoilControlState()` in `src/engine/solver.ts`,
 * `ContactSegment.linkedTo` in `src/types/circuit.ts`) has landed on `main`,
 * so the real interlock is now buildable and asserted below via
 * `buildFwdRevInterlocked()` (see its doc comment in
 * `tests/helpers/circuits.ts`) — no longer `it.skip`.
 *
 * `buildFwdRev()` (without the interlock) is kept and still exercised by the
 * first three tests below: it's a useful, cheaper fixture for asserting each
 * direction runs correctly in isolation, independent of the interlock wiring.
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

  it('electrical interlock: km1 energized blocks km2 from energizing (even with its own start pressed), and vice versa after km1 drops out', () => {
    const { km1Id, km2Id, start1Id, start2Id, motorId } = buildFwdRevInterlocked()
    const sim = useSimulationStore.getState()

    // Press KM1's start only: km1 energizes, motor runs CCW — same as the
    // non-interlocked case above, confirming the interlock wiring didn't
    // break the base circuit.
    sim.setPressed(start1Id, true)
    sim.tick()
    let state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
    expect(state.componentStates[motorId]?.motorDirection).toBe('CCW')

    // Now ALSO press KM2's start while KM1 is still energized. KM1's own NC
    // aux contact (tracking KM1 via `properties.linkedTo`, wired in series
    // with KM2's coil circuit) must be open, so KM2 stays de-energized even
    // though its start button is pressed.
    sim.setPressed(start2Id, true)
    sim.tick()
    state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[motorId]?.motorDirection).toBe('CCW')

    // Release KM1's start (this circuit has no seal-in — momentary hold only,
    // per buildFwdRev()'s doc comment): KM1 drops out, its aux contact
    // closes again, and KM2 (whose start is still held) can now latch in.
    sim.setPressed(start1Id, false)
    sim.tick()
    state = useSimulationStore.getState()
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(false)
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[motorId]?.motorRunning).toBe(true)
    expect(state.componentStates[motorId]?.motorDirection).toBe('CW')
  })

  it('electrical interlock holds symmetrically: km2 energized blocks km1', () => {
    const { km1Id, km2Id, start1Id, start2Id } = buildFwdRevInterlocked()
    const sim = useSimulationStore.getState()

    sim.setPressed(start2Id, true)
    sim.tick()
    expect(useSimulationStore.getState().componentStates[km2Id]?.coilEnergized).toBe(true)

    sim.setPressed(start1Id, true)
    sim.tick()
    const state = useSimulationStore.getState()
    expect(state.componentStates[km2Id]?.coilEnergized).toBe(true)
    expect(state.componentStates[km1Id]?.coilEnergized).toBe(false)
  })
})
