import { describe, expect, it } from 'vitest'
import { DEFAULT_LAMP_COLOR, LAMP_COLORS, resolveLampColor, COMPONENT_LIBRARY } from '@/components/symbols/library'

describe('resolveLampColor', () => {
  it.each(Object.keys(LAMP_COLORS))('resolves a valid IEC color name (%s)', (color) => {
    expect(resolveLampColor(color)).toBe(LAMP_COLORS[color as keyof typeof LAMP_COLORS])
  })

  it('falls back to the default color for unset/undefined', () => {
    expect(resolveLampColor(undefined)).toBe(LAMP_COLORS[DEFAULT_LAMP_COLOR])
  })

  it('falls back to the default color for an unrecognized value (never throws)', () => {
    expect(resolveLampColor('mauve')).toBe(LAMP_COLORS[DEFAULT_LAMP_COLOR])
    expect(resolveLampColor(42)).toBe(LAMP_COLORS[DEFAULT_LAMP_COLOR])
    expect(resolveLampColor(null)).toBe(LAMP_COLORS[DEFAULT_LAMP_COLOR])
  })
})

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
