import { describe, expect, it } from 'vitest'
import { getSymbolDefinition, listSymbolTypes } from '@/components/symbols/symbolRegistry'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'

/**
 * The full registered symbol set. Week 1/Week 2's MIGRATED_TYPES/WEEK2_TYPES
 * split was collapsed into this single authoritative list during the unifilar
 * symbol integration (2026-07-25), which appends the 52 single-line symbols
 * category by category below.
 */
const ALL_TYPES = [
  // Tier 1 (Week 1) + Week 2 SYM/SOLV set
  'power_source_3p',
  'power_source_dc',
  'power_source_1p',
  'circuit_breaker_3p',
  'contactor_3p',
  'contactor_4p',
  'push_button_no',
  'push_button_nc',
  'motor_3p',
  'motor_3p_6wire',
  'lamp',
  'emergency_stop',
  'aux_contact_block_no',
  'aux_contact_block_nc',
  'thermal_overload_relay',
  'timer_ton',
  'terminal_strip',
  // Unifilar — protecciones
  'bt_seccionador',
  'bt_interruptor_seccionador',
  'bt_fusible',
  'bt_fusible_seccionable',
  'bt_interruptor_diferencial',
  'bt_interruptor_automatico_rele',
  'bt_interruptor_temporizador',
  'bt_protector_sobretensiones',
  'protecciones_rele_27_tension_minima',
  'protecciones_rele_57_cortocircuito',
  'protecciones_rele_59_tension_maxima',
  'protecciones_rele_59n_tension_maxima_homopolar',
  'protecciones_rele_64_fallo_tierra',
  'protecciones_rele_81_frecuencia',
  'protecciones_rele_87_diferencial',
  // Unifilar — líneas y embarrados
  'bt_embarrado',
  'bt_linea_monofasica',
  'bt_linea_trifasica_f',
  'bt_linea_trifasica_fn',
  'bt_linea_trifasica_fnt',
  'bt_linea_cc',
  'bt_linea_cc_tierra',
  // Unifilar — fuentes + máquinas
  'bt_generador_ca',
  'bt_bateria_almacenamiento',
  'bt_modulos_fotovoltaicos',
  'bt_bateria_condensadores',
  'bt_transformador',
  'bt_inversor',
  'bt_regulador_cc',
  // Unifilar — medida
  'bt_medidor_directo',
  'bt_medidor_indirecto',
  'bt_vatimetro_directo',
  'bt_vatimetro_indirecto',
  'bt_indicador',
  'bt_sumador_intensidades',
]

describe('symbolRegistry', () => {
  it('registers exactly the authored symbol set (library ↔ SVG parity)', () => {
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
