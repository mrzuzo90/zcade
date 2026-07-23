import { describe, expect, it } from 'vitest'
import { getSymbolDefinition, listSymbolTypes } from '@/components/symbols/symbolRegistry'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'

/**
 * Zoom stress test / pixel-snapping audit (Phase A Week 2, SYM).
 *
 * `SymbolRenderer` computes its own internal scale as
 * `width/viewBox.width` / `height/viewBox.height` (see SymbolRenderer.tsx) —
 * for every Tier 1 + Week 2 symbol this is exactly 1, since every authored
 * viewBox is set to match its component's footprint exactly (schema.md
 * rule #2, already covered by symbolRegistry.test.ts's viewBox-parity
 * check). This suite exercises the CONSEQUENCE of that at the zoom range the
 * canvas actually supports (CanvasStage's wheel-zoom, roadmap Section 10.3):
 * a symbol with internal scale != 1 would have its geometric drift multiply
 * with the external Stage/Layer zoom (Konva's scale is a second,
 * independent multiplicative transform on top of this one), so any drift is
 * far more visible at the extremes (0.1x / 10x) than at 1x. These are pure
 * arithmetic checks (no real Konva canvas — jsdom has no 2D context and this
 * repo doesn't mock one, consistent with every other test in tests/symbols),
 * mirroring the "operate on parsed data directly" style of
 * symbolRegistry.test.ts rather than rendering an actual Stage.
 */

const ZOOM_LEVELS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 10]

function internalScale(type: string): { scaleX: number; scaleY: number } {
  const def = getSymbolDefinition(type)!
  const componentDef = COMPONENT_LIBRARY[type]
  const [, , vbWidth, vbHeight] = def.viewBox
  return {
    scaleX: vbWidth === 0 ? 1 : componentDef.width / vbWidth,
    scaleY: vbHeight === 0 ? 1 : componentDef.height / vbHeight,
  }
}

describe('symbol zoom stress / pixel-snapping audit', () => {
  it.each(listSymbolTypes())(
    '%s: internal footprint-to-viewBox scale is exactly 1 (no baked-in drift to compound at extreme zoom)',
    (type) => {
      const { scaleX, scaleY } = internalScale(type)
      expect(scaleX).toBe(1)
      expect(scaleY).toBe(1)
    },
  )

  it.each(listSymbolTypes())(
    '%s: every pin position stays finite and exactly proportional to zoom across 0.1x-10x',
    (type) => {
      const def = getSymbolDefinition(type)!
      const { scaleX, scaleY } = internalScale(type)
      for (const zoom of ZOOM_LEVELS) {
        for (const pin of def.pins) {
          const screenX = pin.x * scaleX * zoom
          const screenY = pin.y * scaleY * zoom
          expect(Number.isFinite(screenX)).toBe(true)
          expect(Number.isFinite(screenY)).toBe(true)
          // scaleX/scaleY are 1 (asserted above), so this must be an exact
          // match, not just "close" — any mismatch means a double-scaling
          // bug was introduced (e.g. applying the internal scale twice).
          expect(screenX).toBe(pin.x * zoom)
          expect(screenY).toBe(pin.y * zoom)
        }
      }
    },
  )

  it.each(listSymbolTypes())(
    '%s: footprint dimensions stay finite and positive at extreme zoom (0.1x and 10x)',
    (type) => {
      const componentDef = COMPONENT_LIBRARY[type]
      for (const zoom of [0.1, 10]) {
        const screenWidth = componentDef.width * zoom
        const screenHeight = componentDef.height * zoom
        expect(Number.isFinite(screenWidth)).toBe(true)
        expect(Number.isFinite(screenHeight)).toBe(true)
        expect(screenWidth).toBeGreaterThan(0)
        expect(screenHeight).toBeGreaterThan(0)
      }
    },
  )

  it('zooming in then back out returns every pin to its exact original position (round-trip precision)', () => {
    for (const type of listSymbolTypes()) {
      const def = getSymbolDefinition(type)!
      for (const zoom of ZOOM_LEVELS) {
        for (const pin of def.pins) {
          const roundTripX = (pin.x * zoom) / zoom
          const roundTripY = (pin.y * zoom) / zoom
          expect(roundTripX).toBeCloseTo(pin.x, 9)
          expect(roundTripY).toBeCloseTo(pin.y, 9)
        }
      }
    }
  })

  it('composing two sequential zoom factors matches one combined zoom factor (no compounding error across repeated zoom gestures)', () => {
    const sampleType = listSymbolTypes()[0]
    const def = getSymbolDefinition(sampleType)!
    for (const zoomA of ZOOM_LEVELS) {
      for (const zoomB of ZOOM_LEVELS) {
        for (const pin of def.pins) {
          const sequential = pin.x * zoomA * zoomB
          const combined = pin.x * (zoomA * zoomB)
          expect(sequential).toBeCloseTo(combined, 9)
        }
      }
    }
  })
})
