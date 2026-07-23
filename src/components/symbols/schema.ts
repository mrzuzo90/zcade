import type { PinKind } from '@/types/circuit'

/**
 * SVG Symbol Metadata Schema (Phase A, SYM-owned)
 * ================================================
 *
 * This is the frozen (Day 2) schema referenced by COMPLETE_PROJECT_ROADMAP.md
 * Section 10.1, extended from the draft there for real use. See
 * `src/components/symbols/schema.md` for the authoring guide (how to draw a
 * new symbol SVG that this pipeline understands); this file is the type
 * contract the parser (`svgParser.ts`) produces and the renderer
 * (`SymbolRenderer.tsx`) consumes.
 *
 * Design summary:
 * - Every symbol is authored as a plain SVG file under `/assets/symbols/`
 *   containing ONLY <path> elements grouped into named <g id="layer:...">
 *   state layers, plus one <g id="pins"> of marker <circle> elements. No
 *   <rect>/<circle-as-body>/<line> primitives are used for body geometry —
 *   everything is a path `d` string, so the parser never tessellates or
 *   rasterizes anything: each authored path becomes exactly one Konva.Path
 *   at render time (vector-crisp at any zoom, per Risk 3 mitigation).
 * - `viewBox` is authored in the SAME px units as the component's
 *   `width`/`height` in `library.ts` at rotation 0, and pin marker
 *   coordinates are authored to match `PinDefinition.offset` exactly. This
 *   means the renderer never needs a symbol-local scale/translate step for
 *   the 8 Tier-1 symbols migrated this week — `viewBox` IS the footprint.
 *   (A future symbol with a footprint that doesn't divide evenly could still
 *   use a different viewBox and let SymbolRenderer scale it; the renderer
 *   supports that, it just isn't exercised by the current library.)
 */

/** `[minX, minY, width, height]`, taken verbatim from the SVG root `viewBox` attribute. */
export type ViewBox = [number, number, number, number]

/**
 * One authored `<path>` element. Fields mirror the small subset of SVG
 * presentation attributes Konva.Path understands directly, so no
 * translation table is needed between "parsed" and "rendered" shapes.
 *
 * `stroke`/`fill` may be the literal string `"currentColor"` — the one
 * pipeline-specific convention this schema adds on top of plain SVG. At
 * render time `SymbolRenderer` substitutes it with the instance's live
 * status color (selected / energized / neutral), the same three-way choice
 * `ComponentSymbol.tsx` already made for its hand-drawn `Rect` stroke. This
 * is what lets one authored SVG stay correct across selection/energize
 * state without needing separate "selected" layer variants.
 *
 * `stroke`/`fill` may ALSO be the literal string `"signalColor"` — a second,
 * independent sentinel (added Phase A Week 2, SYM) substituted with
 * `SymbolRenderer`'s `signalColor` prop instead of `statusColor`. This
 * exists for the one case where a component's "live" fill must show a
 * configurable color that ISN'T the generic selection/energize indicator —
 * `lamp`'s lens, whose color is a per-instance property (IEC signaling
 * red/green/yellow/blue/white, see `library.ts`'s `LAMP_COLORS`) and must
 * stay visually distinct from the universal amber "this is energized" glow
 * every other component uses. A path with no `signalColor` prop supplied
 * falls back to `SymbolRenderer`'s default (matches the prior hardcoded
 * amber lamp fill, so existing symbols that never opt into this are
 * unaffected).
 */
export interface SymbolPathDef {
  /** SVG path `d` attribute. */
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  fillRule?: 'nonzero' | 'evenodd'
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'round' | 'bevel' | 'miter'
  /** SVG `stroke-dasharray`, parsed to numbers. */
  dash?: number[]
  opacity?: number
}

/**
 * A named, independently toggleable group of paths — authored in source SVG
 * as `<g id="layer:<id>">`. This is the "state-variant layers" mechanism:
 * one SVG file carries every open/closed/energized variant as sibling
 * layers instead of separate files, and `SymbolStateLayers` below picks
 * which layer ids are active for a given runtime state.
 */
export interface SymbolLayer {
  id: string
  paths: SymbolPathDef[]
}

/**
 * Declarative pin metadata, authored in source SVG as
 * `<g id="pins"><circle data-pin-id="1" data-pin-kind="power_no" cx="0" cy="10" r="1"/>...</g>`.
 *
 * This intentionally duplicates (rather than replaces) `PinDefinition` in
 * `src/types/circuit.ts` — SOLV owns that file and it remains the runtime
 * source of truth for solver role derivation and wire endpoints. Keeping a
 * second, symbol-local copy makes each SVG asset self-describing (reviewable
 * on its own, and usable to preview a symbol before it's wired into
 * `library.ts`), at the cost of needing to stay in sync by hand. A parity
 * test (`tests/symbols/symbolRegistry.test.ts`) asserts the two agree for
 * every migrated type so drift fails CI instead of silently producing a
 * "dead" component (the exact failure mode called out in the roadmap's
 * SYM ↔ SOLV integration note).
 */
export interface SymbolPinDef {
  id: string
  x: number
  y: number
  kind: PinKind
}

/**
 * Maps runtime state to the layer id(s) that should be visible:
 * - `base`: always rendered.
 * - `energized`: overlaid additionally when the component is "live"
 *   (coil energized / lamp lit / motor running — the same OR the existing
 *   `ComponentSymbol` used for its amber stroke).
 * - `contacts`: for a component with `ComponentDefinition.contacts`, one
 *   entry per segment keyed `"<pinA>-<pinB>"` (segment.pins.join('-')),
 *   naming the layer id to show when that segment is open vs. closed.
 *   Segments not listed here (e.g. a future component with contacts but no
 *   drawn blade) simply have no visual toggle — everything about a segment
 *   still functions electrically via `ComponentDefinition.contacts`
 *   regardless of whether a layer is declared for it.
 */
export interface SymbolStateLayers {
  base: string
  energized?: string
  contacts?: Record<string, { open: string; closed: string }>
}

export interface SymbolDefinition {
  /** Matches `ComponentDefinition.type` in library.ts. */
  id: string
  standard: 'IEC 60617'
  viewBox: ViewBox
  pins: SymbolPinDef[]
  layers: SymbolLayer[]
  stateLayers: SymbolStateLayers
}

/** Looks up a named layer's paths, or an empty array if the id is absent (defensive — a missing layer renders nothing, never throws, so a typo in `stateLayers` degrades gracefully instead of crashing the canvas). */
export function layerPaths(def: SymbolDefinition, layerId: string | undefined): SymbolPathDef[] {
  if (!layerId) return []
  return def.layers.find((l) => l.id === layerId)?.paths ?? []
}
