# Wire Lane Offset + Phase/Neutral Pin Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wires that share a collinear routed segment render as visibly distinct parallel lines instead of occluding each other, and single-phase loads/coils auto-color their neutral leg blue when wired up.

**Architecture:** Two independent, additive engine functions in `src/engine/wiring.ts` (`findOverlaps` detects the coincident-segment groups, `pathWithLaneOffsets` renders a wire's path with a per-lane perpendicular nudge), wired into the existing `WireGeometryCache`/`WireLayer.tsx` incremental-rendering pipeline the exact same way Phase A Week 2's crossing-hop feature already is. Separately, a new UI-only `PinDefinition.suggestedWireType` field lets `store/wires.ts`'s `completeWire` auto-assign a wire's color on connection — no `engine/solver.ts` changes in either part.

**Tech Stack:** TypeScript, Zustand (`store/wires.ts`, `store/canvas.ts`), Konva/react-konva (`WireLayer.tsx`), Vitest.

## Global Constraints

- No changes to `engine/solver.ts`'s electrical model in either part of this plan.
- No changes to `Wire.points`, pin references, or `findJunctions` (T-tap detection) — the lane-offset feature is rendering-only, exactly like the existing crossing-hop mechanism.
- `PinDefinition.suggestedWireType` must never be read by the solver — it is UI-only (distinct from `PinDefinition.potential`, which the solver treats as a real source and reads unconditionally).
- All coils are treated as AC for this pass (`A1` = phase, `A2` = neutral) — no DC-coil variant exists yet.
- No ERC rule is added in this plan (ERC role hasn't started per `CLAUDE.md`).
- Verification commands for every task: `npm run type-check`, `npx vitest run <touched test file(s)>`. Full-suite (`npm run test`, `npm run lint`, `npm run build`) runs at the end (Task 8).

---

### Task 1: `suggestedWireType` pin field + phase/neutral assignment on existing components

**Files:**
- Modify: `src/types/circuit.ts` (`PinDefinition` interface, around line 17-32)
- Modify: `src/components/symbols/library.ts` (`lamp`, `contactor_3p`, `contactor_4p`, `timer_ton` pin arrays)
- Test: `tests/symbols/library.test.ts`

**Interfaces:**
- Produces: `PinDefinition.suggestedWireType?: WireType` — read by Task 2's `completeWire` auto-assignment.

- [ ] **Step 1: Write the failing test**

Add to `tests/symbols/library.test.ts`:

```ts
import { COMPONENT_LIBRARY } from '@/components/symbols/library'

describe('phase/neutral pin hints (suggestedWireType)', () => {
  function pin(type: string, id: string) {
    return COMPONENT_LIBRARY[type].pins.find((p) => p.id === id)
  }

  it('lamp pins are labeled phase (1) and neutral (2)', () => {
    expect(pin('lamp', '1')?.suggestedWireType).toBe('L1')
    expect(pin('lamp', '2')?.suggestedWireType).toBe('N')
  })

  it('contactor_3p coil pins are labeled A1=phase, A2=neutral', () => {
    expect(pin('contactor_3p', 'A1')?.suggestedWireType).toBe('L1')
    expect(pin('contactor_3p', 'A2')?.suggestedWireType).toBe('N')
  })

  it('contactor_4p coil pins are labeled A1=phase, A2=neutral', () => {
    expect(pin('contactor_4p', 'A1')?.suggestedWireType).toBe('L1')
    expect(pin('contactor_4p', 'A2')?.suggestedWireType).toBe('N')
  })

  it('timer_ton coil pins are labeled A1=phase, A2=neutral', () => {
    expect(pin('timer_ton', 'A1')?.suggestedWireType).toBe('L1')
    expect(pin('timer_ton', 'A2')?.suggestedWireType).toBe('N')
  })

  it('does not label pure switch/contact pins (no fixed phase/neutral side of their own)', () => {
    expect(pin('push_button_no', '13')?.suggestedWireType).toBeUndefined()
    expect(pin('circuit_breaker_3p', '1')?.suggestedWireType).toBeUndefined()
    expect(pin('aux_contact_block_no', '13')?.suggestedWireType).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/symbols/library.test.ts`
Expected: FAIL — `suggestedWireType` is `undefined` on every pin (field doesn't exist yet).

- [ ] **Step 3: Add the field to `PinDefinition`**

In `src/types/circuit.ts`, inside the `PinDefinition` interface (right after the existing `potential?: PotentialTag` line):

```ts
  /** Set only on power-source pins: the fixed potential this pin always carries (see engine/solver.ts). */
  potential?: PotentialTag
  /**
   * UI-only hint: which WireType a wire connected to this pin is expected to
   * carry (e.g. a lamp's neutral-side pin). Purely cosmetic/UX — consumed by
   * store/wires.ts's completeWire to auto-color a new wire on connection,
   * and NEVER read by engine/solver.ts. Distinct from `potential` above,
   * which the solver treats as a real source of that tag unconditionally —
   * a load/coil pin only ever receives phase/neutral from whatever it's
   * wired to, so it must not use `potential` (that would make the solver
   * inject a spurious source tag onto that pin's net regardless of actual
   * wiring).
   */
  suggestedWireType?: WireType
```

- [ ] **Step 4: Assign the hint on the 4 affected component types**

In `src/components/symbols/library.ts`:

`lamp` pins (around line 128-131), change:
```ts
    pins: [
      { id: '1', offset: { x: 15, y: 0 }, kind: 'signal' },
      { id: '2', offset: { x: 15, y: 30 }, kind: 'signal' },
    ],
```
to:
```ts
    pins: [
      { id: '1', offset: { x: 15, y: 0 }, kind: 'signal', suggestedWireType: 'L1' },
      { id: '2', offset: { x: 15, y: 30 }, kind: 'signal', suggestedWireType: 'N' },
    ],
```

`contactor_3p` coil pins (around line 37-40) — note: `contactor_4p` has textually
identical `A1`/`A2` lines elsewhere in the file, so include the preceding
power pins (which differ: `5`/`6` here vs `7`/`8` on `contactor_4p`) to keep
the edit unambiguous. Change:
```ts
      { id: '5', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '6', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil' },
```
to:
```ts
      { id: '5', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '6', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
```

`contactor_4p` coil pins (around line 342-345) — same ambiguity in reverse, so
include its own distinguishing preceding pins (`7`/`8`). Change:
```ts
      { id: '7', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '8', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil' },
```
to:
```ts
      { id: '7', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '8', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
```

`timer_ton` coil pins (around line 278-279), same change:
```ts
      { id: 'A1', offset: { x: 0, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 40, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/symbols/library.test.ts`
Expected: PASS (all new cases green; existing `resolveLampColor` cases unaffected).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/circuit.ts src/components/symbols/library.ts tests/symbols/library.test.ts
git commit -m "$(cat <<'EOF'
feat(wiring): add suggestedWireType pin hint for phase/neutral

UI-only field on PinDefinition (never read by the solver, distinct
from `potential`) so lamp and coil pins can declare which side is
phase vs. neutral, per real IEC ladder-diagram convention (A1=line,
A2=neutral).
EOF
)"
```

---

### Task 2: Auto-assign wire color on completion using `suggestedWireType`

**Files:**
- Modify: `src/store/wires.ts`
- Test: `tests/integration/wire-store.test.ts`

**Interfaces:**
- Consumes: `PinDefinition.suggestedWireType` (Task 1), `useCanvasStore.getState().components` (`src/store/canvas.ts`), `getComponentDefinition(type)` (`src/components/symbols/library.ts`).
- Produces: no new public API — `completeWire`'s existing behavior is extended; the returned wire id and rejection semantics (same-pin, duplicate) are unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `tests/integration/wire-store.test.ts` (new imports at top, new `describe` block at the end):

```ts
import { useCanvasStore } from '@/store/canvas'
```

```ts
describe('wire store — suggestedWireType auto-assignment', () => {
  beforeEach(() => {
    resetStore()
    useCanvasStore.setState({ components: {}, order: [], selectedId: null })
  })

  it('auto-assigns wireType when only one endpoint declares a hint', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const buttonId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' }) // suggestedWireType 'N'
    const id = useWireStore.getState().completeWire({ componentId: buttonId, pinId: '13' })! // no hint
    expect(useWireStore.getState().wires[id].wireType).toBe('N')
  })

  it('auto-assigns wireType when both endpoints agree', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const contactorId = useCanvasStore.getState().addComponent('contactor_3p', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' }) // 'N'
    const id = useWireStore.getState().completeWire({ componentId: contactorId, pinId: 'A2' })! // 'N'
    expect(useWireStore.getState().wires[id].wireType).toBe('N')
  })

  it('does not auto-assign when both endpoints disagree', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const contactorId = useCanvasStore.getState().addComponent('contactor_3p', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '1' }) // 'L1'
    const id = useWireStore.getState().completeWire({ componentId: contactorId, pinId: 'A2' })! // 'N'
    expect(useWireStore.getState().wires[id].wireType).toBeUndefined()
  })

  it('does not auto-assign when neither endpoint declares a hint', () => {
    const aId = useCanvasStore.getState().addComponent('push_button_no', 0, 0)
    const bId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: aId, pinId: '13' })
    const id = useWireStore.getState().completeWire({ componentId: bId, pinId: '13' })!
    expect(useWireStore.getState().wires[id].wireType).toBeUndefined()
  })

  it('manual setWireType still overrides an auto-assigned value', () => {
    const lampId = useCanvasStore.getState().addComponent('lamp', 0, 0)
    const buttonId = useCanvasStore.getState().addComponent('push_button_no', 100, 0)

    useWireStore.getState().startWire({ componentId: lampId, pinId: '2' })
    const id = useWireStore.getState().completeWire({ componentId: buttonId, pinId: '13' })!
    expect(useWireStore.getState().wires[id].wireType).toBe('N')

    useWireStore.getState().setWireType(id, 'PE')
    expect(useWireStore.getState().wires[id].wireType).toBe('PE')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/integration/wire-store.test.ts`
Expected: FAIL — `wireType` is `undefined` in every new case (auto-assignment doesn't exist yet).

- [ ] **Step 3: Implement auto-assignment in `completeWire`**

In `src/store/wires.ts`, add imports at the top:

```ts
import { useCanvasStore } from '@/store/canvas'
import { getComponentDefinition } from '@/components/symbols/library'
```

Add a module-level helper (near the top, alongside `sameEndpoint`/`samePinPair`):

```ts
function suggestedWireTypeFor(endpoint: WireEndpoint): WireType | undefined {
  const instance = useCanvasStore.getState().components[endpoint.componentId]
  if (!instance) return undefined
  const def = getComponentDefinition(instance.type)
  return def.pins.find((p) => p.id === endpoint.pinId)?.suggestedWireType
}
```

Change `completeWire`'s wire-construction step from:

```ts
      const id = generateWireId()
      const wire: Wire = { id, from: pendingFrom, to: endpoint }
```

to:

```ts
      const id = generateWireId()
      const fromHint = suggestedWireTypeFor(pendingFrom)
      const toHint = suggestedWireTypeFor(endpoint)
      const wireType = fromHint && toHint ? (fromHint === toHint ? fromHint : undefined) : (fromHint ?? toHint)
      const wire: Wire = wireType ? { id, from: pendingFrom, to: endpoint, wireType } : { id, from: pendingFrom, to: endpoint }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/wire-store.test.ts`
Expected: PASS, including the 5 new cases and all pre-existing ones (which use component ids like `'a'`/`'b'` never registered in `useCanvasStore` — `suggestedWireTypeFor` returns `undefined` for those via the `if (!instance) return undefined` guard, so `wireType` stays unset exactly as those tests already expect).

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/wires.ts tests/integration/wire-store.test.ts
git commit -m "$(cat <<'EOF'
feat(wiring): auto-assign wire color from suggestedWireType on connect

completeWire now colors a new wire from either endpoint's
suggestedWireType pin hint; a same-value match on both ends still
auto-assigns, a mismatch is left untyped rather than guessing which
side is right. Manual override via setWireType is unaffected.
EOF
)"
```

---

### Task 3: `findOverlaps` — detect coincident parallel wire segments

**Files:**
- Modify: `src/types/circuit.ts` (new `Overlap` interface)
- Modify: `src/engine/wiring.ts`
- Test: `tests/engine/wiring.test.ts`

**Interfaces:**
- Produces: `export interface Overlap { axis: 'h' | 'v'; fixed: number; start: number; end: number; wireIds: string[] }` (in `types/circuit.ts`); `findOverlaps(wires: Wire[], components: Record<string, ComponentInstance>, onlyInvolving?: Set<string>): Overlap[]` (in `engine/wiring.ts`) — consumed by Task 5 (`WireGeometryCache`).

- [ ] **Step 1: Add the `Overlap` type**

In `src/types/circuit.ts`, after the existing `Crossing` interface:

```ts
/**
 * A group of wires whose routed paths share a fully-overlapping collinear
 * segment (not just a crossing point) — e.g. several wires leaving
 * terminals aligned in the same row/column. Purely a rendering concern (see
 * engine/wiring.ts findOverlaps / pathWithLaneOffsets): each wire in the
 * group is nudged into its own parallel "lane" so all of them stay visible
 * instead of rendering on top of one another.
 */
export interface Overlap {
  axis: 'h' | 'v'
  /** The shared coordinate: y for a horizontal corridor, x for a vertical one. */
  fixed: number
  /**
   * Covering range (union) along the moving axis (x for horizontal, y for
   * vertical) of every wire segment in this connected cluster — NOT
   * necessarily where all member wires are simultaneously present (a chain
   * like A:[0,50]/B:[30,80]/C:[60,100] has no single sub-range shared by
   * all three, but is still one connected overlap group). This is safe to
   * use as-is when applying a per-wire offset: `pathWithLaneOffsets` always
   * intersects it with that wire's own actual segment bounds, so a wire
   * never gets shifted outside where it truly exists.
   */
  start: number
  end: number
  wireIds: string[]
}
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/engine/wiring.test.ts` (add `Overlap` and `findOverlaps` to the existing `@/types/circuit` / `@/engine/wiring` imports at the top):

```ts
describe('findOverlaps', () => {
  it('detects two wires sharing a fully-overlapping horizontal segment', () => {
    // a.1 (15,0) -> b.1 (115,0): horizontal at y=0. c.1 (15,0) -> d.1 (115,0): same line, same range.
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
    }
    const w1 = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    const w2 = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }
    const overlaps = findOverlaps([w1, w2], components)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0]).toMatchObject({ axis: 'h', fixed: 0, start: 15, end: 115 })
    expect(overlaps[0].wireIds.slice().sort()).toEqual(['w1', 'w2'])
  })

  it('detects a partial overlap and reports the covering range of the whole cluster', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }), // pin '1' -> (15, 0)
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }), // pin '1' -> (115, 0)
      c: instance({ id: 'c', type: 'lamp', x: 50, y: 0 }), // pin '1' -> (65, 0)
      d: instance({ id: 'd', type: 'lamp', x: 200, y: 0 }), // pin '1' -> (215, 0)
    }
    const w1 = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } } // 15..115
    const w2 = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } } // 65..215
    // w1 and w2's own ranges only truly overlap on [65,115], but the reported
    // range is the union across the connected cluster (15..215) — see the
    // `Overlap.start`/`end` doc comment for why. `pathWithLaneOffsets` still
    // only ever shifts each wire within its own actual segment bounds.
    const overlaps = findOverlaps([w1, w2], components)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0]).toMatchObject({ axis: 'h', fixed: 0, start: 15, end: 215 })
  })

  it('does not report wires on the same line whose ranges do not overlap', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }), // (15,0)
      b: instance({ id: 'b', type: 'lamp', x: 10, y: 0 }), // (25,0)
      c: instance({ id: 'c', type: 'lamp', x: 500, y: 0 }), // (515,0)
      d: instance({ id: 'd', type: 'lamp', x: 510, y: 0 }), // (525,0)
    }
    const w1 = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    const w2 = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }
    expect(findOverlaps([w1, w2], components)).toHaveLength(0)
  })

  it('does not report a single wire overlapping only itself', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    }
    const w1 = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    expect(findOverlaps([w1], components)).toHaveLength(0)
  })

  it('does not report perpendicular crossings (that is findCrossings job, not this one)', () => {
    const components: Record<string, ComponentInstance> = {
      e1: instance({ id: 'e1', type: 'lamp', x: -15, y: 35 }),
      e2: instance({ id: 'e2', type: 'lamp', x: 85, y: 35 }),
      f1: instance({ id: 'f1', type: 'lamp', x: 35, y: -15 }),
      f2: instance({ id: 'f2', type: 'lamp', x: 35, y: 85 }),
    }
    const horizontal = { id: 'h', from: { componentId: 'e1', pinId: '1' }, to: { componentId: 'e2', pinId: '1' } }
    const vertical = { id: 'v', from: { componentId: 'f1', pinId: '1' }, to: { componentId: 'f2', pinId: '1' } }
    expect(findOverlaps([horizontal, vertical], components)).toHaveLength(0)
  })

  it('onlyInvolving restricts results to groups touching one of the given wire ids', () => {
    const components: Record<string, ComponentInstance> = {
      a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
      b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
      c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
      d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
      e: instance({ id: 'e', type: 'lamp', x: 0, y: 200 }),
      f: instance({ id: 'f', type: 'lamp', x: 100, y: 200 }),
      g: instance({ id: 'g', type: 'lamp', x: 0, y: 200 }),
      h: instance({ id: 'h', type: 'lamp', x: 100, y: 200 }),
    }
    const w1 = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
    const w2 = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }
    const w3 = { id: 'w3', from: { componentId: 'e', pinId: '1' }, to: { componentId: 'f', pinId: '1' } }
    const w4 = { id: 'w4', from: { componentId: 'g', pinId: '1' }, to: { componentId: 'h', pinId: '1' } }

    const all = findOverlaps([w1, w2, w3, w4], components)
    expect(all).toHaveLength(2)

    const restricted = findOverlaps([w1, w2, w3, w4], components, new Set(['w1']))
    expect(restricted).toHaveLength(1)
    expect(restricted[0].wireIds.slice().sort()).toEqual(['w1', 'w2'])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/wiring.test.ts`
Expected: FAIL — `findOverlaps` is not exported yet.

- [ ] **Step 4: Implement `findOverlaps`**

In `src/engine/wiring.ts`, update the import at the top of the file to include the new type:

```ts
import type { ComponentInstance, Crossing, Junction, Overlap, Point, Rotation, Wire, WireType } from '@/types/circuit'
```

Add the following after `findCrossings` (before the `HOP_SAMPLES`/`pathWithHops` section):

```ts
interface LineEntry {
  wireId: string
  start: number
  end: number
}

/** `h:<y>` for a horizontal segment, `v:<x>` for vertical — null if the segment isn't axis-aligned (shouldn't happen for orthogonal routes, but guarded rather than assumed). */
function lineKey(a: Point, b: Point): string | null {
  if (Math.abs(a.y - b.y) <= EPSILON) return `h:${a.y}`
  if (Math.abs(a.x - b.x) <= EPSILON) return `v:${a.x}`
  return null
}

/**
 * Finds groups of wires whose routed paths share a fully-overlapping
 * collinear segment (same infinite line, overlapping ranges) — the case
 * `segmentIntersection` above deliberately excludes (parallel/collinear
 * pairs return null there, since that function only detects perpendicular
 * crossings). Purely a rendering concern, consumed by `pathWithLaneOffsets`
 * to fan overlapping wires into distinct parallel lanes so none of them
 * render fully hidden behind another.
 *
 * Groups are found via a standard "merge overlapping intervals" sweep per
 * canonical line: entries are sorted by their start coordinate, and any
 * entry whose start falls before the running cluster's end is folded into
 * that cluster (this is the same algorithm used to find connected
 * components of an interval-overlap graph, so a chain of 3+ wires with
 * staggered-but-connected ranges is grouped correctly, not just exact pairs).
 * Two clusters on the exact same infinite line that don't actually overlap
 * (e.g. a busbar row far to the left, and an unrelated pair of terminals far
 * to the right, both at the same y) are correctly kept as separate groups.
 *
 * `onlyInvolving` has the same incremental-recompute meaning as on
 * `findJunctions`/`findCrossings`.
 */
export function findOverlaps(
  wires: Wire[],
  components: Record<string, ComponentInstance>,
  onlyInvolving?: Set<string>,
): Overlap[] {
  const byLine = new Map<string, LineEntry[]>()

  for (const wire of wires) {
    const path = getWirePath(wire, components)
    if (!path) continue
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      const key = lineKey(a, b)
      if (!key) continue
      const horizontal = key.startsWith('h:')
      const start = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
      const end = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
      const entry: LineEntry = { wireId: wire.id, start, end }
      const list = byLine.get(key)
      if (list) list.push(entry)
      else byLine.set(key, [entry])
    }
  }

  const overlaps: Overlap[] = []

  for (const [key, entries] of byLine) {
    const horizontal = key.startsWith('h:')
    const fixed = Number(key.slice(2))
    const sorted = [...entries].sort((a, b) => a.start - b.start)

    let i = 0
    while (i < sorted.length) {
      let clusterEnd = sorted[i].end
      const clusterIdx = [i]
      let j = i + 1
      while (j < sorted.length && sorted[j].start < clusterEnd - EPSILON) {
        clusterEnd = Math.max(clusterEnd, sorted[j].end)
        clusterIdx.push(j)
        j++
      }

      const clusterEntries = clusterIdx.map((idx) => sorted[idx])
      const wireIds = [...new Set(clusterEntries.map((e) => e.wireId))]
      const clusterStart = Math.min(...clusterEntries.map((e) => e.start))

      if (wireIds.length >= 2 && (!onlyInvolving || wireIds.some((id) => onlyInvolving.has(id)))) {
        overlaps.push({ axis: horizontal ? 'h' : 'v', fixed, start: clusterStart, end: clusterEnd, wireIds })
      }
      i = j
    }
  }

  return overlaps
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/wiring.test.ts`
Expected: PASS, all `findOverlaps` cases green, and every pre-existing case in this file still green (no shared helper was renamed).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/circuit.ts src/engine/wiring.ts tests/engine/wiring.test.ts
git commit -m "$(cat <<'EOF'
feat(wiring): detect coincident overlapping parallel wire segments

findOverlaps groups wires whose routed paths share a fully-overlapping
collinear segment (not just a perpendicular crossing, which
findCrossings already handles) via an interval-merge sweep per
canonical line. Feeds the upcoming lane-offset rendering.
EOF
)"
```

---

### Task 4: `pathWithLaneOffsets` — render overlapping wires as parallel lanes

**Files:**
- Modify: `src/engine/wiring.ts`
- Test: `tests/engine/wiring.test.ts`

**Interfaces:**
- Consumes: `Overlap` shape from Task 3 (via the caller-computed `LaneShift[]` below — `pathWithLaneOffsets` itself does not take `Overlap` directly, since lane index assignment needs draw-order info that only `WireLayer.tsx` has, per Task 6).
- Produces: `export interface LaneShift { axis: 'h' | 'v'; fixed: number; start: number; end: number; offset: number }`; `export function pathWithLaneOffsets(path: Point[], shifts: LaneShift[]): Point[]` — consumed by Task 6 (`WireLayer.tsx`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/engine/wiring.test.ts` (add `LaneShift`, `pathWithLaneOffsets` to the `@/engine/wiring` import):

```ts
describe('pathWithLaneOffsets', () => {
  it('is a no-op when there are no shifts', () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    expect(pathWithLaneOffsets(path, [])).toBe(path)
  })

  it('offsets a straight horizontal path fully covered by a matching shift', () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    const shifts = [{ axis: 'h' as const, fixed: 50, start: 0, end: 100, offset: 4 }]
    const result = pathWithLaneOffsets(path, shifts)
    // The jog-in/jog-out points sit at the segment's own start/end (offset
    // 0) right before/after the offset-line points — harmless zero-length
    // duplicates of the true endpoints when the shift covers the whole
    // segment, not a bug (Konva renders a degenerate sub-segment invisibly).
    expect(result).toEqual([
      { x: 0, y: 50 },
      { x: 0, y: 50 },
      { x: 0, y: 54 },
      { x: 100, y: 54 },
      { x: 100, y: 50 },
      { x: 100, y: 50 },
    ])
  })

  it('leaves a segment untouched when no shift matches its axis/fixed coordinate', () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    const shifts = [{ axis: 'h' as const, fixed: 999, start: 0, end: 100, offset: 4 }]
    expect(pathWithLaneOffsets(path, shifts)).toEqual(path)
  })

  it('only offsets the portion of a segment inside the shift range, jogging in and out', () => {
    // Segment from x=0 to x=100 at y=50; shift only covers x=60..100.
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]
    const shifts = [{ axis: 'h' as const, fixed: 50, start: 60, end: 100, offset: 4 }]
    const result = pathWithLaneOffsets(path, shifts)
    expect(result[0]).toEqual({ x: 0, y: 50 })
    expect(result[result.length - 1]).toEqual({ x: 100, y: 50 })
    // Somewhere in the middle the path must reach the offset line.
    expect(result.some((p) => Math.abs(p.y - 54) < 1e-6)).toBe(true)
    // And a point before the shift's start must stay on the original line.
    expect(result.some((p) => p.x <= 60 && Math.abs(p.y - 50) < 1e-6)).toBe(true)
  })

  it('handles a vertical segment the same way', () => {
    const path = [{ x: 50, y: 0 }, { x: 50, y: 100 }]
    const shifts = [{ axis: 'v' as const, fixed: 50, start: 0, end: 100, offset: -3 }]
    const result = pathWithLaneOffsets(path, shifts)
    expect(result).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 0 },
      { x: 47, y: 0 },
      { x: 47, y: 100 },
      { x: 50, y: 100 },
      { x: 50, y: 100 },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/wiring.test.ts`
Expected: FAIL — `pathWithLaneOffsets`/`LaneShift` not exported yet.

- [ ] **Step 3: Implement `pathWithLaneOffsets`**

In `src/engine/wiring.ts`, add after `findOverlaps`:

```ts
export interface LaneShift {
  axis: 'h' | 'v'
  /** The shared coordinate this shift applies to: y for a horizontal segment, x for a vertical one. */
  fixed: number
  /** Range along the moving axis (x for horizontal, y for vertical) the offset applies within. */
  start: number
  end: number
  /** Perpendicular offset to apply within [start, end], in px (positive = down/right). */
  offset: number
}

/**
 * Returns `path` with each segment nudged perpendicular by its matching
 * `LaneShift`'s offset, within that shift's [start, end] range along the
 * segment — the rendering counterpart to `findOverlaps`. A segment with no
 * matching shift (different axis, or `fixed` coordinate not within
 * EPSILON) is left untouched. A segment only partially covered by its
 * shift's range gets a short perpendicular jog in and out of the offset
 * corridor rather than being fully displaced, so it still meets its own
 * pin/bend endpoints exactly. Endpoints of the overall path are always
 * preserved. When a shift covers a segment's entire span, the jog-in/out
 * points land exactly on that segment's own start/end (offset 0) —
 * harmless zero-length duplicate points, not a bug.
 *
 * Note: this looks up at most one matching shift per segment (by
 * axis+fixed), so a single wire with two separate segments on the exact
 * same canonical line but different shift ranges is not supported — not a
 * real scenario for the Manhattan-routed wires this app produces.
 */
export function pathWithLaneOffsets(path: Point[], shifts: LaneShift[]): Point[] {
  if (shifts.length === 0 || path.length < 2) return path

  const result: Point[] = [path[0]]
  for (let i = 0; i < path.length - 1; i++) {
    const segStart = path[i]
    const segEnd = path[i + 1]
    const horizontal = Math.abs(segStart.y - segEnd.y) <= EPSILON
    const axis: 'h' | 'v' = horizontal ? 'h' : 'v'
    const fixed = horizontal ? segStart.y : segStart.x
    const shift = shifts.find((s) => s.axis === axis && Math.abs(s.fixed - fixed) <= EPSILON)

    if (!shift) {
      result.push(segEnd)
      continue
    }

    const segMin = horizontal ? Math.min(segStart.x, segEnd.x) : Math.min(segStart.y, segEnd.y)
    const segMax = horizontal ? Math.max(segStart.x, segEnd.x) : Math.max(segStart.y, segEnd.y)
    const overlapStart = Math.max(segMin, shift.start)
    const overlapEnd = Math.min(segMax, shift.end)

    if (overlapEnd <= overlapStart + EPSILON) {
      result.push(segEnd)
      continue
    }

    const increasing = horizontal ? segEnd.x > segStart.x : segEnd.y > segStart.y
    const enter = increasing ? overlapStart : overlapEnd
    const exit = increasing ? overlapEnd : overlapStart

    const pointAt = (pos: number, offsetPerp: number): Point =>
      horizontal ? { x: pos, y: fixed + offsetPerp } : { x: fixed + offsetPerp, y: pos }

    result.push(pointAt(enter, 0))
    result.push(pointAt(enter, shift.offset))
    result.push(pointAt(exit, shift.offset))
    result.push(pointAt(exit, 0))
    result.push(segEnd)
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/wiring.test.ts`
Expected: PASS — all `pathWithLaneOffsets` cases green, plus every pre-existing case in the file.

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/wiring.ts tests/engine/wiring.test.ts
git commit -m "$(cat <<'EOF'
feat(wiring): render overlapping wires as offset parallel lanes

pathWithLaneOffsets nudges a wire's path perpendicular within a
LaneShift's range, jogging in/out of the offset corridor so its own
pin/bend endpoints are always preserved exactly.
EOF
)"
```

---

### Task 5: Wire `findOverlaps` into `WireGeometryCache`'s incremental pipeline

**Files:**
- Modify: `src/engine/wireGeometryCache.ts`
- Test: `tests/engine/wireGeometryCache.test.ts`

**Interfaces:**
- Consumes: `findOverlaps` (Task 3).
- Produces: `WireGeometryCache.update()`'s return type gains `overlaps: Overlap[]` — consumed by Task 6 (`WireLayer.tsx`).

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/wireGeometryCache.test.ts`:

