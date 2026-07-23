/**
 * Circuit-builder test helpers — programmatic constructors for the three
 * canonical circuits (Roadmap Section 2, Phase A), built through the real
 * editor stores (`useCanvasStore`, `useWireStore`) rather than hand-rolled
 * `ComponentInstance`/`Wire` objects, so they double as editor integration
 * exercises (grid snapping, pin-to-pin wire completion, duplicate/self-pin
 * rejection) and not just solver unit-test fixtures.
 *
 * These are NOT test files themselves — no `describe`/`it` here — they are
 * imported by `tests/integration/*.test.ts`.
 *
 * IMPORTANT — read before "fixing" these to look more like the textbook
 * circuit: two of the three canonical circuits cannot be fully built against
 * today's solver/library. See `docs/testing/phase-a-test-plan.md` Section 3
 * for the full explanation. Short version:
 *   - buildDOL(): buildable today, but the "seal-in" contact is the
 *     contactor's own power pole (1-2), reused as a stand-in aux contact —
 *     see the note on `contactor_3p` in `src/components/symbols/library.ts`
 *     and the identical approximation already used by
 *     `tests/engine/solver.test.ts`. A dedicated 13-14 aux block with
 *     cross-instance `linkedTo` landed since (SOLV, Phase A), but upgrading
 *     buildDOL() itself to the full topology is tracked separately (test
 *     plan Section 7) and out of scope for this session.
 *   - buildFwdRev(): buildable *without* the interlock — two independent
 *     forward/reverse contactor branches with no seal-in and no interlock;
 *     each direction is asserted in isolation. Still used as-is by
 *     fwd-rev.test.ts's non-interlock assertions.
 *   - buildFwdRevInterlocked(): the REAL interlocked circuit, now that SOLV's
 *     cross-instance `ContactSegment.linkedTo` resolution
 *     (`resolveCoilControlState()` in `src/engine/solver.ts`) has landed on
 *     `main`. Builds on top of buildFwdRev() — see its own doc comment below
 *     for why it needs direct `useCanvasStore.setState()` patches (no store
 *     setter exists yet for relabeling an instance or setting arbitrary
 *     `properties`).
 *   - buildYDelta(): NOT buildable — no TON timer and no 6-wire motor exist
 *     in this worktree yet. The function is a documented stub that throws,
 *     so a test which forgets it's blocked fails loudly instead of silently
 *     no-op-passing. See y-delta.test.ts. (Still genuinely blocked — do not
 *     touch, per this session's directory-ownership note.)
 */

import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import type { Wire, WireEndpoint } from '@/types/circuit'

/**
 * Local equivalent of `wires.ts`'s internal (unexported) `samePinPair` — used
 * only to locate a specific already-drawn wire by its pin endpoints (e.g. to
 * remove/replace it), never to duplicate the store's own dedup logic.
 */
function wireMatchesEndpoints(wire: Wire, a: WireEndpoint, b: WireEndpoint): boolean {
  const same = (x: WireEndpoint, y: WireEndpoint) => x.componentId === y.componentId && x.pinId === y.pinId
  return (same(wire.from, a) && same(wire.to, b)) || (same(wire.from, b) && same(wire.to, a))
}

/** Resets the canvas + wire stores to their documented initial shape (mirrors the reset helpers already used in tests/integration/*.test.ts). */
export function resetEditorStores(): void {
  useCanvasStore.setState({
    components: {},
    order: [],
    selectedId: null,
    scale: 1,
    position: { x: 0, y: 0 },
    showGrid: true,
    snapEnabled: true,
  })
  useWireStore.setState({ wires: {}, order: [], selectedWireId: null, pendingFrom: null })
}

/**
 * Wires two pins together through the real click-to-start/click-to-finish
 * store API (`startWire`/`completeWire`), throwing if the store rejects the
 * attempt (self-pin, duplicate) — a builder helper should never silently
 * produce a smaller circuit than requested.
 */
function connect(fromId: string, fromPin: string, toId: string, toPin: string): string {
  useWireStore.getState().startWire({ componentId: fromId, pinId: fromPin })
  const wireId = useWireStore.getState().completeWire({ componentId: toId, pinId: toPin })
  if (!wireId) {
    throw new Error(`circuit builder: failed to wire ${fromId}:${fromPin} -> ${toId}:${toPin} (rejected by wire store)`)
  }
  return wireId
}

export interface DOLCircuit {
  srcId: string
  stopId: string
  startId: string
  kmId: string
  lampId: string
}

/**
 * DOL (Direct-On-Line) starter with self-hold, approximated per the doc
 * comment above: src -> stop(NC) -> [start(NO) ∥ km's own pole 1-2] -> km
 * coil; km's pole 3-4 feeds a lamp as the motor-load stand-in.
 */
