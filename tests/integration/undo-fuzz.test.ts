import { describe, it } from 'vitest'

// TODO(CORE): activate this once src/store/undo.ts (or equivalent) exists.
//
// `src/store/undo.ts` does not exist in this worktree — CORE's command
// pattern (Roadmap Appendix 10.2: `Command { do, undo, coalesceWith? }`,
// a single history stack over ALL stores, 200-entry cap) is being built in
// parallel on another agent's branch and isn't visible here. This file is
// intentionally NOT importing any `@/store/undo` path — doing so would
// break `npm run type-check`/`build` today even with the test skipped,
// since TypeScript type-checks every file regardless of which tests
// execute. Do not add that import until the module is real.
//
// See `tests/integration/store-fuzz.test.ts` for a fuzz test that DOES run
// today, against the current (non-undo) mutation API — this file covers
// only the undo/redo-specific round-trip criterion from Gate G-A #3
// ("500-op random sequences, zero state corruption").

/**
 * Auto Y-Δ… no — this is the undo/redo fuzz test. Kept as a single
 * `it.skip` with the exact assertion plan spelled out, so activating it is
 * "remove `.skip`, wire up the real imports, done" rather than "figure out
 * what to test from scratch":
 *
 * 1. Reset canvas + wire stores (see resetEditorStores in
 *    tests/helpers/circuits.ts) and reset/instantiate CORE's history stack.
 * 2. Generate a seeded random sequence of ~500 Commands built from the same
 *    operation vocabulary as store-fuzz.test.ts (add/move/rotate/remove
 *    component, start/complete/cancel/remove wire) — but each operation
 *    must be expressed as a `Command` (per Appendix 10.2) and executed via
 *    `history.execute(command)`, never by calling the store mutator
 *    directly (the ESLint rule banning bare `set()` calls outside commands
 *    implies mutators should only be invoked through Command.do()).
 * 3. After all 500 execute() calls, snapshot the full state of both stores
 *    (`useCanvasStore.getState()`, `useWireStore.getState()`, minus
 *    transient UI fields like selection if those are intentionally excluded
 *    from history per CORE's design).
 * 4. Call `history.undo()` exactly 500 times (or until the undo stack is
 *    empty) and assert the resulting store state deep-equals the ORIGINAL
 *    pre-sequence snapshot (empty components/wires) — this is the
 *    "zero state corruption" criterion.
 * 5. Call `history.redo()` the same number of times and assert the store
 *    state deep-equals the snapshot taken in step 3 (full replay reproduces
 *    the same end state).
 * 6. Additionally fuzz a partial undo/redo/execute interleaving (e.g. undo
 *    10, execute 1 new command, assert the old redo stack was correctly
 *    discarded per the History pseudo-code in Appendix 10.2 — `execute()`
 *    clears `redoStack`).
 * 7. Repeat with at least 3 different seeds in the same test run (or a
 *    `describe.each` over seeds) — a single lucky seed passing is not
 *    sufficient evidence for a 500-entry history cap and coalescing logic.
 */
describe('undo/redo fuzz (pending CORE)', () => {
  it.skip('replays 500 random Command executions, then undo-to-empty and redo-to-final round-trip losslessly', () => {
    // Intentionally empty — see the doc comment above and TODO(CORE) note.
    // Do not implement against the current store APIs directly; there is no
    // undo without a real Command/History implementation to exercise.
  })
})
