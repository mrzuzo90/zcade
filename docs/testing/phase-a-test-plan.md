# Phase A Test Plan — QA & Test Engineer

Status: living document, updated as Phase A streams (SYM/ROUTE/CORE/SOLV/ERC) land.
Owner: QA. See `COMPLETE_PROJECT_ROADMAP.md` Section 2 ("Phase A") and Section 5
("Quality & Testing Strategy") for the authoritative source this plan implements.

## 1. Scope

Phase A turns the working prototype (41 passing tests, commit range `68d7383` →
`9f714b2`) into a professional-grade editor. This plan covers what QA verifies
during Phase A (Weeks 1–2) and what becomes the permanent regression floor for
every phase after it (the suite is append-only — see Roadmap 5.2).

## 2. Coverage Targets (Roadmap 5.1)

| Area | Target | How measured |
|---|---|---|
| Engine (solver, routing, graph) | ≥ 90% | `vitest run --coverage`, scoped to `src/engine/**` |
| Stores (canvas, wires, simulation, undo) | ≥ 75% | same, scoped to `src/store/**` |
| Integration scenarios | 3 canonical circuits e2e + undo fuzz + save/load round-trip | pass/fail, not a percentage |
| New tests this phase | ~80 | tracked in the Gate G-A report |

Coverage is not yet wired into CI as a hard gate in this session's `ci.yml` (no
`--coverage` flag is run) — vitest's coverage provider (`@vitest/coverage-v8`
or `-istanbul`) is not currently a devDependency. Adding it and wiring a
coverage-floor check is flagged as a follow-up in Section 6, not done today,
since installing a new devDependency and failing CI on a floor is a scope
decision for whoever finishes wiring the remaining Phase A subsystems (the
floor is only meaningful once SYM/CORE/SOLV's real code exists to measure).

## 3. The Three Canonical Circuits (golden tests)

Per Roadmap 5.2, these are the project's **golden tests**: they run on every
PR forever, and any change that alters their simulated behavior fails CI and
requires explicit Tech Lead review of the diff.

### 3.1 DOL (Direct-On-Line) with self-hold

- **Topology**: DC source → NC stop button → NO start button (in parallel
  with a seal-in contact) → contactor coil (A1/A2); one contactor power pole
  feeds a lamp as the "motor" stand-in load.
- **Behavior asserted**: idle (de-energized) → press start (latches) →
  release start (stays latched) → press stop (drops out) → release stop
  (does not self-restart; requires start again).
- **Today's caveat**: the "real" DOL circuit per Roadmap's gap analysis needs
  a dedicated auxiliary contact block (`13`/`14`) with cross-instance
  `linkedTo`, a thermal overload (`95`/`96` trip), and a latching e-stop —
  none of which exist in `src/components/symbols/library.ts` yet (SOLV's
  Phase A work, in flight on another agent's branch). `buildDOL()` in
  `tests/helpers/circuits.ts` therefore builds the same **approximation
  already established by `tests/engine/solver.test.ts`**: it reuses the
  contactor's own power pole (`1`↔`2`, `behavior: 'no', control: 'coil'`) as
  the seal-in contact, wired in parallel with the start button and fed back
  to `A1`. This exercises the identical fixed-point latch/drop-out logic a
  real aux-contact seal-in would, without a dedicated aux pin. When aux
  contacts + thermal overload + e-stop land, `buildDOL()` should be upgraded
  to the full topology and the overload-trip / e-stop assertions added — see
  Section 6.

### 3.2 Forward-Reverse interlock

- **Topology (per CLAUDE.md/Roadmap)**: two contactors (KM1 forward, KM2
  reverse) feeding a motor with two phases swapped between them, each with
  its own start/stop, and each electrically interlocked by the *other's*
  normally-closed auxiliary contact so they can never both be closed at once.
- **Behavior to assert**: pressing forward runs the motor CCW; pressing
  reverse while forward is latched is blocked (interlock holds); after
  stopping forward, reverse can then latch and runs CW.
- **Blocked today**: the interlock is only meaningful if one component's
  contact can be driven by a *different* component's coil state. The current
  solver (`src/engine/solver.ts`) only closes/opens `ContactSegment`s using
  `states[instance.id]` — i.e. a component's own coil, never another
  instance's (see the Phase 3 "Not yet built" note in `CLAUDE.md`: "a
  contactor's contacts are only ever controlled by that same instance's own
  coil"). There is no `ContactSegment`-level `linkedTo` resolution against a
  different component id anywhere in the solver today. This is SOLV's
  Phase A cross-instance linked-contacts deliverable, not yet in this
  worktree. **Genuinely blocked**, not merely unbuilt.
- **What is buildable today and included**: `buildFwdRev()` assembles the
  topology that *is* expressible now (two contactors independently wired to
  reversed phase pairs on the same motor, each with its own start/stop, no
  interlock), and a test asserts each direction runs and reports the correct
  `motorDirection` in isolation. The interlock-specific assertion is written
  as `it.skip` with a comment describing exactly what it will assert once
  cross-instance linked contacts land (see `tests/integration/fwd-rev.test.ts`).

### 3.3 Auto Y-Δ (star-delta) starter

- **Topology**: line contactor + star contactor + delta contactor + a TON
  timer sequencing star→delta transition on a 6-wire motor, with no overlap
  window between star and delta.
- **Blocked today**: neither a TON timer (no `TimerState` type, no timer
  logic in `solver.ts`) nor a 6-wire motor component (`library.ts` only has
  the 3-wire `motor_3p`) exist in this worktree. Both are explicitly called
  out in the Roadmap's Phase A gap analysis as SOLV deliverables not yet
  landed. **Genuinely blocked** — there is no way to express "timed, no
  overlap" without timer state in the solver.
- **What is included today**: `buildYDelta()` is written as a **documented
  stub** in `tests/helpers/circuits.ts` — it throws with a clear message
  pointing at this section, so a future test that calls it fails loudly
  and traceably instead of silently no-op-passing. The corresponding test
  file (`tests/integration/y-delta.test.ts`) contains only an `it.skip` per
  Section 6, plus a comment on exactly what the eventual test will assert
  (star closes immediately, delta closes only after the timer preset with
  zero-tick overlap, direction is correct in both stages).

## 4. Undo/Redo Fuzz Test

`src/store/undo.ts` does not exist in this worktree (CORE's Phase A
deliverable, being built in parallel on another agent's branch/worktree — not
visible here). Per the Roadmap's command pattern (Appendix 10.2), undo/redo
will be a single history stack of `Command { do, undo, coalesceWith? }`
objects wrapping every mutation across the canvas/wires/(future) stores.

This is split into two files, deliberately, rather than one:

- **`tests/integration/store-fuzz.test.ts`** — runs **today**, for real (not
  skipped). It drives 500 random operations through the *current* mutation
  API (`addComponent`/`moveComponent`/`rotateComponent`/`removeComponent`,
  `startWire`/`completeWire`/`cancelWire`/`removeWire`) with a seeded PRNG
  (reproducible failures) and asserts structural invariants
  (`order`↔`components` key-set consistency, no dangling `selectedId`/
  `selectedWireId`, `pendingFrom`/`selectedWireId` mutual exclusion) hold
  after every single operation. It is **not** an undo/redo test — there is
  nothing to undo yet — but it is a real regression net on the mutation
  layer undo/redo will wrap, and it will keep passing unmodified once CORE's
  `Command.do()` calls these same functions.
- **`tests/integration/undo-fuzz.test.ts`** — the actual Gate G-A criterion
  #3 ("500-op random sequences, zero state corruption"), which genuinely
  cannot run without a real `Command`/`History` implementation to exercise.
  Written as a single `it.skip(...)` whose doc comment spells out the exact
  7-step assertion plan (seeded random `Command` sequence → `execute()` →
  snapshot → 500× `undo()` → assert back to empty → 500× `redo()` → assert
  matches the post-execution snapshot → interleaved undo/execute/redo →
  repeat across ≥3 seeds), so activating it is "remove `.skip`, wire up the
  real `Command`/`history` imports" rather than designing the test from
  scratch. **Deliberately does not import any `@/store/undo` path** — doing
  so would fail `npm run type-check`/`build` today even with the test
  skipped, since TypeScript type-checks every file regardless of which tests
  execute; the file has a `// TODO(CORE):` comment explaining this.

## 5. Save/Load Round-Trip

Also blocked: no `.zcade` persistence (`src/io/`) exists in this worktree yet
(CORE's Phase A deliverable). `tests/integration/persistence-roundtrip.test.ts`
is written the same way as `undo-fuzz.test.ts`: a single `it.skip` whose doc
comment spells out the 7-step assertion plan against the schema documented in
`CLAUDE.md` ("File Format: `.zcade`") — save → reset stores → load → assert
identical canvas + identical simulation behavior (same `componentStates`
after N ticks) for `buildDOL()`, round-tripped through actual
`JSON.stringify`/`parse` to catch serialization-only bugs. No `@/io/*` import,
for the same type-check-breaks-on-missing-module reason as the undo fuzz
test; a `// TODO(CORE):` comment names the expected module.

## 6. Editor Integration Tests (what's built today)

`tests/integration/dol.test.ts` builds the DOL approximation (Section 3.1)
**through the real stores** (`useCanvasStore.addComponent`, `useWireStore`
`startWire`/`completeWire`, `useSimulationStore.tick`) rather than hand-rolling
`ComponentInstance`/`Wire` objects the way `tests/engine/solver.test.ts` does
— this is deliberately an "editor integration test" per the roadmap's
distinction (Section 5.3: engine unit tests vs. store/editor integration
tests), so it also incidentally exercises `addComponent`'s grid snapping and
`completeWire`'s duplicate/self-pin rejection along the way.

`tests/integration/fwd-rev.test.ts` builds the buildable half of 3.2 the same
way, with the interlock assertion skipped as described above.

## 7. Follow-Ups Once Blocked Work Lands

Tracked here so nothing falls through the cracks at integration time:

| Item | Blocked on | Action once unblocked |
|---|---|---|
| Full DOL w/ aux contact + thermal overload + e-stop | SOLV: aux `13/14`, `95/96` trip, e-stop | Upgrade `buildDOL()` to the real topology; add overload-trip and e-stop assertions |
| Fwd-Rev interlock assertion | SOLV: cross-instance `linkedTo` contact resolution | Un-skip `it.skip` in `fwd-rev.test.ts`; add the two-contactors-never-both-closed assertion |
| Y-Δ full test | SOLV: TON timer + 6-wire motor | Implement `buildYDelta()` for real; un-skip `y-delta.test.ts` |
| Undo/redo fuzz | CORE: `src/store/undo.ts` command pattern | Un-skip `undo-fuzz.test.ts`; adjust to CORE's actual command constructor names |
| Save/load round-trip | CORE: `src/io/` persistence | Un-skip `persistence-roundtrip.test.ts`; adjust to CORE's actual module |
| Coverage floor in CI | `@vitest/coverage-v8` devDependency + `--coverage` in `ci.yml` | Add once there's enough real code across all Phase A streams for the 90%/75% floors in Section 2 to be meaningful rather than trivially met by an empty engine |
| Routing perf benchmark (<16 ms / 500 comps) | ROUTE: A* router (`src/engine/routing/`) doesn't exist yet | Add a CI benchmark job once the router lands |
| ERC 0 false ±/− on 8 reference circuits | ERC: rule framework (onboards Day 5 per roadmap) | Add once `src/engine/erc/` exists |

## 8. Test Conventions (established by the existing suite, kept consistent)

- Deterministic only: engine tests drive `evaluateCircuit()`/`tick()`
  manually; store tests that need timing use `vi.useFakeTimers()` +
  `vi.advanceTimersByTime(TICK_MS)` — no wall-clock `sleep`, no flakiness
  (Roadmap 5.2).
- Each Zustand store test file resets store state in `beforeEach` via
  `useXStore.setState({...})` back to its documented initial shape (see
  `tests/integration/canvas-store.test.ts`, `wire-store.test.ts`,
  `simulation-store.test.ts`) — new integration tests in this plan follow the
  same pattern instead of introducing a different reset mechanism.
- `tests/engine/` = pure-function unit tests against `src/engine/*` directly.
  `tests/integration/` = tests that go through the Zustand stores (and, once
  it exists, the command/history layer).
- `tests/helpers/` (new, this session) = shared, non-test circuit-builder
  utilities imported by integration tests — not itself a test file, excluded
  from "tests added" counts.
