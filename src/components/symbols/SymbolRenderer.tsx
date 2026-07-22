import { Fragment } from 'react'
import { Group, Path, Rect } from 'react-konva'
import type { SymbolDefinition, SymbolPathDef } from '@/components/symbols/schema'
import { layerPaths } from '@/components/symbols/schema'

interface SymbolRendererProps {
  def: SymbolDefinition
  /** Target footprint in px — `ComponentDefinition.width/height` from library.ts at rotation 0. */
  width: number
  height: number
  /** Substituted for any path's literal `"currentColor"` fill/stroke (see schema.ts doc comment). */
  statusColor: string
  /** True when the component is "live" (coil energized / lamp lit / motor running). */
  energized: boolean
  /** Per contact-segment key (`"<pinA>-<pinB>"`), whether that segment is currently closed. Segments absent from `def.stateLayers.contacts` are ignored — nothing to swap for them. */
  contactClosed?: Record<string, boolean>
  /** Fill for the invisible full-footprint hit/background rect (mirrors the old hand-drawn Rect's body fill, e.g. darkens while a pushbutton is held). */
  bodyFill?: string
}

function resolveColor(value: string | undefined, statusColor: string): string | undefined {
  return value === 'currentColor' ? statusColor : value
}

function renderPath(path: SymbolPathDef, index: number, statusColor: string) {
  return (
    <Path
      key={index}
      data={path.d}
      fill={resolveColor(path.fill, statusColor)}
      stroke={resolveColor(path.stroke, statusColor)}
      strokeWidth={path.strokeWidth ?? 1}
      fillRule={path.fillRule}
      lineCap={path.lineCap}
      lineJoin={path.lineJoin}
      dash={path.dash}
      opacity={path.opacity}
      listening={false}
    />
  )
}

/**
 * Renders one parsed `SymbolDefinition` as a stack of `Konva.Path`s — the
 * SVG→Konva half of the pipeline. Every authored path is drawn verbatim
 * (no rasterization, no re-tessellation), so the symbol stays crisp from
 * 0.1× to 10× zoom: Konva.Path re-strokes the same vector `d` string at
 * whatever the current Layer/Stage scale is, exactly like a browser
 * re-rasterizing an `<svg>` on zoom.
 *
 * Layer selection per render:
 * - `base` layer: always drawn.
 * - `energized` layer: drawn additionally when `energized` is true.
 * - each `stateLayers.contacts[key]` entry: draws its `closed` variant when
 *   `contactClosed[key]` is true, else its `open` variant (defaults to
 *   open/false for a segment with no runtime state yet — e.g. before the
 *   first simulation tick).
 */
export function SymbolRenderer({
  def,
  width,
  height,
  statusColor,
  energized,
  contactClosed,
  bodyFill,
}: SymbolRendererProps) {
  const [, , vbWidth, vbHeight] = def.viewBox
  const scaleX = vbWidth === 0 ? 1 : width / vbWidth
  const scaleY = vbHeight === 0 ? 1 : height / vbHeight

  const activeLayerIds: string[] = [def.stateLayers.base]
  if (energized && def.stateLayers.energized) activeLayerIds.push(def.stateLayers.energized)
  for (const [key, variants] of Object.entries(def.stateLayers.contacts ?? {})) {
    const closed = contactClosed?.[key] ?? false
    activeLayerIds.push(closed ? variants.closed : variants.open)
  }

  return (
    <Group>
      {/* Transparent full-footprint hit target — keeps "click/drag anywhere in the bounding box" parity with the previous hand-drawn Rect body, regardless of how little ink a given symbol's artwork covers (e.g. the motor's circle leaves its corners empty). */}
      <Rect width={width} height={height} fill={bodyFill ?? 'transparent'} />
      <Group scaleX={scaleX} scaleY={scaleY}>
        {activeLayerIds.map((layerId) => (
          <Fragment key={layerId}>
            {layerPaths(def, layerId).map((path, i) => renderPath(path, i, statusColor))}
          </Fragment>
        ))}
      </Group>
    </Group>
  )
}
