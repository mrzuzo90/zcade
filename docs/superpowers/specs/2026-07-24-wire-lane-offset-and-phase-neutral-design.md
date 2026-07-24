# Wire lane offset (parallel overlap) + phase/neutral pin hints

Status: approved by Zuzo 2026-07-24. Feeds into an implementation plan (writing-plans).

## Context

Two related wire-rendering/UX gaps, raised together by Zuzo:

1. Two wires whose routed path shares a fully-collinear, overlapping segment
   (not just a perpendicular crossing) render exactly on top of each other —
   one visually occludes the other. This is distinct from the existing
   crossing-hop mechanism (`findCrossings`/`pathWithHops` in `engine/wiring.ts`),
   which only handles perpendicular intersections at a non-shared point; it
   does nothing for coincident parallel segments (e.g. several wires leaving
   terminals aligned in the same row/column).
2. Components have no notion of "this pin is the phase side, this pin is the
   neutral side" for their real-world single-phase function, so there's no
   basis for auto-coloring a neutral wire blue (`WIRE_TYPE_COLORS.N`) vs.
   phase brown/black/grey when the user wires them up. `wireType` today is
   always a fully manual per-wire choice.

Both are cosmetic/UX-layer fixes; neither changes `engine/solver.ts`'s
electrical model.

## Part 1 — Parallel-overlap wire offset

### Decisions

- New function in `engine/wiring.ts`, `findOverlaps(wires, components)`,
  sibling to `findCrossings`: detects segment pairs that are **collinear**
  (same infinite line) with **overlapping parameter ranges** (not just a
  shared point) — the case `findCrossings`/`segmentIntersection` explicitly
  excludes (parallel/collinear segments return `null` there today). Groups
  every wire sharing a given overlapping track together.
- New rendering transform, `pathWithLaneOffsets(path, laneAssignment, spacing)`,
  sibling to `pathWithHops`: within an overlapping track, each wire is
  shifted perpendicular to the shared segment by `laneIndex * spacing`
  (spacing on the order of 3–4px), blending back to the wire's true
  endpoints (pins) outside the overlap region. Pin connections are never
  touched — this is purely a rendered-polyline transform, exactly like the
  existing hop mechanism.
- **Lane ordering is deterministic**: same tie-break already used for
  `hopsByWire` (each wire's index in the `order` array), so the same layout
  reproduces the same lane assignment across renders/reloads.
- **No change to the electrical/data model** — `Wire.points`, pin
  references, `findJunctions` (T-tap detection) are all untouched. This is
  additive, rendering-only, following the same pattern Phase A Week 2's
  crossing-hop feature already established.
- Integration: wired into `WireGeometryCache`'s incremental update (same
  `onlyInvolving`-narrowed recompute pattern as junctions/crossings) and
  consumed by `WireLayer.tsx` alongside the existing `hopsByWire` lookup —
  a wire's final rendered path applies lane offsets first, then hops, before
  being handed to Konva's `Line`.

### Out of scope for this pass

- Turning on the dark A* router (`ASTAR_ROUTING_ENABLED`) — considered and
  explicitly deferred; this is a rendering-level fix, not a routing-engine
  change.
- Any change to how `routeOrthogonal` computes the initial elbow route.

## Part 2 — Phase/neutral pin hints

### Decisions

- New optional field on `PinDefinition` (`types/circuit.ts`):
  `suggestedWireType?: WireType`. **UI-only — the solver never reads this
  field.** This is a deliberate split from the existing `potential` field:
  `potential` tells the solver "this pin outputs this tag as a real source"
  (correct for `power_source_3p`/`_1p`/`_dc`'s pins), which would be wrong
  semantics for a load or coil pin that merely *receives* phase/neutral from
  whatever it's wired to. Reusing `potential` for this would have made the
  solver inject a spurious source tag onto that pin's net regardless of
  actual wiring — confirmed by reading `solver.ts`'s net-potential seeding,
  which adds any pin with a `potential` value unconditionally.
- **Auto-assignment on wire completion**: in `completeWire`
  (`store/wires.ts`), if either endpoint pin declares `suggestedWireType`,
  the new wire's `wireType` is set to that value automatically (so it
  renders in the right color immediately, e.g. neutral blue). If both
  endpoints declare a value and they **agree**, same result. If both declare
  a value and they **disagree** (the user is likely wiring something
  incorrectly), auto-assignment is skipped entirely — the wire is left
  untyped (today's default gray), rather than silently picking one side's
  suggestion and implying a correctness judgment this feature doesn't make.
  The user can always override the color manually afterward via the
  existing wire-type `<select>` in `Toolbar.tsx` — unchanged.
- **Per-component assignment** (every coil is treated as AC for now, per
  Zuzo's direction — a future DC-coil variant would need its own pin
  potentials, out of scope here):
  - `lamp`: pin `'1'` → `L1`, pin `'2'` → `N`
  - `contactor_3p`, `contactor_4p`, `timer_ton`: pin `A1` → `L1`, pin `A2` → `N`
    (matches real IEC ladder-diagram convention: A1 is fed from the line
    side through control contacts, A2 ties to the neutral rail)
  - New single-phase unifilar types from the companion symbol-integration
    spec (`bt_iluminacion`, `bt_indicador`) get the same `1→L1`/`2→N`
    treatment when their pins are authored — cross-referenced there, not
    re-specified in this document.
  - **No change** to pure switch/contact pins (push buttons, aux contact
    blocks, breakers, thermal overload relay, emergency stop) — a contact's
    two terminals have no fixed phase/neutral side; which one ends up as
    line vs. neutral is entirely determined by how the surrounding circuit
    is wired, not a property of the switch itself.
- `docs/component-catalog.md` and `schema.md` (SYM's symbol-authoring guide)
  updated to document the A1=phase/A2=neutral convention and the
  `suggestedWireType` field, so future component authors apply it
  consistently.

## Verification Plan

- `tests/engine/wiring.test.ts`: new cases for `findOverlaps` (fully
  overlapping segments, partial overlap, non-collinear near-misses that
  must NOT be flagged) and `pathWithLaneOffsets` (lane spacing, endpoint
  preservation, stability of lane assignment).
- `tests/integration/wire-store.test.ts`: new cases for `completeWire`'s
  auto-assignment (single-side hint, agreeing both-side hint, conflicting
  both-side hint → no assignment, manual override still works after
  auto-assignment).
- Manual visual pass in `npm run dev`: build a small ladder circuit with
  several coils sharing a neutral rail (classic overlap case) and confirm
  wires render as visibly distinct parallel lines, and confirm a lamp/coil
  wired up auto-colors its neutral leg blue.
- `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`.

## Explicitly Out of Scope

- No ERC rule consuming `suggestedWireType` to flag miswired phase/neutral
  connections — that's ERC-role work (not started, per `CLAUDE.md`), and
  this field is deliberately advisory-only for now.
- No change to `engine/solver.ts`'s electrical model in either part of this
  design.
- No DC-coil pin potentials (all coils treated as AC per this pass).
