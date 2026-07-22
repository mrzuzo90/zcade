import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { resetEditorStores } from '../helpers/circuits'

/**
 * Store-consistency fuzz test — runs TODAY against the current canvas/wire
 * mutation API (addComponent/moveComponent/rotateComponent/removeComponent,
 * startWire/completeWire/cancelWire/removeWire/removeWiresForComponent).
 *
 * This is deliberately NOT an undo/redo test — `src/store/undo.ts` (the
 * command-pattern history CORE is building this Phase A, per Roadmap
 * Appendix 10.2) does not exist in this worktree. See
 * `tests/integration/undo-fuzz.test.ts` for the pending, skipped test that
 * targets the actual undo/redo round-trip criterion (Gate G-A #3: "500-op
 * random sequences, zero state corruption").
 *
 * What this test buys in the meantime: it drives a long random sequence of
 * real store operations and asserts the invariants those stores are
 * documented to uphold never break — i.e. it would catch a mutation-level
 * regression in canvas.ts/wires.ts today, independent of whether undo exists
 * yet, and it will keep passing unmodified once undo wraps these same
 * mutations (a Command's `do()` calling these exact functions is the
 * expected shape per Appendix 10.2).
 */

const COMPONENT_TYPES = ['contactor_3p', 'push_button_no', 'push_button_nc', 'motor_3p', 'circuit_breaker_3p', 'lamp'] as const

// Simple seeded PRNG (mulberry32) so a failure is reproducible from the seed
// printed in the failure message, without relying on wall-clock/Math.random.
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

type Op = 'add' | 'move' | 'rotate' | 'remove' | 'wireStart' | 'wireComplete' | 'wireCancel' | 'wireRemove'
const OPS: Op[] = ['add', 'add', 'add', 'move', 'rotate', 'remove', 'wireStart', 'wireComplete', 'wireCancel', 'wireRemove']

function assertInvariants(seed: number, opIndex: number) {
  const canvas = useCanvasStore.getState()
  const wires = useWireStore.getState()
  const ctx = `seed=${seed} op#${opIndex}`

  // order <-> components key-set consistency, no duplicates.
  expect(new Set(canvas.order).size, `${ctx}: order has duplicates`).toBe(canvas.order.length)
  expect(canvas.order.sort(), `${ctx}: order/components mismatch`).toEqual(Object.keys(canvas.components).sort())

  // selectedId, if set, must reference a live component.
  if (canvas.selectedId !== null) {
    expect(canvas.components[canvas.selectedId], `${ctx}: selectedId points at a removed component`).toBeDefined()
  }

  // wires order <-> wires key-set consistency, no duplicates.
  expect(new Set(wires.order).size, `${ctx}: wire order has duplicates`).toBe(wires.order.length)
  expect(wires.order.sort(), `${ctx}: wire order/wires mismatch`).toEqual(Object.keys(wires.wires).sort())

  // selectedWireId, if set, must reference a live wire.
  if (wires.selectedWireId !== null) {
    expect(wires.wires[wires.selectedWireId], `${ctx}: selectedWireId points at a removed wire`).toBeDefined()
  }

  // pendingFrom and selectedWireId are mutually exclusive by store design
  // (selectWire always clears pendingFrom, startWire always clears selectedWireId).
  if (wires.pendingFrom !== null) {
    expect(wires.selectedWireId, `${ctx}: pendingFrom and selectedWireId both set`).toBeNull()
  }
}

describe('canvas + wire store fuzz (mutation-level, runs today)', () => {
  beforeEach(() => {
    resetEditorStores()
  })

  it('holds structural invariants across 500 random operations', () => {
    const seed = 20260723
    const rand = mulberry32(seed)
    const componentIds: string[] = []
    const wireEndpointsUsed: { componentId: string; pinId: string }[] = []

    function pick<T>(arr: T[]): T | undefined {
      if (arr.length === 0) return undefined
      return arr[Math.floor(rand() * arr.length)]
    }

    for (let i = 0; i < 500; i++) {
      const op = pick(OPS)!
      const canvas = useCanvasStore.getState()
      const wireStore = useWireStore.getState()

      switch (op) {
        case 'add': {
          const type = pick([...COMPONENT_TYPES])!
          const id = canvas.addComponent(type, Math.floor(rand() * 500), Math.floor(rand() * 500))
          componentIds.push(id)
          const def = { contactor_3p: ['1', '2', '3', '4', '5', '6', 'A1', 'A2'], push_button_no: ['13', '14'], push_button_nc: ['21', '22'], motor_3p: ['U', 'V', 'W'], circuit_breaker_3p: ['1', '2', '3', '4', '5', '6'], lamp: ['1', '2'] }[type]
          for (const pinId of def) wireEndpointsUsed.push({ componentId: id, pinId })
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
        case 'wireStart': {
          const ep = pick(wireEndpointsUsed.filter((e) => canvas.components[e.componentId]))
          if (ep) wireStore.startWire(ep)
          break
        }
        case 'wireComplete': {
          const ep = pick(wireEndpointsUsed.filter((e) => canvas.components[e.componentId]))
          if (ep) wireStore.completeWire(ep)
          break
        }
        case 'wireCancel':
          wireStore.cancelWire()
          break
        case 'wireRemove': {
          const id = pick(wireStore.order)
          if (id) wireStore.removeWire(id)
          break
        }
      }

      assertInvariants(seed, i)
    }
  })
})
