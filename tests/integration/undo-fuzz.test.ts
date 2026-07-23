import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useHistoryStore } from '@/store/history'
import type { WireType } from '@/types/circuit'
import { buildFwdRev, resetEditorStores } from '../helpers/circuits'

/**
 * Undo/redo fuzz (integration) — canonical-circuit version of Gate G-A #3
 * ("500-op random sequences, zero state corruption"), now that CORE's
 * command-pattern history (`src/store/history.ts`) and its wiring into
 * `src/store/canvas.ts`/`src/store/wires.ts` have landed on `main`.
 *
 * This complements, rather than replaces, `tests/integration/store-fuzz.test.ts`
 * (which fuzzes the raw mutation API's structural invariants and needs no
 * undo/redo) and `tests/store/undo-redo-fuzz.test.ts` (CORE's own synthetic-op
 * fuzz test for the history stack in isolation). Per the test plan's
 * unit-vs-integration split (docs/testing/phase-a-test-plan.md Section 8),
 * this one is *integration*-level: it seeds a real canonical circuit topology
 * (Forward-Reverse, `buildFwdRev()`) through the real editor stores, then
 * fuzzes further mutations through the SAME public store API — every one of
 * which already goes through `useHistoryStore` under the hood, since
 * `addComponent`/`moveComponent`/`rotateComponent`/`removeComponent` and
 * `completeWire`/`removeWire`/`setWireType` all wrap their content mutations
 * in a `Command` (see the "Commands" sections of canvas.ts/wires.ts) — there
 * is no separate `Command` construction needed here, just driving the store.
 *
 * Entry count per seed is kept under history.ts's `HISTORY_CAP` (200): once
 * exceeded, the oldest entries are silently dropped from the undo stack (by
 * design — a bounded history, not a bug), which would make "undo all the way
 * back to the pre-sequence state" impossible to guarantee. The build (~1
 * batched entry, since it isn't `flush()`ed mid-build) plus a bounded number
 * of individually flushed fuzz ops comfortably stays within that cap.
 */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COMPONENT_TYPES = ['contactor_3p', 'push_button_no', 'push_button_nc', 'motor_3p', 'circuit_breaker_3p', 'lamp'] as const
const PIN_MAP: Record<(typeof COMPONENT_TYPES)[number], string[]> = {
  contactor_3p: ['1', '2', '3', '4', '5', '6', 'A1', 'A2'],
  push_button_no: ['13', '14'],
  push_button_nc: ['21', '22'],
  motor_3p: ['U', 'V', 'W'],
  circuit_breaker_3p: ['1', '2', '3', '4', '5', '6'],
  lamp: ['1', '2'],
}
const WIRE_TYPES: (WireType | undefined)[] = ['L1', 'L2', 'L3', 'N', 'PE', 'DC_POS', 'DC_0', 'signal', undefined]

type Op = 'add' | 'move' | 'rotate' | 'remove' | 'wireComplete' | 'wireCancel' | 'wireRemove' | 'setWireType'
// Weighted so wiring/removal ops (the ones most likely to interact with the
// seeded Fwd-Rev topology) show up often, without starving component ops.
const OPS: Op[] = ['add', 'add', 'move', 'move', 'rotate', 'wireComplete', 'wireComplete', 'wireRemove', 'setWireType', 'remove', 'wireCancel']

/** Number of fuzzed operations per seed, chosen to stay well under history.ts's 200-entry cap even in the worst case (every op producing its own entry). */
const OP_COUNT = 150

function resetAll() {
  resetEditorStores()
  useHistoryStore.getState().clear()
}

/**
 * Circuit-CONTENT snapshot — components/wires and their ordering, the things
 * the command/history layer actually guarantees an exact undo/redo
 * round-trip for.
 *
 * Deliberately excludes `selectedId`/`selectedWireId`/`pendingFrom`:
 * canvas.ts/wires.ts's own "Commands" doc comments are explicit that
 * selection and the in-progress wire-draw gesture are transient UI state,
 * not circuit content, and are intentionally NOT wrapped in Commands
 * (`selectComponent`, `startWire`, `cancelWire`, `selectWire` are all plain
 * `set()` calls). Since those calls happen interleaved with real Commands
 * but leave no trace in the undo/redo stacks, a fuzz sequence that includes
 * them (as this one does, e.g. the 'wireCancel' op) cannot possibly redo
 * them back — only the tracked content commands replay. Asserting exact
 * equality on those fields here would be testing a guarantee the store
 * never made, not a real regression.
 */
function contentSnapshot() {
  const canvas = useCanvasStore.getState()
  const wires = useWireStore.getState()
  return {
    components: canvas.components,
    order: canvas.order,
    wires: wires.wires,
    wireOrder: wires.order,
  }
}

