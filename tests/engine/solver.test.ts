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

describe('evaluateCircuit — cross-instance linked contacts (DOL self-hold via a separate aux contact block)', () => {
  // Same seal-in topology as the built-in-contact test above, but the seal-in
  // path now runs through a SEPARATE aux_contact_block_no instance tagged to
  // follow contactor km's coil (properties.linkedTo: 'KM1') — not km's own
  // power contact 1-2. This is the canonical DOL acceptance circuit for the
  // Phase A "cross-instance linkedTo" feature: contactor_3p alone has no aux
  // pins at all, so this can only pass if linked-contact resolution actually
  // crosses instances.
  //
  // src.+24V -> stop(NC) -> [start(NO) in parallel with auxKm1(NO, linked to "KM1")] -> km.A1, km.A2 -> src.0V
  // src.+24V -> km.1 -> km.2 -> lamp.1 -> lamp.2 -> src.0V   (proves the main path follows the coil too)
  const components: Record<string, ComponentInstance> = {
    src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
    stop: instance({ id: 'stop', type: 'push_button_nc', x: 100, y: 0 }),
    start: instance({ id: 'start', type: 'push_button_no', x: 200, y: 0 }),
    km: instance({ id: 'km', type: 'contactor_3p', x: 300, y: 0, label: 'KM1' }),
    auxKm1: instance({
      id: 'auxKm1',
      type: 'aux_contact_block_no',
      x: 300,
      y: 100,
      label: 'aux',
      properties: { linkedTo: 'KM1' },
    }),
    lamp: instance({ id: 'lamp', type: 'lamp', x: 400, y: 0 }),
  }
  const wires: Wire[] = [
    { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'stop', pinId: '21' } },
    { id: 'w2', from: { componentId: 'stop', pinId: '22' }, to: { componentId: 'start', pinId: '13' } },
    { id: 'w3', from: { componentId: 'stop', pinId: '22' }, to: { componentId: 'auxKm1', pinId: '13' } },
    { id: 'w4', from: { componentId: 'start', pinId: '14' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w5', from: { componentId: 'auxKm1', pinId: '14' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w6', from: { componentId: 'km', pinId: 'A2' }, to: { componentId: 'src', pinId: '0V' } },
    { id: 'w7', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'km', pinId: '1' } },
    { id: 'w8', from: { componentId: 'km', pinId: '2' }, to: { componentId: 'lamp', pinId: '1' } },
    { id: 'w9', from: { componentId: 'src', pinId: '0V' }, to: { componentId: 'lamp', pinId: '2' } },
  ]

  it('stays de-energized at idle', () => {
    const { componentStates } = evaluateCircuit(components, wires, {})
    expect(componentStates.km.coilEnergized).toBe(false)
    expect(componentStates.lamp.lit).toBe(false)
  })

  it('latches on when start is pressed, and stays latched after start is released (via the separate aux block, not km\'s own contacts)', () => {
    let states: Record<string, ComponentRuntimeState> = {}

    states = evaluateCircuit(components, wires, states).componentStates
    states = withPressed(states, 'start', true)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
    expect(states.lamp.lit).toBe(true)

    states = withPressed(states, 'start', false)
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
    expect(states.lamp.lit).toBe(true)

    // Stays latched over further ticks with nothing pressed.
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
  })

  it('drops out when stop is pressed, and requires start again afterward', () => {
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

  it('does not falsely energize if the aux block is tagged to a contactor label that does not exist (safe-failure: stays open, never crashes)', () => {
    const brokenComponents: Record<string, ComponentInstance> = {
      ...components,
      auxKm1: instance({
        id: 'auxKm1',
        type: 'aux_contact_block_no',
        x: 300,
        y: 100,
        label: 'aux',
        properties: { linkedTo: 'KM_DOES_NOT_EXIST' },
      }),
    }
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = evaluateCircuit(brokenComponents, wires, states).componentStates
    states = withPressed(states, 'start', false)
    // Without a valid link, the aux block never closes, so nothing latches.
    states = evaluateCircuit(brokenComponents, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)
  })

  it('remains a stable fixed point across many consecutive ticks with unchanged inputs (Risk 1: no oscillation)', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = evaluateCircuit(components, wires, states).componentStates
    states = withPressed(states, 'start', false)

    let previous: ComponentRuntimeState | undefined
    for (let tick = 0; tick < 20; tick++) {
      states = evaluateCircuit(components, wires, states).componentStates
      expect(states.km.coilEnergized).toBe(true)
      expect(states.lamp.lit).toBe(true)
      if (previous) {
        // Once latched, componentStates for km must be byte-identical tick to
        // tick — any drift here would indicate the fixed-point relaxation is
        // not actually converging (oscillating between two answers).
        expect(states.km).toEqual(previous)
      }
      previous = states.km
    }
  })
})

