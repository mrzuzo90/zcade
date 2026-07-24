# Symbol Authoring Guide (Phase A, SYM)

How to draw a new component symbol that `svgParser.ts` / `SymbolRenderer.tsx`
understand. This is the practical companion to the type contract in
`schema.ts` — read that file's TSDoc for the "why", this file for the "how".
Aimed at whoever authors the next batch of symbols (SYM in Phase A week 2,
then LIB/PNEU self-serving in Phases B/D per the roadmap).

## 1. File location & naming

One SVG per component type, filename == `ComponentDefinition.type`:

```
assets/symbols/<type>.svg      e.g. assets/symbols/contactor_3p.svg
```

Dropping a file there is the entire registration step — `symbolRegistry.ts`
glob-loads and parses every file under `/assets/symbols/` at module init. No
other file needs editing to make a new symbol available to
`getSymbolDefinition()`. (Wiring it into `library.ts` so the solver/canvas
actually place it as a component is a separate step, unrelated to the SVG.)

## 2. viewBox = the component's footprint

```xml
<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
```

Use the exact same numbers as the component's `width`/`height` in
`library.ts` at rotation 0. This keeps pin coordinates identical between the
SVG and `PinDefinition.offset` with zero scale/translate math — `viewBox`
*is* the footprint for every Tier 1 symbol. (`SymbolRenderer` will scale a
mismatched viewBox instead of throwing, but don't rely on that — it's a
safety net, not a feature.)

## 3. Body geometry: `<path>` only

No `<rect>`, `<circle>`, `<line>`, `<polyline>`. Every visible mark is one
`<path d="...">`. This isn't a style preference — the parser has no code
path for tessellating other primitives, by design (see `svgParser.ts` doc
comment: it keeps every authored `d` string byte-for-byte identical to what
Konva.Path draws, so "vector-crisp at any zoom" is structurally guaranteed
rather than something to test for).

Cheat-sheet for common shapes as paths:

| Shape | Path recipe |
|---|---|
| Straight line | `M x1,y1 L x2,y2` |
| Multiple disconnected strokes in one path | `M x1,y1 L x2,y2 M x3,y3 L x4,y4` (extra `M` starts a new subpath) |
| Circle, center `(cx,cy)` radius `r` | `M cx,cy-r A r,r 0 1,0 cx,cy+r A r,r 0 1,0 cx,cy-r Z` (two arcs) |
| Diamond/rotated square, center `(cx,cy)` half-width `w` | `M cx,cy-w L cx+w,cy L cx,cy+w L cx-w,cy Z` |
| Wavy "~" (AC indicator) | a couple of cubic `C` segments — see `power_source_3p.svg` |

Presentation attributes supported per `<path>`: `fill`, `stroke`,
`stroke-width`, `fill-rule`, `stroke-linecap`, `stroke-linejoin`,
`stroke-dasharray`, `opacity`. Anything else (transforms, gradients,
markers, `class`/CSS) is silently ignored by the parser — don't use them.

## 4. `currentColor` convention

Any path's `fill` or `stroke` may be the literal string `"currentColor"`.
`SymbolRenderer` substitutes the instance's live status color at render time
(blue when selected, amber when energized, neutral gray otherwise — the
same three-way choice the old hand-drawn `Rect` stroke made). Use it for
every line that should track selection/energize state; use a literal hex
color only for something that must stay a fixed color regardless of state
(e.g. the green "closed contact" bridge, the amber energized-coil glow).

## 5. State layers

Wrap groups of paths that should toggle together in
`<g id="layer:<name>">`. Three kinds of names matter to the renderer:

- **`base`** — always drawn. Every symbol needs exactly one.
- **`energized`** — drawn in addition to `base` when the component is "live"
  (coil energized / lamp lit / motor running).
- **`contact-<pinA>-<pinB>-open` / `-closed`** — a pair per
  `ContactSegment` in `library.ts` (`segment.pins.join('-')` gives the key).
  Naming them this way is just convention for readability; what actually
  wires them up is the `stateLayers.contacts` map (next section) — the
  parser doesn't parse meaning out of the layer *name* itself, only the
  `layer:` prefix.

A layer with no state significance at all (decorative-only) still needs the
`layer:` prefix to be picked up, but doesn't need to be referenced by
`stateLayers` — it just won't ever render, so in practice give every
authored layer a role.

## 6. Declaring pins

```xml
<g id="pins">
  <circle data-pin-id="1" data-pin-kind="power_no" cx="0" cy="10" r="1"/>
  <circle data-pin-id="A1" data-pin-kind="coil" cx="30" cy="0" r="1"/>
</g>
```

`cx`/`cy` must equal the pin's `offset.x`/`offset.y` in `library.ts` exactly.
`data-pin-kind` must be a valid `PinKind` (see `types/circuit.ts`). The
`<circle>` here is metadata, not artwork — it isn't inside a `layer:` group
so it never renders; `r` is ignored. `tests/symbols/symbolRegistry.test.ts`
asserts this list matches `library.ts` byte-for-byte for every migrated
type — if you add/rename a pin in one place, update the other or CI fails.

A pin that represents a load or coil's fixed phase/neutral side (never a
pure switch/contact pin, which has no fixed side of its own) may also carry
`data-pin-suggested-wire-type="<WireType>"` — parsed into
`PinDefinition.suggestedWireType`. This is UI-only: it lets
`store/wires.ts`'s `completeWire` auto-color a new wire on connection (e.g.
a lamp's neutral pin auto-assigns blue), and is never read by
`engine/solver.ts`. Do not confuse this with `data-pin-potential`
(`PinDefinition.potential`), which the solver treats as a real source of
that tag — only use `potential` on an actual power-source pin.

## 7. Wiring up `stateLayers` explicitly (optional but recommended once you have contacts)

Without any metadata, the parser assumes `base` is your base layer and
`energized` (if present) is the energized overlay, with no contact
toggling. As soon as a symbol has open/closed contact variants, declare them
explicitly:

```xml
<metadata id="stateLayers">
  {
    "base": "base",
    "energized": "energized",
    "contacts": {
      "1-2": { "open": "contact-1-2-open", "closed": "contact-1-2-closed" }
    }
  }
</metadata>
```

This is plain JSON, parsed verbatim into `SymbolStateLayers`. Keys under
`"contacts"` must match `segment.pins.join('-')` for the corresponding
`ContactSegment` in `library.ts` — see
`tests/symbols/symbolRegistry.test.ts` for the parity check.

## 8. Worked examples

Every Tier 1 symbol (`assets/symbols/*.svg`) is a working example of every
rule above — `contactor_3p.svg` is the most complete one (coil energized
layer + 3 contact segment pairs), `push_button_no.svg` / `push_button_nc.svg`
are the smallest ones worth reading first.

## 9. What this pipeline deliberately does NOT do (yet)

- No automatic scale-to-fit for a viewBox that doesn't match the component
  footprint (works, but untested/unused by Tier 1 — don't rely on it).
- No nested/recursive layer groups — keep all `layer:` groups as direct
  children of `<svg>`.
- No nested "layer inside a layer" toggling — a layer is all-or-nothing.
- No nested `<pins>` scoping per rotation — pin positions are always
  authored at rotation 0; `engine/wiring.ts::getPinPosition` (ROUTE/SOLV
  owned) applies rotation at read time, same as before this pipeline
  existed.