export function buildDOL(): DOLCircuit {
  const canvas = useCanvasStore.getState()
  const srcId = canvas.addComponent('power_source_dc', 0, 0)
  const stopId = canvas.addComponent('push_button_nc', 100, 0)
  const startId = canvas.addComponent('push_button_no', 200, 0)
  const kmId = canvas.addComponent('contactor_3p', 300, 0)
  const lampId = canvas.addComponent('lamp', 400, 0)

  connect(srcId, '+24V', stopId, '21')
  connect(stopId, '22', startId, '13')
  connect(stopId, '22', kmId, '1')
  connect(startId, '14', kmId, 'A1')
  // Seal-in: km's own pole 1-2 (closes when its coil is energized) wired in
  // parallel with the start button — see the file-level doc comment.
  connect(kmId, '2', kmId, 'A1')
  connect(kmId, 'A2', srcId, '0V')

  // Motor-load stand-in on the second pole.
  connect(srcId, '+24V', kmId, '3')
  connect(kmId, '4', lampId, '1')
  connect(srcId, '0V', lampId, '2')

  return { srcId, stopId, startId, kmId, lampId }
}

export interface FwdRevCircuit {
  mainsId: string
  breakerId: string
  controlId: string
  km1Id: string
  km2Id: string
  motorId: string
  start1Id: string
  stop1Id: string
  start2Id: string
  stop2Id: string
}

/**
 * Forward-Reverse *without* the interlock (blocked today — see the
 * file-level doc comment). Two contactors (km1 forward, km2 reverse) share a
 * breaker-fed 3-phase bus and drive the same motor; km2's load-side mapping
 * swaps two phases at the motor terminals (same pin-index swap already
 * proven to yield `motorDirection: 'CW'` in
 * `tests/engine/solver.test.ts` — "reports CW direction when two phases are
 * swapped"). Each contactor has its own independent (non-latching, no
 * seal-in) start/stop pair energized straight from a separate DC control
 * source, so a test can hold one direction's start button and assert that
 * direction's behavior without needing seal-in logic.
 */
export function buildFwdRev(): FwdRevCircuit {
  const canvas = useCanvasStore.getState()
  const mainsId = canvas.addComponent('power_source_3p', 0, 0)
  const breakerId = canvas.addComponent('circuit_breaker_3p', 100, 0)
  const km1Id = canvas.addComponent('contactor_3p', 200, 0)
  const km2Id = canvas.addComponent('contactor_3p', 200, 100)
  const motorId = canvas.addComponent('motor_3p', 300, 50)
  const controlId = canvas.addComponent('power_source_dc', 0, 200)
  const stop1Id = canvas.addComponent('push_button_nc', 100, 200)
  const start1Id = canvas.addComponent('push_button_no', 200, 200)
  const stop2Id = canvas.addComponent('push_button_nc', 100, 300)
  const start2Id = canvas.addComponent('push_button_no', 200, 300)

  // Mains: 3-phase source -> breaker.
  connect(mainsId, 'L1', breakerId, '1')
  connect(mainsId, 'L2', breakerId, '3')
  connect(mainsId, 'L3', breakerId, '5')

  // Breaker output bus feeds both contactors' line side.
  connect(breakerId, '2', km1Id, '1')
  connect(breakerId, '4', km1Id, '3')
  connect(breakerId, '6', km1Id, '5')
  connect(breakerId, '2', km2Id, '1')
  connect(breakerId, '4', km2Id, '3')
  connect(breakerId, '6', km2Id, '5')

  // km1 (forward): natural order -> CCW.
  connect(km1Id, '2', motorId, 'U')
  connect(km1Id, '4', motorId, 'V')
  connect(km1Id, '6', motorId, 'W')

  // km2 (reverse): swap V/W at the motor terminals -> CW (mirrors the
  // known-good swap in tests/engine/solver.test.ts).
  connect(km2Id, '2', motorId, 'U')
  connect(km2Id, '6', motorId, 'V')
  connect(km2Id, '4', motorId, 'W')

  // Independent control circuits, no seal-in, no interlock (see doc comment).
  connect(controlId, '+24V', stop1Id, '21')
  connect(stop1Id, '22', start1Id, '13')
  connect(start1Id, '14', km1Id, 'A1')
  connect(km1Id, 'A2', controlId, '0V')

  connect(controlId, '+24V', stop2Id, '21')
  connect(stop2Id, '22', start2Id, '13')
  connect(start2Id, '14', km2Id, 'A1')
  connect(km2Id, 'A2', controlId, '0V')

  return { mainsId, breakerId, controlId, km1Id, km2Id, motorId, start1Id, stop1Id, start2Id, stop2Id }
}

export interface FwdRevInterlockedCircuit extends FwdRevCircuit {
  auxKm1NcId: string
  auxKm2NcId: string
}