```ts
it('recomputes overlaps only for pairs touching a changed wire', () => {
  const cache = new WireGeometryCache()
  const components: Record<string, ComponentInstance> = {
    a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
    b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
    d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
  }
  const w1: Wire = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
  const w2: Wire = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }

  const first = cache.update([w1, w2], components)
  expect(first.overlaps).toHaveLength(1)
  expect(first.overlaps[0].wireIds.slice().sort()).toEqual(['w1', 'w2'])

  // Move an unrelated component — the overlap must survive untouched (same array reference).
  const unrelated = instance({ id: 'z', type: 'lamp', x: 500, y: 500 })
  const second = cache.update([w1, w2], { ...components, z: unrelated })
  expect(second.changed.size).toBe(0)
  expect(second.overlaps).toBe(first.overlaps)
})

it('drops an overlap when the wire that caused it is removed', () => {
  const cache = new WireGeometryCache()
  const components: Record<string, ComponentInstance> = {
    a: instance({ id: 'a', type: 'lamp', x: 0, y: 0 }),
    b: instance({ id: 'b', type: 'lamp', x: 100, y: 0 }),
    c: instance({ id: 'c', type: 'lamp', x: 0, y: 0 }),
    d: instance({ id: 'd', type: 'lamp', x: 100, y: 0 }),
  }
  const w1: Wire = { id: 'w1', from: { componentId: 'a', pinId: '1' }, to: { componentId: 'b', pinId: '1' } }
  const w2: Wire = { id: 'w2', from: { componentId: 'c', pinId: '1' }, to: { componentId: 'd', pinId: '1' } }

  cache.update([w1, w2], components)
  const after = cache.update([w1], components)
  expect(after.overlaps).toHaveLength(0)
})
```

