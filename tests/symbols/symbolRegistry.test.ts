import { describe, expect, it } from 'vitest'
import { getSymbolDefinition, listSymbolTypes } from '@/components/symbols/symbolRegistry'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'

const MIGRATED_TYPES = [
  'power_source_3p',
  'power_source_dc',
  'circuit_breaker_3p',
  'contactor_3p',
  'push_button_no',
  'push_button_nc',
  'motor_3p',
  'lamp',
]

describe('symbolRegistry', () => {
  it('registers exactly the 8 Tier 1 symbols migrated this phase', () => {
    expect(listSymbolTypes().sort()).toEqual([...MIGRATED_TYPES].sort())
  })

  it.each(MIGRATED_TYPES)('%s: symbol viewBox matches the library component footprint', (type) => {
    const symbolDef = getSymbolDefinition(type)
    const componentDef = COMPONENT_LIBRARY[type]
    expect(symbolDef).toBeDefined()
    expect(symbolDef!.viewBox).toEqual([0, 0, componentDef.width, componentDef.height])
  })

  it.each(MIGRATED_TYPES)(
    '%s: symbol pins match library.ts pin id/position/kind exactly (no drift)',
    (type) => {
      const symbolDef = getSymbolDefinition(type)!
      const componentDef = COMPONENT_LIBRARY[type]

      const fromSymbol = [...symbolDef.pins].sort((a, b) => a.id.localeCompare(b.id))
      const fromLibrary = componentDef.pins
        .map((p) => ({ id: p.id, kind: p.kind, x: p.offset.x, y: p.offset.y }))
        .sort((a, b) => a.id.localeCompare(b.id))

      expect(fromSymbol).toEqual(fromLibrary)
    },
  )

  it.each(MIGRATED_TYPES)(
    '%s: every declared contact segment has a matching base/energized-or-contact layer set',
    (type) => {
      const symbolDef = getSymbolDefinition(type)!
      const componentDef = COMPONENT_LIBRARY[type]

      // The base layer must always resolve to a real, non-empty layer id.
      expect(symbolDef.layers.some((l) => l.id === symbolDef.stateLayers.base)).toBe(true)

      for (const segment of componentDef.contacts ?? []) {
        const key = segment.pins.join('-')
        if (segment.behavior === 'always_closed') continue // no toggle to draw
        const variants = symbolDef.stateLayers.contacts?.[key]
        expect(variants, `missing stateLayers.contacts["${key}"] for ${type}`).toBeDefined()
        expect(symbolDef.layers.some((l) => l.id === variants!.open)).toBe(true)
        expect(symbolDef.layers.some((l) => l.id === variants!.closed)).toBe(true)
      }
    },
  )

  it('returns undefined for an unregistered component type', () => {
    expect(getSymbolDefinition('does_not_exist')).toBeUndefined()
  })
})
