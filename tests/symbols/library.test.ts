import { describe, expect, it } from 'vitest'
import { DEFAULT_LAMP_COLOR, LAMP_COLORS, resolveLampColor } from '@/components/symbols/library'

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