Also add `Wire` to the existing `@/types/circuit` import in this test file if not already present (it already is, per the current file).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/wireGeometryCache.test.ts`
Expected: FAIL — `update()`'s return value has no `overlaps` property yet.

- [ ] **Step 3: Wire `findOverlaps` into the cache**

In `src/engine/wireGeometryCache.ts`, update the import:

```ts
import type { ComponentInstance, Crossing, Junction, Overlap, Point, Wire } from '@/types/circuit'
import { findCrossings, findJunctions, findOverlaps, getWirePath } from '@/engine/wiring'
```

Add a field alongside `lastJunctions`/`lastCrossings`:

```ts
  private lastOverlaps: Overlap[] = []
```

In `update()`, alongside the existing junctions/crossings recompute block:

```ts
    if (changed.size > 0) {
      const freshJunctions = findJunctions(wires, components, changed)
      const retainedJunctions = this.lastJunctions.filter((j) => !j.wireIds.some((id) => changed.has(id)))
      this.lastJunctions = mergeJunctions(retainedJunctions, freshJunctions)

      const freshCrossings = findCrossings(wires, components, changed)
      const retainedCrossings = this.lastCrossings.filter((c) => !c.wireIds.some((id) => changed.has(id)))
      this.lastCrossings = [...retainedCrossings, ...freshCrossings]

      const freshOverlaps = findOverlaps(wires, components, changed)
      const retainedOverlaps = this.lastOverlaps.filter((o) => !o.wireIds.some((id) => changed.has(id)))
      this.lastOverlaps = [...retainedOverlaps, ...freshOverlaps]
    }

    return { paths, junctions: this.lastJunctions, crossings: this.lastCrossings, overlaps: this.lastOverlaps, changed }