describe.each([20260723, 42, 1337])('undo/redo fuzz — canonical Forward-Reverse circuit (seed=%i)', (seed) => {
  beforeEach(resetAll)

  it('undoes a randomized session back to the exact pre-sequence state, then redoes it back to the exact post-sequence state', () => {
    const rand = mulberry32(seed)
    function pick<T>(arr: readonly T[]): T | undefined {
      if (arr.length === 0) return undefined
      return arr[Math.floor(rand() * arr.length)]
    }

    // The ACTUAL baseline this test asserts back to — captured before any
    // command runs (empty stores, per resetAll()/resetEditorStores()).
    const initialSnapshot = contentSnapshot()

    // Seed a real canonical topology (Gate G-A circuit #2) through the
    // editor stores — every addComponent/completeWire call inside
    // buildFwdRev() already executes through useHistoryStore. Flushed as one
    // batch: the whole build undoes as a single step, which is fine — we
    // only care that undoing everything gets back to `initialSnapshot`.
    const circuit = buildFwdRev()
    useHistoryStore.getState().flush()

    const componentIds: string[] = Object.keys(useCanvasStore.getState().components)
    const wireEndpointsUsed: { componentId: string; pinId: string }[] = []
    for (const id of componentIds) {
      const type = useCanvasStore.getState().components[id].type as (typeof COMPONENT_TYPES)[number] | undefined
      for (const pinId of (type && PIN_MAP[type]) || []) wireEndpointsUsed.push({ componentId: id, pinId })
    }

    for (let i = 0; i < OP_COUNT; i++) {
      const op = pick(OPS)!
      const canvas = useCanvasStore.getState()
      const wireStore = useWireStore.getState()

      switch (op) {
        case 'add': {
          const type = pick(COMPONENT_TYPES)!
          const id = canvas.addComponent(type, Math.floor(rand() * 500), Math.floor(rand() * 500))
          componentIds.push(id)
          for (const pinId of PIN_MAP[type]) wireEndpointsUsed.push({ componentId: id, pinId })
          break
        }
        case 'move': {
          const id = pick(componentIds)
          if (id && canvas.components[id]) canvas.moveComponent(id, Math.floor(rand() * 500), Math.floor(rand() * 500))
          break
        }
        case 'rotate': {
          const id = pick(componentIds)
          if (id && canvas.components[id]) canvas.rotateComponent(id, rand() < 0.5 ? 1 : -1)
          break
        }
        case 'remove': {
          const id = pick(componentIds)
          if (id && canvas.components[id]) {
            canvas.removeComponent(id)
            useWireStore.getState().removeWiresForComponent(id)
          }
          break
        }
        case 'wireComplete': {
          const live = wireEndpointsUsed.filter((e) => useCanvasStore.getState().components[e.componentId])
          const from = pick(live)
          const to = pick(live)
          if (from && to) {
            wireStore.startWire(from)
            wireStore.completeWire(to)
          }
          break
        }
        case 'wireCancel': {
          const ep = pick(wireEndpointsUsed)
          if (ep) wireStore.startWire(ep)
          wireStore.cancelWire()
          break
        }
        case 'wireRemove': {
          const id = pick(wireStore.order)
          if (id) wireStore.removeWire(id)
          break
        }
        case 'setWireType': {
          const id = pick(wireStore.order)
          if (id) wireStore.setWireType(id, pick(WIRE_TYPES))
          break
        }
      }

      // Force each iteration's command(s) to commit as their own history
      // entry (or entries — removeWiresForComponent can batch several)
      // rather than letting all OP_COUNT iterations collapse into a single
      // Transaction, so the undo loop below genuinely exercises "undo N
      // times," not "undo once."
      useHistoryStore.getState().flush()
    }

    const preUndoSnapshot = contentSnapshot()
    const entryCountBeforeUndo = useHistoryStore.getState().undoStack.length
    // Sanity: the fuzz actually produced a meaningfully deep undo stack —
    // otherwise this test would trivially pass without exercising the
    // round-trip depth it claims to (also guards against the whole thing
    // silently collapsing into one Transaction if flush() stopped being
    // called above).
    expect(entryCountBeforeUndo, `seed=${seed}: expected a meaningfully deep undo stack`).toBeGreaterThan(10)
    expect(entryCountBeforeUndo, `seed=${seed}: undo stack should stay under history.ts's HISTORY_CAP`).toBeLessThanOrEqual(200)

    let undoCount = 0
    while (useHistoryStore.getState().undoStack.length > 0) {
      useHistoryStore.getState().undo()
      undoCount++
    }

    expect(contentSnapshot(), `seed=${seed}: undo-to-empty produced state divergence from the pre-sequence baseline`).toEqual(initialSnapshot)
    expect(useHistoryStore.getState().redoStack.length, `seed=${seed}`).toBe(undoCount)

    // Full redo replay must reproduce the exact pre-undo (post-sequence) state.
    let redoCount = 0
    while (useHistoryStore.getState().redoStack.length > 0) {
      useHistoryStore.getState().redo()
      redoCount++
    }
    expect(redoCount, `seed=${seed}`).toBe(undoCount)
    expect(contentSnapshot(), `seed=${seed}: redo-to-final produced state divergence from the post-sequence snapshot`).toEqual(preUndoSnapshot)

    // Interleaving: a partial undo followed by a brand-new execute() must
    // discard the (now-stale) redo stack rather than leaving it around —
    // history.ts's documented execute() contract.
    useHistoryStore.getState().undo()
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().redoStack.length, `seed=${seed}`).toBe(2)

    useCanvasStore.getState().addComponent('lamp', 0, 0)
    useHistoryStore.getState().flush()
    expect(useHistoryStore.getState().redoStack.length, `seed=${seed}: execute() after undo should clear the redo stack`).toBe(0)

    // circuit is only referenced to keep it alive for readability / future
    // assertions against specific ids; touch it so it isn't flagged unused.
    expect(circuit.motorId).toBeDefined()
  })
})
