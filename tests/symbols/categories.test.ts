import { describe, expect, it } from 'vitest'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'
import { PALETTE_CATEGORIES, CATEGORY_BY_TYPE, categoryForType } from '@/components/symbols/categories'

describe('palette categories', () => {
  it('every library type has a category mapping', () => {
    for (const type of Object.keys(COMPONENT_LIBRARY)) {
      expect(CATEGORY_BY_TYPE[type], `missing category for ${type}`).toBeDefined()
    }
  })
  it('every mapped category id is a declared palette category', () => {
    const ids = new Set(PALETTE_CATEGORIES.map((c) => c.id))
    for (const cat of Object.values(CATEGORY_BY_TYPE)) expect(ids.has(cat)).toBe(true)
  })
  it('categoryForType falls back to a real category for unknown types', () => {
    expect(PALETTE_CATEGORIES.some((c) => c.id === categoryForType('nonexistent'))).toBe(true)
  })
})