/**
 * Forward-Reverse WITH the real electrical interlock — now buildable, since
 * SOLV's cross-instance linked-contact resolution
 * (`resolveCoilControlState()` in `src/engine/solver.ts`,
 * `ContactSegment.linkedTo` in `src/types/circuit.ts`) landed on `main`.
 *
 * Builds on `buildFwdRev()`'s topology, then:
 *   1. Relabels km1/km2 to distinct labels ('KM1'/'KM2'). This is required
 *      because `resolveCoilControlState` resolves a tag by scanning for
 *      *another* instance whose `label` equals the tag — and
 *      `contactor_3p`'s shared `ComponentDefinition.label` ('KM') is
 *      otherwise identical on every instance, so a tag of 'KM' would be
 *      ambiguous between km1 and km2.
 *   2. Adds one `aux_contact_block_no`-sibling `aux_contact_block_nc`
 *      instance per contactor, each with `properties.linkedTo` set to the
 *      OTHER contactor's label — i.e. auxKm1NcId tracks KM1's own coil via
 *      `properties.linkedTo: 'KM1'`, and is spliced into KM2's coil path (and
 *      vice versa for auxKm2NcId/KM2/KM1). This is the actual electrical
 *      interlock: KM1 running holds ITS OWN aux contact open, which — being
 *      wired in series with KM2's coil — prevents KM2 from ever energizing
 *      while KM1 is energized, and vice versa.
 *
 * Both the relabel and the `properties.linkedTo` assignment go through
 * `useCanvasStore.setState()` directly rather than a dedicated store method,
 * because none exists yet: `addComponent` (src/store/canvas.ts) hardcodes
 * `label: def.label` and `properties: {}` with no setter to change either
 * afterwards. This mirrors `resetEditorStores()`'s existing use of
 * `setState()` for fixture setup above — it is fixture/test-setup, not a
 * user-driven content mutation a real editor session would perform, so it's
 * deliberately NOT routed through the command/history layer (nothing here
 * needs to be undoable).
 */
export function buildFwdRevInterlocked(): FwdRevInterlockedCircuit {
  const base = buildFwdRev()

  useCanvasStore.setState((state) => ({
    components: {
      ...state.components,
      [base.km1Id]: { ...state.components[base.km1Id], label: 'KM1' },
      [base.km2Id]: { ...state.components[base.km2Id], label: 'KM2' },
    },
  }))

  const canvas = useCanvasStore.getState()
  const auxKm1NcId = canvas.addComponent('aux_contact_block_nc', 300, 200)
  const auxKm2NcId = canvas.addComponent('aux_contact_block_nc', 300, 300)

  useCanvasStore.setState((state) => ({
    components: {
      ...state.components,
      [auxKm1NcId]: { ...state.components[auxKm1NcId], properties: { linkedTo: 'KM1' } },
      [auxKm2NcId]: { ...state.components[auxKm2NcId], properties: { linkedTo: 'KM2' } },
    },
  }))

  // Splice each aux contact into the OTHER contactor's coil path, replacing
  // the direct start-button -> A1 wire buildFwdRev() made.
  const wireStore = useWireStore.getState()
  const startToKm1 = Object.values(wireStore.wires).find((w) => wireMatchesEndpoints(w, { componentId: base.start1Id, pinId: '14' }, { componentId: base.km1Id, pinId: 'A1' }))
  const startToKm2 = Object.values(wireStore.wires).find((w) => wireMatchesEndpoints(w, { componentId: base.start2Id, pinId: '14' }, { componentId: base.km2Id, pinId: 'A1' }))
  if (!startToKm1 || !startToKm2) {
    throw new Error('buildFwdRevInterlocked: expected buildFwdRev() to have wired start1/2 -> A1 directly')
  }
  wireStore.removeWire(startToKm1.id)
  wireStore.removeWire(startToKm2.id)

  connect(base.start1Id, '14', auxKm2NcId, '21')
  connect(auxKm2NcId, '22', base.km1Id, 'A1')

  connect(base.start2Id, '14', auxKm1NcId, '21')
  connect(auxKm1NcId, '22', base.km2Id, 'A1')

  return { ...base, auxKm1NcId, auxKm2NcId }
}

/**
 * Auto Y-Δ (star-delta) starter — NOT buildable in this worktree.
 *
 * Requires both a TON timer (no `TimerState`/timer solver logic exists in
 * `src/engine/solver.ts` or `src/types/circuit.ts`) and a 6-wire motor
 * (U1V1W1/U2V2W2, `src/components/symbols/library.ts` only has the 3-wire
 * `motor_3p`). Both are SOLV's Phase A deliverables per the Roadmap gap
 * analysis and are not present here. Throws instead of building a fake/
 * misleading topology — see `tests/integration/y-delta.test.ts`, which keeps
 * the real test `it.skip` and never calls this.
 */
export function buildYDelta(): never {
  throw new Error(
    'buildYDelta() is blocked: requires a TON timer and a 6-wire motor, ' +
      'neither of which exist yet in src/engine/solver.ts or ' +
      'src/components/symbols/library.ts. See docs/testing/phase-a-test-plan.md ' +
      'Section 3.3 and 7 before implementing this.',
  )
}