```

Update the `update()` method's return type annotation to include `overlaps: Overlap[]`:

```ts
  update(
    wires: Wire[],
    components: Record<string, ComponentInstance>,
  ): { paths: Record<string, Point[] | null>; junctions: Junction[]; crossings: Crossing[]; overlaps: Overlap[]; changed: Set<string> } {
```

And reset it in `clear()`:

```ts
  clear() {
    this.pathEntries.clear()
    this.lastJunctions = []
    this.lastCrossings = []
    this.lastOverlaps = []
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/wireGeometryCache.test.ts`
Expected: PASS — new cases green, all 4 pre-existing cases still green.

- [ ] **Step 5: Run the perf budget test (no regression check)**

Run: `npx vitest run tests/engine/wiring-perf.test.ts`
Expected: PASS — `findOverlaps`'s per-line grouping is the same asymptotic complexity class as the existing `findCrossings` bbox-culled pairwise check, so the 500-component/1000-wire budget in this file should hold. If it fails, that is a genuine regression to fix in this task, not a later one — profile which of `findJunctions`/`findCrossings`/`findOverlaps` is the new bottleneck before touching anything.

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/wireGeometryCache.ts tests/engine/wireGeometryCache.test.ts
git commit -m "$(cat <<'EOF'
feat(wiring): fold findOverlaps into WireGeometryCache's incremental update

Same onlyInvolving-narrowed recompute pattern already used for
junctions/crossings — a single component move only re-checks overlaps
for the handful of wires actually touching it.
EOF
)"
```

---

### Task 6: Render lane-offset wires in `WireLayer.tsx`

**Files:**
- Modify: `src/components/Canvas/WireLayer.tsx`

**Interfaces:**
- Consumes: `geometryCache.update()`'s `overlaps` field (Task 5), `pathWithLaneOffsets`/`LaneShift` (Task 4), `order` (existing).
- Produces: no new exports — this is the rendering integration, verified manually (this codebase has no Konva/React component-level test harness; see the existing pattern for `WireLayer.tsx`/`ComponentSymbol.tsx`, both manually verified via `npm run dev` per every prior phase's write-up in `CLAUDE.md`).

- [ ] **Step 1: Import the new pieces**

In `src/components/Canvas/WireLayer.tsx`, update the import from `@/engine/wiring`:

```ts
import { dragWireSegment, getPinPosition, pathWithHops, pathWithLaneOffsets, routeOrthogonal, wireColor } from '@/engine/wiring'
import type { LaneShift } from '@/engine/wiring'
```

- [ ] **Step 2: Destructure `overlaps` from the geometry cache result**

Change:

```ts
  const { paths, junctions, crossings } = useMemo(
    () => geometryCache.update(wireList, components),
    [geometryCache, wireList, components],
  )
```

to:

```ts
  const { paths, junctions, crossings, overlaps } = useMemo(
    () => geometryCache.update(wireList, components),
    [geometryCache, wireList, components],
  )
```

- [ ] **Step 3: Build a per-wire lane-shift map, mirroring the existing `hopsByWire` pattern**

Add this `useMemo` right after the existing `hopsByWire` one:

```ts
  const LANE_SPACING = 4

  // wireId -> LaneShift[] to apply to that wire's path. Lane index within a
  // group is assigned by each wire's position in `order` (same determinism
  // rule as hopsByWire), then centered around 0 so the group fans out
  // symmetrically instead of all shifting the same direction.
  const laneShiftsByWire = useMemo(() => {
    const map = new Map<string, LaneShift[]>()
    for (const overlap of overlaps) {
      const sortedIds = [...overlap.wireIds].sort((a, b) => order.indexOf(a) - order.indexOf(b))
      const count = sortedIds.length
      sortedIds.forEach((wireId, laneIndex) => {
        const offset = (laneIndex - (count - 1) / 2) * LANE_SPACING
        const shift: LaneShift = { axis: overlap.axis, fixed: overlap.fixed, start: overlap.start, end: overlap.end, offset }
        const list = map.get(wireId)
        if (list) list.push(shift)
        else map.set(wireId, [shift])
      })
    }
    return map
  }, [overlaps, order])
```

- [ ] **Step 4: Apply lane offsets before hops when rendering each wire**

Change:

```ts
        const hops = hopsByWire.get(wire.id)
        const renderedPath = hops && hops.length > 0 ? pathWithHops(path, hops) : path
```

to:

```ts
        const laneShifts = laneShiftsByWire.get(wire.id)
        const laneAdjustedPath = laneShifts && laneShifts.length > 0 ? pathWithLaneOffsets(path, laneShifts) : path
        const hops = hopsByWire.get(wire.id)
        const renderedPath = hops && hops.length > 0 ? pathWithHops(laneAdjustedPath, hops) : laneAdjustedPath
```

- [ ] **Step 5: Type-check and run the full existing test suite (no test file changes in this task, but confirm nothing else broke)**

Run: `npm run type-check`
Expected: no errors.

Run: `npx vitest run tests/engine tests/integration`
Expected: PASS — this task touches no test-covered logic (`WireLayer.tsx` isn't unit-tested), so this is a regression check, not new coverage.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev`

In the app:
1. Add a `power_source_1p` and three `lamp` components positioned so their pin `2` (neutral) all line up on the same row.
2. Wire the source's `N` pin to each lamp's pin `2` such that two of the resulting wires share a stretch of the same horizontal track (e.g. route two lamps side-by-side so their neutral-return wires both run along the same row before diverging).
3. Confirm the two overlapping wires render as two distinct parallel blue lines (not one line occluding the other) along the shared stretch, and confirm each wire's connection to its lamp is still visually correct (no gap, no visual disconnect from the pin).
4. Confirm wiring a lamp's pin `1`/`2` still auto-colors the wire (brown/blue) per Task 2, and that the pre-existing crossing-hop feature (two unrelated wires crossing perpendicularly) still renders its arc correctly.

- [ ] **Step 7: Commit**

```bash
git add src/components/Canvas/WireLayer.tsx
git commit -m "$(cat <<'EOF'
feat(wiring): render coincident-overlap wires as offset parallel lanes

WireLayer now applies pathWithLaneOffsets (keyed off the geometry
cache's overlaps) before the existing crossing-hop pass, so wires
sharing a routed track stay visually distinct instead of rendering on
top of one another.
EOF
)"
```

---

### Task 7: Documentation updates

**Files:**
- Modify: `docs/component-catalog.md` (§8, "Bobinas, Temporizadores y Relés Auxiliares")
- Modify: `src/components/symbols/schema.md` (§6, "Declaring pins")

**Interfaces:** none (docs only).

- [ ] **Step 1: Document the A1=phase/A2=neutral convention in the catalog**

In `docs/component-catalog.md`, in section 8, change:

```
* **Bobina de Contactor / Relé Auxiliar (Estándar)**:
  * *Bornes:* A1 - A2.
  * Al energizarse con la tensión adecuada, conmuta todos los contactos que compartan su misma etiqueta (ej. `KM1`, `KA1`).
```

to:

```
* **Bobina de Contactor / Relé Auxiliar (Estándar)**:
  * *Bornes:* A1 - A2. Convención: A1 = lado de fase (alimentado a través de los contactos de mando), A2 = lado de neutro (unido al riel de neutro). Todas las bobinas se modelan hoy como AC; una variante DC (+24V/0V) tendría su propia convención de bornes.
  * Al energizarse con la tensión adecuada, conmuta todos los contactos que compartan su misma etiqueta (ej. `KM1`, `KA1`).
```

- [ ] **Step 2: Document `suggestedWireType` in the symbol authoring guide**

In `src/components/symbols/schema.md`, at the end of section 6 ("Declaring pins"), after the existing paragraph ending in "...update the other or CI fails.", add:

```markdown

A pin that represents a load or coil's fixed phase/neutral side (never a
pure switch/contact pin, which has no fixed side of its own) may also carry
`data-pin-suggested-wire-type="<WireType>"` — parsed into
`PinDefinition.suggestedWireType`. This is UI-only: it lets
`store/wires.ts`'s `completeWire` auto-color a new wire on connection (e.g.
a lamp's neutral pin auto-assigns blue), and is never read by
`engine/solver.ts`. Do not confuse this with `data-pin-potential`
(`PinDefinition.potential`), which the solver treats as a real source of
that tag — only use `potential` on an actual power-source pin.
```

- [ ] **Step 3: Commit**

```bash
git add docs/component-catalog.md src/components/symbols/schema.md
git commit -m "$(cat <<'EOF'
docs: document A1/A2 phase-neutral convention and suggestedWireType

Component catalog now states the A1=phase/A2=neutral coil convention;
the symbol authoring guide documents the new suggestedWireType pin
attribute and how it differs from potential.
EOF
)"
```

---

### Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS, all files green (existing count plus this plan's new cases).

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds (pre-existing Vite chunk-size warning, if any, is not a regression).

- [ ] **Step 5: Confirm no stray uncommitted changes**

Run: `git status`
Expected: clean working tree — every task above already committed its own changes.
