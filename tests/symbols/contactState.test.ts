import { describe, expect, it } from 'vitest'
import { isContactClosed } from '@/components/symbols/contactState'
import type { ContactSegment } from '@/types/circuit'
import type { ComponentRuntimeState } from '@/engine/solver'

function segment(
  behavior: ContactSegment['behavior'],
  control?: ContactSegment['control'],
): ContactSegment {
  return { pins: ['a', 'b'], behavior, control }
}

describe('isContactClosed', () => {
  it('always_closed is closed regardless of state', () => {
    expect(isContactClosed(segment('always_closed'), undefined)).toBe(true)
    expect(isContactClosed(segment('always_closed'), {})).toBe(true)
  })

  it('control: pressed — NO closes while pressed, NC opens while pressed', () => {
    const pressed: ComponentRuntimeState = { pressed: true }
    const idle: ComponentRuntimeState = { pressed: false }
    expect(isContactClosed(segment('no', 'pressed'), pressed)).toBe(true)
    expect(isContactClosed(segment('no', 'pressed'), idle)).toBe(false)
    expect(isContactClosed(segment('nc', 'pressed'), pressed)).toBe(false)
    expect(isContactClosed(segment('nc', 'pressed'), idle)).toBe(true)
  })

  it('control: coil (and the untagged default) follows coilEnergized', () => {
    const energized: ComponentRuntimeState = { coilEnergized: true }
    const deenergized: ComponentRuntimeState = { coilEnergized: false }
    expect(isContactClosed(segment('no', 'coil'), energized)).toBe(true)
    expect(isContactClosed(segment('no', 'coil'), deenergized)).toBe(false)
    expect(isContactClosed(segment('nc', 'coil'), energized)).toBe(false)
    expect(isContactClosed(segment('no', undefined), energized)).toBe(true)
  })

  it('control: tripped — a thermal relay with no coil pins does not fall back to coilEnergized', () => {
    const tripped: ComponentRuntimeState = { tripped: true, coilEnergized: undefined }
    const notTripped: ComponentRuntimeState = { tripped: false }
    // 95-96 style: NC, opens on trip.
    expect(isContactClosed(segment('nc', 'tripped'), notTripped)).toBe(true)
    expect(isContactClosed(segment('nc', 'tripped'), tripped)).toBe(false)
    // 97-98 style: NO, closes on trip (drives a fault lamp).
    expect(isContactClosed(segment('no', 'tripped'), notTripped)).toBe(false)
    expect(isContactClosed(segment('no', 'tripped'), tripped)).toBe(true)
  })

  it('control: latched — an emergency stop with no coil pins does not fall back to coilEnergized', () => {
    const latched: ComponentRuntimeState = { latched: true }
    const notLatched: ComponentRuntimeState = { latched: false }
    expect(isContactClosed(segment('nc', 'latched'), notLatched)).toBe(true)
    expect(isContactClosed(segment('nc', 'latched'), latched)).toBe(false)
  })

  it('control: timed — a TON timer contact does not fall back to coilEnergized', () => {
    const active: ComponentRuntimeState = { timedActive: true, coilEnergized: true }
    const inactive: ComponentRuntimeState = { timedActive: false, coilEnergized: true }
    // 55-56 style: NO, closes once the preset elapses.
    expect(isContactClosed(segment('no', 'timed'), inactive)).toBe(false)
    expect(isContactClosed(segment('no', 'timed'), active)).toBe(true)
    // 57-58 style: NC, opens once the preset elapses.
    expect(isContactClosed(segment('nc', 'timed'), inactive)).toBe(true)
    expect(isContactClosed(segment('nc', 'timed'), active)).toBe(false)
  })

  it('undefined runtime state (before the first tick) defaults every control kind to inactive', () => {
    expect(isContactClosed(segment('no', 'coil'), undefined)).toBe(false)
    expect(isContactClosed(segment('nc', 'coil'), undefined)).toBe(true)
    expect(isContactClosed(segment('no', 'tripped'), undefined)).toBe(false)
    expect(isContactClosed(segment('nc', 'tripped'), undefined)).toBe(true)
    expect(isContactClosed(segment('no', 'latched'), undefined)).toBe(false)
    expect(isContactClosed(segment('no', 'timed'), undefined)).toBe(false)
  })
})