describe('evaluateCircuit — thermal overload relay (95-96 trip contact)', () => {
  // src.+24V -> start(NO) -> [thermal 95-96 in series, so a trip breaks the seal-in path] -> km.A1
  const components: Record<string, ComponentInstance> = {
    src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
    start: instance({ id: 'start', type: 'push_button_no', x: 100, y: 0 }),
    thermal: instance({ id: 'thermal', type: 'thermal_overload_relay', x: 200, y: 0 }),
    km: instance({ id: 'km', type: 'contactor_3p', x: 300, y: 0, label: 'KM1' }),
  }
  const wires: Wire[] = [
    { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'start', pinId: '13' } },
    { id: 'w2', from: { componentId: 'start', pinId: '14' }, to: { componentId: 'thermal', pinId: '95' } },
    { id: 'w3', from: { componentId: 'thermal', pinId: '96' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w4', from: { componentId: 'km', pinId: 'A2' }, to: { componentId: 'src', pinId: '0V' } },
  ]

  it('conducts (coil energizes) while not tripped', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    const { componentStates } = evaluateCircuit(components, wires, states)
    expect(componentStates.km.coilEnergized).toBe(true)
  })

  it('breaks the control circuit (95-96 opens) once manually tripped, even with start held', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = { ...states, thermal: { ...states.thermal, tripped: true } }
    const { componentStates } = evaluateCircuit(components, wires, states)
    expect(componentStates.km.coilEnergized).toBe(false)
  })

  it('conducts again once the trip is manually reset (toggled back off)', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = { ...states, thermal: { ...states.thermal, tripped: true } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)

    states = { ...states, thermal: { ...states.thermal, tripped: false } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
  })
})

describe('evaluateCircuit — latching emergency stop', () => {
  // src.+24V -> estop(NC, latching) -> start(NO) -> km.A1 ; km.A2 -> src.0V
  const components: Record<string, ComponentInstance> = {
    src: instance({ id: 'src', type: 'power_source_dc', x: 0, y: 0 }),
    estop: instance({ id: 'estop', type: 'emergency_stop', x: 100, y: 0 }),
    start: instance({ id: 'start', type: 'push_button_no', x: 200, y: 0 }),
    km: instance({ id: 'km', type: 'contactor_3p', x: 300, y: 0, label: 'KM1' }),
  }
  const wires: Wire[] = [
    { id: 'w1', from: { componentId: 'src', pinId: '+24V' }, to: { componentId: 'estop', pinId: '1' } },
    { id: 'w2', from: { componentId: 'estop', pinId: '2' }, to: { componentId: 'start', pinId: '13' } },
    { id: 'w3', from: { componentId: 'start', pinId: '14' }, to: { componentId: 'km', pinId: 'A1' } },
    { id: 'w4', from: { componentId: 'km', pinId: 'A2' }, to: { componentId: 'src', pinId: '0V' } },
  ]

  it('conducts normally (not tripped) so the coil can be driven by the start button', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    const { componentStates } = evaluateCircuit(components, wires, states)
    expect(componentStates.km.coilEnergized).toBe(true)
  })

  it('latches open once triggered, and stays open after the button is "released" (unlike a momentary NC button)', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    // Trigger the e-stop for one tick, then release it — a momentary NC
    // contact would re-close immediately; the latching e-stop must not.
    states = { ...states, estop: { ...states.estop, pressed: true } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)

    states = { ...states, estop: { ...states.estop, pressed: false } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false) // still latched open, button no longer held

    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false) // stays open indefinitely without a reset
  })

  it('only re-closes after an explicit twist-reset action', () => {
    let states: Record<string, ComponentRuntimeState> = {}
    states = withPressed(states, 'start', true)
    states = { ...states, estop: { ...states.estop, pressed: true } }
    states = evaluateCircuit(components, wires, states).componentStates
    states = { ...states, estop: { ...states.estop, pressed: false } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(false)

    states = { ...states, estop: { ...states.estop, resetRequested: true } }
    states = evaluateCircuit(components, wires, states).componentStates
    states = { ...states, estop: { ...states.estop, resetRequested: false } }
    states = evaluateCircuit(components, wires, states).componentStates
    expect(states.km.coilEnergized).toBe(true)
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
