import { describe, expect, it } from 'vitest'
import type { ComponentInstance, Wire } from '@/types/circuit'
import { evaluateCircuit, type ComponentRuntimeState } from '@/engine/solver'

function instance(overrides: Partial<ComponentInstance> & Pick<ComponentInstance, 'id' | 'type' | 'x' | 'y'>): ComponentInstance {
  return { label: '', rotation: 0, properties: {}, ...overrides }
}

function withPressed(
  states: Record<string, ComponentRuntimeState>,
  id: string,
  pressed: boolean,
): Record<string, ComponentRuntimeState> {
  return { ...states, [id]: { ...states[id], pressed } }
}

describe('evaluateCircuit — loads', () => {
  it('lights a lamp wired directly across a DC source', () => {
    const components: Record<string, ComponentInstance> = {
      src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
      lamp: instance({ id: 'lamp', type: 'lamp', x: 100, y: 0 }),
    }
    const wires: Wire[] = [
      { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'lamp', pinId: '1' } },
      { id: 'w2', from: { componentId: 'src', pinId: '0V' }, to: { componentId: 'lamp', pinId: '2' } },
    ]
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.lamp.lit).toBe(true)
  })

  it('does not light a lamp with one pin left floating', () => {
    const components: Record<string, ComponentInstance> = {
      src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
      lamp: instance({ id: 'lamp', type: 'lamp', x: 100, y: 0 }),
    }
    const wires: Wire[] = [{ id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'lamp', pinId: '1' } }]
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.lamp.lit).toBe(false)
  })

  it('does not light a lamp whose two pins are shorted to the same potential', () => {
    const components: Record<string, ComponentInstance> = {
      src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
      lamp: instance({ id: 'lamp', type: 'lamp', x: 100, y: 0 }),
    }
    const wires: Wire[] = [
      { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'lamp', pinId: '1' } },
      { id: 'w2', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'lamp', pinId: '2' } },
    ]
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.lamp.lit).toBe(false)
  })
})

describe('evaluateCircuit — contactor', () => {
  it('energizes a coil wired directly across a DC source and closes its NO power contacts, lighting a downstream lamp', () => {
    const components: Record<string, ComponentInstance> = {
      src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
      km: instance({ id: 'km', type: 'contactor_3p', x: 100, y: 0 }),
      lamp: instance({ id: 'lamp', type: 'lamp', x: 200, y: 0 }),
    }
    const wires: Wire[] = [
      { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'km', pinId: 'A1' } },
      { id: 'w2', from: { componentId: 'src', pinId: '0V' }, to: { componentId: 'km', pinId: 'A2' } },
      { id: 'w3', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'km', pinId: '1' } },
      { id: 'w4', from: { componentId: 'km', pinId: '2' }, to: { componentId: 'lamp', pinId: '1' } },
      { id: 'w5', from: { componentId: 'src', pinId: '0V' }, to: { componentId: 'lamp', pinId: '2' } },
    ]
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.km.coilEnergized).toBe(true)
    expect(componentStates.lamp.lit).toBe(true)
  })

  it('leaves the downstream lamp dark while the coil is de-energized', () => {
    const components: Record<string, ComponentInstance> = {
      src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
      km: instance({ id: 'km', type: 'contactor_3p', x: 100, y: 0 }),
      lamp: instance({ id: 'lamp', type: 'lamp', x: 200, y: 0 }),
    }
    const wires: Wire[] = [
      // Coil left unwired — never energizes.
      { id: 'w3', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'km', pinId: '1' } },
      { id: 'w4', from: { componentId: 'km', pinId: '2' }, to: { componentId: 'lamp', pinId: '1' } },
      { id: 'w5', from: { componentId: 'src', pinId: '0V' }, to: { componentId: 'lamp', pinId: '2' } },
    ]
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.km.coilEnergized).toBe(false)
    expect(componentStates.lamp.lit).toBe(false)
  })
})

describe('evaluateCircuit — seal-in (self-hold) control circuit', () => {
  // src.+24V -> stop(NC) -> [start(NO) in parallel with km's own NO contact 1-2] -> km.A1, km.A2 -> src.0V
  const components: Record<string, ComponentInstance> = {
    src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
    stop: instance({ id: 'stop', type: 'push_button_nc', x: 100, y: 0 }),
    start: instance({ id: 'start', type: 'push_button_no', x: 200, y: 0 }),
    km: instance({ id: 'km', type: 'contactor_3p', x: 300, y: 0 }),
  }
  const wires: Wire[] = [
    { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'stop', pinId: '21' } },
    { id: 'w2', from: { componentId: 'stop', pinId: '22' }, to: { componentId: 'start', pinId: '13' } },
    { id: 'w3', from: { componentId: 'stop', pinId: '22' }, to: { componentId: 'km', pinId: '1' } },
    { id: 'w4', from: { componentId: 'start', pinId: '14' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w5', from: { componentId: 'km', pinId: '2' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w6', from: { componentId: 'km', pinId: 'A2' }, to: { componentId: 'src', pinId: '0V' } },
  ]

  it('stays de-energized at idle', () => {
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.km.coilEnergized).toBe(false)
  })

  it('latches on when start is pressed, and stays latched after start is released', () => {
    let states: Record<string, ComponentRuntimeState> = {}

    states = evaluateCircuit(components, wires, states).componentStates
    states = withPressed(states, 'start', true)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)

    states = withPressed(states, 'start', false)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)

    // Stays latched over further ticks with nothing pressed.
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
  })

  it('drops out when stop is pressed, and requires start again afterward (does not self-restart)', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = evaluateCircuit(components, wires, states).componentStates
    states = withPressed(states, 'start', false)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)

    states = withPressed(states, 'stop', true)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)

    states = withPressed(states, 'stop', false)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)
  })
})

describe('evaluateCircuit — motor', () => {
  const components: Record<string, ComponentInstance> = {
    src: instance({ id: 'src', type: 'power_source_3p', x: 0, y: 0 }),
    q: instance({ id: 'q', type: 'circuit_breaker_3p', x: 100, y: 0 }),
    m: instance({ id: 'm', type: 'motor_3p', x: 200, y: 0 }),
  }

  function wiresFor(pairing: [string, string][]): Wire[] {
    return [
      { id: 'w1', from: { componentId: 'src', pinId: 'L1' }, to: { componentId: 'q', pinId: '1' } },
      { id: 'w2', from: { componentId: 'src', pinId: 'L2' }, to: { componentId: 'q', pinId: '3' } },
      { id: 'w3', from: { componentId: 'src', pinId: 'L3' }, to: { componentId: 'q', pinId: '5' } },
      ...pairing.map(([from, to], i) => ({ id: `m${i}`, from: { componentId: 'q', pinId: from }, to: { componentId: 'm', pinId: to } }) as Wire),
    ]
  }

  it('runs with CCW direction when phases are wired in natural L1-L2-L3 order', () => {
    const wires = wiresFor([
      ['2', 'U'],
      ['4', 'V'],
      ['6', 'W'],
    ])
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.m.motorRunning).toBe(true)
    expect(componentStates.m.motorDirection).toBe('CCW')
  })

  it('reports CW direction when two phases are swapped', () => {
    const wires = wiresFor([
      ['2', 'U'],
      ['6', 'V'], // L3 and L2 swapped
      ['4', 'W'],
    ])
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.m.motorRunning).toBe(true)
    expect(componentStates.m.motorDirection).toBe('CW')
  })

  it('does not run with only one phase present', () => {
    const wires = wiresFor([['2', 'U']])
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.m.motorRunning).toBe(false)
  })
})
