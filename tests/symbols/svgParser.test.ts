import { describe, expect, it } from 'vitest'
import { parseSymbolSvg } from '@/components/symbols/svgParser'
import { layerPaths } from '@/components/symbols/schema'

describe('parseSymbolSvg', () => {
  it('parses viewBox, layers, paths and pin markers', () => {
    const raw = `<svg viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg">
      <g id="layer:base">
        <path d="M0,10 L14,10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M14,7 L14,13" stroke="#22c55e" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3,2" opacity="0.5"/>
      </g>
      <g id="layer:extra">
        <path d="M0,0 L1,1"/>
      </g>
      <g id="pins">
        <circle data-pin-id="13" data-pin-kind="auxiliary_no" cx="0" cy="10" r="1"/>
        <circle data-pin-id="14" data-pin-kind="auxiliary_no" cx="40" cy="10" r="1"/>
      </g>
    </svg>`

    const def = parseSymbolSvg('test_symbol', raw)

    expect(def.id).toBe('test_symbol')
    expect(def.standard).toBe('IEC 60617')
    expect(def.viewBox).toEqual([0, 0, 40, 20])

    expect(def.pins).toEqual([
      { id: '13', kind: 'auxiliary_no', x: 0, y: 10 },
      { id: '14', kind: 'auxiliary_no', x: 40, y: 10 },
    ])

    expect(def.layers.map((l) => l.id).sort()).toEqual(['base', 'extra'])

    const basePaths = layerPaths(def, 'base')
    expect(basePaths).toHaveLength(2)
    expect(basePaths[0]).toMatchObject({
      d: 'M0,10 L14,10',
      stroke: 'currentColor',
      strokeWidth: 1.5,
    })
    expect(basePaths[1]).toMatchObject({
      d: 'M14,7 L14,13',
      stroke: '#22c55e',
      fill: 'none',
      fillRule: 'evenodd',
      lineCap: 'round',
      lineJoin: 'round',
      dash: [3, 2],
      opacity: 0.5,
    })
  })

  it('defaults stateLayers to base/energized-by-name when no <metadata> block is present', () => {
    const raw = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <g id="layer:base"><path d="M0,0 L1,1"/></g>
      <g id="layer:energized"><path d="M0,0 L2,2"/></g>
    </svg>`
    const def = parseSymbolSvg('minimal', raw)
    expect(def.stateLayers).toEqual({ base: 'base', energized: 'energized' })
  })

  it('reads an explicit <metadata id="stateLayers"> block, including contact variants', () => {
    const raw = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <g id="layer:base"><path d="M0,0 L1,1"/></g>
      <g id="layer:contact-1-2-open"><path d="M0,0 L1,1"/></g>
      <g id="layer:contact-1-2-closed"><path d="M0,0 L1,1"/></g>
      <metadata id="stateLayers">
        { "base": "base", "contacts": { "1-2": { "open": "contact-1-2-open", "closed": "contact-1-2-closed" } } }
      </metadata>
    </svg>`
    const def = parseSymbolSvg('with_contacts', raw)
    expect(def.stateLayers.contacts).toEqual({
      '1-2': { open: 'contact-1-2-open', closed: 'contact-1-2-closed' },
    })
  })

  it('throws a descriptive error for a missing viewBox', () => {
    expect(() => parseSymbolSvg('bad', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrow(
      /viewBox/,
    )
  })

  it('throws for a pin marker missing data-pin-id/data-pin-kind', () => {
    const raw = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <g id="pins"><circle cx="0" cy="0" r="1"/></g>
    </svg>`
    expect(() => parseSymbolSvg('bad-pin', raw)).toThrow(/pin marker/)
  })

  it('throws for a path element missing the d attribute', () => {
    const raw = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <g id="layer:base"><path stroke="red"/></g>
    </svg>`
    expect(() => parseSymbolSvg('bad-path', raw)).toThrow(/"d" attribute/)
  })

  it('layerPaths returns an empty array for an absent or undefined layer id', () => {
    const raw = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><g id="layer:base"><path d="M0,0 L1,1"/></g></svg>`
    const def = parseSymbolSvg('x', raw)
    expect(layerPaths(def, 'nonexistent')).toEqual([])
    expect(layerPaths(def, undefined)).toEqual([])
  })
})
