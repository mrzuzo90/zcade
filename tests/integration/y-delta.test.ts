import { describe, it } from 'vitest'

/**
 * Auto Y-Δ (star-delta) starter — canonical circuit #3 (Gate G-A).
 *
 * BLOCKED today: requires a TON timer (no `TimerState`/timer logic in
 * src/engine/solver.ts or src/types/circuit.ts) and a 6-wire motor
 * (src/components/symbols/library.ts only has the 3-wire motor_3p). Both are
 * SOLV's Phase A deliverables (Roadmap gap analysis) and are not present in
 * this worktree. See docs/testing/phase-a-test-plan.md Section 3.3 and 7.
 *
 * `tests/helpers/circuits.ts`'s `buildYDelta()` is a documented stub that
 * throws rather than building a fake topology — deliberately NOT called
 * here, so this file stays a pure placeholder until the blockers land.
 */
describe('canonical circuit: Auto Y-Δ (star-delta)', () => {
  it.skip(
    'PENDING (SOLV: TON timer + 6-wire motor) — star closes immediately on start, ' +
      'delta closes only after the timer preset elapses with zero-tick overlap between ' +
      'star and delta, and the motor runs with the correct direction in both stages',
    () => {
      // Once buildYDelta() is implemented for real (TON timer + 6-wire motor
      // exist), this test should:
      //   1. buildYDelta() and press start.
      //   2. Assert the line + star contactors are energized, delta is not,
      //      immediately after start (tick 0).
      //   3. Advance ticks up to (but not past) the timer preset and assert
      //      star is still closed, delta still open (no premature switch).
      //   4. Advance one more tick past the preset and assert star opens and
      //      delta closes in the SAME tick transition (no tick where both
      //      star and delta are simultaneously closed — that would be a
      //      line-to-line short across the motor windings).
      //   5. Assert motorRunning/motorDirection is correct in both the star
      //      and delta stages.
    },
  )
})
