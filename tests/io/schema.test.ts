import { describe, expect, it } from 'vitest'
import { emptyZcadeFile, validateZcadeFile, ZCADE_VERSION } from '@/io/schema'

describe('validateZcadeFile', () => {
  it('accepts a freshly-generated empty project', () => {
    const result = validateZcadeFile(emptyZcadeFile())
    expect(result.ok).toBe(true)
  })

  it('rejects a non-object', () => {
    expect(validateZcadeFile(null).ok).toBe(false)
    expect(validateZcadeFile('a string').ok).toBe(false)
    expect(validateZcadeFile([1, 2, 3]).ok).toBe(false)
  })

  it('rejects a missing/invalid version', () => {
    const file = emptyZcadeFile() as unknown as Record<string, unknown>
    delete file.version
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/version/i)
  })

  it('rejects an unsupported major version', () => {
    const file = { ...emptyZcadeFile(), version: '9.0.0' }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unsupported/i)
  })

  it('accepts a same-major, different-minor/patch version', () => {
    const file = { ...emptyZcadeFile(), version: '1.4.2' }
    expect(validateZcadeFile(file).ok).toBe(true)
  })

  it('rejects a malformed meta object', () => {
    const file = { ...emptyZcadeFile(), meta: { title: 'ok' } }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
  })

  it('rejects a component with an unknown type', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        {
          id: 'c1',
          type: 'not_a_real_component',
          label: 'X',
          x: 0,
          y: 0,
          rotation: 0,
          properties: {},
        },
      ],
    }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown component type/i)
  })

  it('rejects a component with a bad rotation', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 45, properties: {} },
      ],
    }
    expect(validateZcadeFile(file).ok).toBe(false)
  })

  it('rejects duplicate component ids', () => {
    const component = {
      id: 'dup',
      type: 'lamp',
      label: 'H1',
      x: 0,
      y: 0,
      rotation: 0 as const,
      properties: {},
    }
    const file = { ...emptyZcadeFile(), components: [component, { ...component }] }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/duplicate component/i)
  })

  it('rejects a wire referencing a component id that does not exist', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '1' },
          to: { componentId: 'ghost', pinId: '2' },
        },
      ],
    }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown component "ghost"/i)
  })

  it('rejects duplicate wire ids', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
        { id: 'c2', type: 'lamp', label: 'H2', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '1' },
          to: { componentId: 'c2', pinId: '1' },
        },
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '2' },
          to: { componentId: 'c2', pinId: '2' },
        },
      ],
    }
    const result = validateZcadeFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/duplicate wire/i)
  })

  it('rejects an invalid wireType', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
        { id: 'c2', type: 'lamp', label: 'H2', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '1' },
          to: { componentId: 'c2', pinId: '1' },
          wireType: 'not_a_wire_type',
        },
      ],
    }
    expect(validateZcadeFile(file).ok).toBe(false)
  })

  it('accepts a wire with an explicit points override (ROUTE waypoint field)', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
        { id: 'c2', type: 'lamp', label: 'H2', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '1' },
          to: { componentId: 'c2', pinId: '1' },
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 30 },
          ],
          wireType: 'L1',
        },
      ],
    }
    expect(validateZcadeFile(file).ok).toBe(true)
  })

  it('rejects malformed points entries', () => {
    const file = {
      ...emptyZcadeFile(),
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
        { id: 'c2', type: 'lamp', label: 'H2', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'c1', pinId: '1' },
          to: { componentId: 'c2', pinId: '1' },
          points: [{ x: 'oops', y: 1 }],
        },
      ],
    }
    expect(validateZcadeFile(file).ok).toBe(false)
  })

  it('rejects wires/components that are not arrays', () => {
    expect(validateZcadeFile({ ...emptyZcadeFile(), components: 'nope' }).ok).toBe(false)
    expect(validateZcadeFile({ ...emptyZcadeFile(), wires: 'nope' }).ok).toBe(false)
  })

  it('defaults plcPrograms to {} when absent, and rejects it when present but not an object', () => {
    const withoutPlc = emptyZcadeFile() as unknown as Record<string, unknown>
    delete withoutPlc.plcPrograms
    const result = validateZcadeFile(withoutPlc)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.file.plcPrograms).toEqual({})

    expect(validateZcadeFile({ ...emptyZcadeFile(), plcPrograms: 'nope' }).ok).toBe(false)
  })

  it('exposes the current schema version constant', () => {
    expect(ZCADE_VERSION).toBe('1.0.0')
  })
})
