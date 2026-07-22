import { describe, it } from 'vitest'

// TODO(CORE): activate this once `.zcade` save/load (e.g. src/io/persistence.ts,
// per Roadmap Phase A deliverable #4) exists in this worktree. Not importing
// any `@/io/*` path yet — same reasoning as undo-fuzz.test.ts: an import of a
// nonexistent module would break `npm run type-check`/`build` even with the
// test skipped, since TypeScript checks every file regardless of which tests
// run.

/**
 * Save -> reload round-trip — Gate G-A criterion #4 ("Save → reload →
 * identical canvas + identical simulation behavior"). Assertion plan for
 * whoever activates this once persistence lands:
 *
 * 1. Build one of the canonical circuits (buildDOL() from
 *    tests/helpers/circuits.ts is the simplest fully-buildable one today).
 * 2. Call the real save function (expected shape per CLAUDE.md's ".zcade"
 *    section: versioned JSON, components reference pins by
 *    `componentId:pinId`, not coordinates) to serialize the current
 *    canvas + wire store state.
 * 3. Fully reset both stores (resetEditorStores()) to simulate a fresh app
 *    launch.
 * 4. Call the real load function with the serialized JSON.
 * 5. Assert the reloaded `components` and `wires` records deep-equal the
 *    pre-save snapshot (modulo any documented id-remapping — if CORE's
 *    loader regenerates ids, compare structurally: same component types/
 *    positions/rotations, same pin-to-pin wire connections, not literal id
 *    strings).
 * 6. Run the simulation for N ticks on both the pre-save and post-load
 *    circuits (same setPressed sequence on each) and assert
 *    `componentStates` matches at every tick — "identical simulation
 *    behavior", not just identical static data.
 * 7. Round-trip through JSON.stringify/parse (or the actual file-write path
 *    if one exists in test env) at least once, not just the in-memory
 *    object, to catch anything that doesn't survive serialization (e.g. Map/
 *    Set fields, undefined vs. omitted keys).
 */
describe('.zcade save/load round-trip (pending CORE)', () => {
  it.skip('reloads a saved DOL circuit to an identical canvas and identical simulation behavior', () => {
    // Intentionally empty — see the doc comment above and TODO(CORE) note.
  })
})
