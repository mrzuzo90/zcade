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
 *     cross-instance `linkedTo` does not exist yet (SOLV, Phase A, in flight).
 *   - buildFwdRev(): buildable *without* the interlock — the solver has no
 *     cross-instance contact control yet, so KM1 cannot electrically block
 *     KM2. This helper wires two independent forward/reverse contactor
 *     branches with no seal-in and no interlock; each direction is asserted
 *     in isolation. See fwd-rev.test.ts's skipped interlock test.
 *   - buildYDelta(): buildable as of Phase A Week 2 (SOLV's TON timer +
 *     6-wire motor). Like buildFwdRev(), it's a *maintained-start*
 *     approximation rather than a true self-hold — see its own doc comment
 *     for why (the store still has no way to set an instance's `label`, so
 *     cross-instance `linkedTo` aux contacts still can't be used here
 *     either). See y-delta.test.ts.
 */

import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'

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

export interface YDeltaCircuit {
  mainsId: string
  breakerId: string
  km1Id: string
  km2Id: string
  km3Id: string
  timerId: string
  motorId: string
  controlId: string
  stopId: string
  startId: string
}

/**
 * Auto Y-Δ (star-delta) starter — canonical circuit #3 (Gate G-A). Now
 * buildable: `timer_ton` and `motor_3p_6wire` landed in
 * `src/components/symbols/library.ts` / `src/engine/solver.ts` this session
 * (SOLV, Phase A Week 2).
 *
 * Topology: km1 (line contactor) always feeds the motor's U1/V1/W1 line-side
 * terminals whenever it's energized. km2 (star) ties its 3 poles' line-side
 * pins together into one common node and its load-side pins to U2/V2/W2 —
 * closing all 3 poles shorts U2-V2-W2 into the star point. km3 (delta)
 * instead bridges each winding-end terminal to the NEXT phase's line-side
 * terminal (U2-V1, V2-W1, W2-U1), forming the triangle when its 3 poles
 * close. A single `timer_ton` drives both: its 57-58 (NC) energizes km2
 * while NOT timed out, its 55-56 (NO) energizes km3 once timed out — because
 * `evaluateCircuit()` derives both contacts from the exact same
 * `timedActive` boolean within one tick (see engine/solver.ts), star opens
 * and delta closes in the SAME tick transition, with no tick where both are
 * simultaneously closed (no line-to-line short across the motor windings) —
 * this falls out of the topology for free, no separate interlock needed.
 *
 * Like `buildFwdRev()`, this is a *maintained-start* approximation, not a
 * true self-hold: `useCanvasStore`'s `addComponent` still has no way to set
 * an instance's `label` (every `contactor_3p` gets the shared definition
 * label "KM"), so the cross-instance `linkedTo` aux-block mechanism can't
 * distinguish km1/km2/km3 here — and km1 has no spare pole for a seal-in of
 * its own anyway (all 3 poles carry 3-phase motor current). `start` must
 * therefore be held down for the whole test, standing in for a maintained
 * start switch rather than a momentary pushbutton.
 *
 * `presetMs` is applied via a direct `useCanvasStore.setState()` patch after
 * creation (matching `resetEditorStores()`'s existing use of `setState`
 * elsewhere in this file) since there is no store *action* for editing an
 * existing instance's `properties` — this keeps `presetMs` fast/deterministic
 * for tests instead of relying on `DEFAULT_TON_PRESET_MS` (3s = 150 ticks).
 */
export function buildYDelta(presetMs = 60): YDeltaCircuit {
  const canvas = useCanvasStore.getState()
  const mainsId = canvas.addComponent('power_source_3p', 0, 0)
  const breakerId = canvas.addComponent('circuit_breaker_3p', 100, 0)
  const km1Id = canvas.addComponent('contactor_3p', 200, 0) // line
  const km2Id = canvas.addComponent('contactor_3p', 200, 100) // star
  const km3Id = canvas.addComponent('contactor_3p', 200, 200) // delta
  const timerId = canvas.addComponent('timer_ton', 200, 300)
  const motorId = canvas.addComponent('motor_3p_6wire', 300, 100)
  const controlId = canvas.addComponent('power_source_dc', 0, 400)
  const stopId = canvas.addComponent('push_button_nc', 100, 400)
  const startId = canvas.addComponent('push_button_no', 200, 400)

  useCanvasStore.setState((state) => ({
    components: {
      ...state.components,
      [timerId]: { ...state.components[timerId], properties: { presetMs } },
    },
  }))

  // Mains -> breaker -> line contactor (km1) -> motor U1/V1/W1 (fed
  // whenever km1 is energized, in both the star and delta stages).
  connect(mainsId, 'L1', breakerId, '1')
  connect(mainsId, 'L2', breakerId, '3')
  connect(mainsId, 'L3', breakerId, '5')
  connect(breakerId, '2', km1Id, '1')
  connect(breakerId, '4', km1Id, '3')
  connect(breakerId, '6', km1Id, '5')
  connect(km1Id, '2', motorId, 'U1')
  connect(km1Id, '4', motorId, 'V1')
  connect(km1Id, '6', motorId, 'W1')

  // km2 (star): common line-side node across all 3 poles; load-side pins to U2/V2/W2.
  connect(km2Id, '1', km2Id, '3')
  connect(km2Id, '3', km2Id, '5')
  connect(km2Id, '2', motorId, 'U2')
  connect(km2Id, '4', motorId, 'V2')
  connect(km2Id, '6', motorId, 'W2')

  // km3 (delta): U2-V1, V2-W1, W2-U1 jumper pattern via its 3 poles.
  connect(km3Id, '1', motorId, 'U2')
  connect(km3Id, '2', motorId, 'V1')
  connect(km3Id, '3', motorId, 'V2')
  connect(km3Id, '4', motorId, 'W1')
  connect(km3Id, '5', motorId, 'W2')
  connect(km3Id, '6', motorId, 'U1')

  // Control: start (held) drives km1 and the timer directly, and km2/km3 via
  // the timer's complementary NC/NO timed contacts.
  connect(controlId, '+24V', stopId, '21')
  connect(stopId, '22', startId, '13')
  connect(startId, '14', km1Id, 'A1')
  connect(km1Id, 'A2', controlId, '0V')

  connect(startId, '14', timerId, 'A1')
  connect(timerId, 'A2', controlId, '0V')

  connect(startId, '14', timerId, '57')
  connect(timerId, '58', km2Id, 'A1')
  connect(km2Id, 'A2', controlId, '0V')

  connect(startId, '14', timerId, '55')
  connect(timerId, '56', km3Id, 'A1')
  connect(km3Id, 'A2', controlId, '0V')

  return { mainsId, breakerId, km1Id, km2Id, km3Id, timerId, motorId, controlId, stopId, startId }
}
