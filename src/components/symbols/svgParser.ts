import type { PinKind } from '@/types/circuit'
import type {
  SymbolDefinition,
  SymbolLayer,
  SymbolPathDef,
  SymbolPinDef,
  ViewBox,
} from '@/components/symbols/schema'

/**
 * Parses one authored symbol SVG (raw file text, e.g. from a Vite `?raw`
 * import) into a `SymbolDefinition`.
 *
 * Deliberately supports ONLY `<path>` elements for body geometry — no
 * `<rect>`/`<circle>`/`<line>` shape primitives. This is a hard constraint,
 * not an oversight: the roadmap's pipeline requirement is "SVGs parsed at
 * build time into path data, rendered as Konva.Path (vector-crisp at any
 * zoom, no rasterization)". Supporting only paths means the parser never
 * needs to convert shape primitives into path data itself (no arc-to-bezier
 * math, no rect-to-path corner logic duplicated from the SVG spec) — every
 * authored `d` string is used completely verbatim by Konva.Path, so the
 * canvas render is byte-for-byte the same geometry a browser would draw for
 * the source SVG. Authors draw circles/rects as short `d` strings (see
 * schema.md for the small cheat-sheet of primitives-as-paths used by the
 * Tier 1 set).
 */
export function parseSymbolSvg(id: string, raw: string): SymbolDefinition {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error(`Symbol "${id}": failed to parse SVG — ${parserError.textContent}`)
  }

  const root = doc.documentElement
  const viewBox = parseViewBox(id, root.getAttribute('viewBox'))

  const layers: SymbolLayer[] = []
  for (const g of Array.from(root.querySelectorAll('g[id^="layer:"]'))) {
    const layerId = g.getAttribute('id')!.slice('layer:'.length)
    const paths = Array.from(g.querySelectorAll('path')).map(parsePathElement)
    layers.push({ id: layerId, paths })
  }

  const pins: SymbolPinDef[] = []
  const pinsGroup = root.querySelector('g#pins')
  if (pinsGroup) {
    for (const marker of Array.from(pinsGroup.querySelectorAll('circle'))) {
      const pinId = marker.getAttribute('data-pin-id')
      const kind = marker.getAttribute('data-pin-kind') as PinKind | null
      if (!pinId || !kind) {
        throw new Error(`Symbol "${id}": pin marker missing data-pin-id/data-pin-kind`)
      }
      pins.push({
        id: pinId,
        kind,
        x: Number(marker.getAttribute('cx') ?? 0),
        y: Number(marker.getAttribute('cy') ?? 0),
      })
    }
  }

  return {
    id,
    standard: 'IEC 60617',
    viewBox,
    pins,
    layers,
    stateLayers: parseStateLayers(root, layers),
  }
}

function parseViewBox(id: string, attr: string | null): ViewBox {
  if (!attr) throw new Error(`Symbol "${id}": missing viewBox attribute`)
  const parts = attr.trim().split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`Symbol "${id}": malformed viewBox "${attr}"`)
  }
  return parts as ViewBox
}

function parsePathElement(el: Element): SymbolPathDef {
  const d = el.getAttribute('d')
  if (!d) throw new Error('Symbol path element missing "d" attribute')
  const strokeWidth = el.getAttribute('stroke-width')
  const dash = el.getAttribute('stroke-dasharray')
  const opacity = el.getAttribute('opacity')
  return {
    d,
    fill: el.getAttribute('fill') ?? undefined,
    stroke: el.getAttribute('stroke') ?? undefined,
    strokeWidth: strokeWidth ? Number(strokeWidth) : undefined,
    fillRule: (el.getAttribute('fill-rule') as 'nonzero' | 'evenodd' | null) ?? undefined,
    lineCap: (el.getAttribute('stroke-linecap') as 'butt' | 'round' | 'square' | null) ?? undefined,
    lineJoin:
      (el.getAttribute('stroke-linejoin') as 'round' | 'bevel' | 'miter' | null) ?? undefined,
    dash: dash ? dash.split(/[,\s]+/).map(Number) : undefined,
    opacity: opacity ? Number(opacity) : undefined,
  }
}

/**
 * Reads the optional `<metadata id="stateLayers">` JSON blob authored in the
 * SVG (see schema.md) declaring which layer ids are `base`/`energized`/per-
 * contact open-close pairs. If absent, falls back to the convention "a
 * layer literally named `base` is the base layer, `energized` is the
 * energized overlay if present" — so a minimal symbol with just those two
 * layer names needs no metadata block at all.
 */
function parseStateLayers(root: Element, layers: SymbolLayer[]): SymbolDefinition['stateLayers'] {
  const metadataEl = root.querySelector('metadata#stateLayers')
  if (metadataEl?.textContent?.trim()) {
    try {
      return JSON.parse(metadataEl.textContent) as SymbolDefinition['stateLayers']
    } catch (err) {
      throw new Error(
        `Symbol: malformed <metadata id="stateLayers"> JSON — ${(err as Error).message}`,
        { cause: err },
      )
    }
  }
  const ids = new Set(layers.map((l) => l.id))
  return {
    base: ids.has('base') ? 'base' : (layers[0]?.id ?? 'base'),
    energized: ids.has('energized') ? 'energized' : undefined,
  }
}
