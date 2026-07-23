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

/**
 * Phase A Week 2 (SYM) additions: real art for the 6 SOLV-frozen placeholder
 * types (Part 1) plus 3 new trivial library.ts entries (Part 2). Kept as a
 * separate list from `MIGRATED_TYPES` above so the Week 1 count assertion
 * stays a precise historical record; `ALL_TYPES` below is what every other
 * parity check in this file actually iterates.
 */
const WEEK2_TYPES = [
  'emergency_stop',
  'aux_contact_block_no',
  'aux_contact_block_nc',
  'thermal_overload_relay',
  'timer_ton',
  'motor_3p_6wire',
  'contactor_4p',
  'power_source_1p',
  'terminal_strip',
]

const ALL_TYPES = [...MIGRATED_TYPES, ...WEEK2_TYPES]

describe('symbolRegistry', () => {
  it('registers exactly the 8 Tier 1 + 9 Week 2 symbols authored so far', () => {
    expect(listSymbolTypes().sort()).toEqual([...ALL_TYPES].sort())
  })

  it.each(ALL_TYPES)('%s: symbol viewBox matches the library component footprint', (type) => {
    const symbolDef = getSymbolDefinition(type)
    const componentDef = COMPONENT_LIBRARY[type]
    expect(symbolDef).toBeDefined()
    expect(symbolDef!.viewBox).toEqual([0, 0, componentDef.width, componentDef.height])
  })

  it.each(ALL_TYPES)(
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

  it.each(ALL_TYPES)(
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
