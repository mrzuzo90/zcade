import type { ComponentInstance, ContactSegment, PotentialTag, Wire } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { findJunctions } from '@/engine/wiring'
import { UnionFind, pinKey } from '@/engine/graph'

export type MotorDirection = 'CW' | 'CCW' | 'unknown'

export interface ComponentRuntimeState {
  /** User input: true while a pushbutton is physically held down. */
  pressed?: boolean
  /** Derived output: true when a component with coil pins has a closed loop across two distinct potentials. */
  coilEnergized?: boolean
  /** Derived output: true when a 2-pin signal load (lamp) sees two distinct potentials across its pins. */
  lit?: boolean
  /** Derived output: true when a 3-pin power load (motor) has at least two phases present. */
  motorRunning?: boolean
  motorDirection?: MotorDirection
}

export interface SimulationSnapshot {
  pinToNet: Record<string, string>
  netPotentials: Record<string, PotentialTag[]>
  componentStates: Record<string, ComponentRuntimeState>
}

const MAX_ITERATIONS = 8
/** Canonical forward phase rotation; any cyclic rotation of it is CCW, any cyclic rotation of its reverse is CW. */
const FORWARD_SEQUENCE: PotentialTag[] = ['L1', 'L2', 'L3']

function isSegmentClosed(segment: ContactSegment, state: ComponentRuntimeState | undefined): boolean {
  if (segment.behavior === 'always_closed') return true
  const active = segment.control === 'pressed' ? (state?.pressed ?? false) : (state?.coilEnergized ?? false)
  return segment.behavior === 'no' ? active : !active
}

function potentialsEqual(a: PotentialTag[], b: PotentialTag[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((tag) => setB.has(tag))
}

/** True if the two pins' nets each carry at least one potential and those potentials differ — i.e. a voltage difference exists across the load. */
function energizedAcross(
  netPotentials: Record<string, PotentialTag[]>,
  pinToNet: Record<string, string>,
  a: string,
  b: string,
): boolean {
  const potA = netPotentials[pinToNet[a]] ?? []
  const potB = netPotentials[pinToNet[b]] ?? []
  return potA.length > 0 && potB.length > 0 && !potentialsEqual(potA, potB)
}

function motorDirection(tags: (PotentialTag | undefined)[]): MotorDirection {
  if (tags.some((t) => t === undefined)) return 'unknown'
  const seq = tags as PotentialTag[]
  if (new Set(seq).size !== 3 || seq.some((t) => !FORWARD_SEQUENCE.includes(t))) return 'unknown'
  const reversed = [...FORWARD_SEQUENCE].reverse()
  for (let offset = 0; offset < 3; offset++) {
    const rotatedForward = [0, 1, 2].map((i) => FORWARD_SEQUENCE[(i + offset) % 3])
    if (seq.every((t, i) => t === rotatedForward[i])) return 'CCW'
    const rotatedReverse = [0, 1, 2].map((i) => reversed[(i + offset) % 3])
    if (seq.every((t, i) => t === rotatedReverse[i])) return 'CW'
  }
  return 'unknown'
}

/**
 * Evaluates the circuit to a steady state for one simulation tick.
 *
 * This is a fixed-point relaxation, not a single topological pass: contact
 * segments controlled by a coil (e.g. a self-hold auxiliary contact wired in
 * parallel with a start button) can depend on the very state they help
 * produce. Seeding each tick from the previous tick's coilEnergized values
 * and iterating a few rounds reproduces real relay-logic settling —
 * including seal-in circuits staying latched after the start button is
 * released, and dropping out only when the control path is actually broken.
 */
export function evaluateCircuit(
  components: Record<string, ComponentInstance>,
  wires: Wire[],
  previousStates: Record<string, ComponentRuntimeState>,
): SimulationSnapshot {
  const junctions = findJunctions(wires, components)
  const wireById = new Map(wires.map((w) => [w.id, w]))

  let states: Record<string, ComponentRuntimeState> = {}
  for (const id of Object.keys(components)) {
    states[id] = {
      pressed: previousStates[id]?.pressed ?? false,
      coilEnergized: previousStates[id]?.coilEnergized ?? false,
    }
  }

  let pinToNet: Record<string, string> = {}
  let netPotentials: Record<string, PotentialTag[]> = {}

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const uf = new UnionFind()
    for (const wire of wires) uf.union(pinKey(wire.from), pinKey(wire.to))
    for (const junction of junctions) {
      const [firstId, ...restIds] = junction.wireIds
      const first = wireById.get(firstId)
      if (!first) continue
      for (const id of restIds) {
        const wire = wireById.get(id)
        if (wire) uf.union(pinKey(first.from), pinKey(wire.from))
      }
    }
    for (const instance of Object.values(components)) {
      const def = getComponentDefinition(instance.type)
      for (const segment of def.contacts ?? []) {
        if (isSegmentClosed(segment, states[instance.id])) {
          uf.union(`${instance.id}:${segment.pins[0]}`, `${instance.id}:${segment.pins[1]}`)
        }
      }
    }

    const newPinToNet: Record<string, string> = {}
    const newNetPotentials: Record<string, PotentialTag[]> = {}
    let netIndex = 0
    for (const keys of uf.groups().values()) {
      const netId = `net_${netIndex++}`
      const potentials = new Set<PotentialTag>()
      for (const key of keys) {
        newPinToNet[key] = netId
        const [componentId, pinId] = key.split(':')
        const pin = getComponentDefinition(components[componentId].type).pins.find((p) => p.id === pinId)
        if (pin?.potential) potentials.add(pin.potential)
      }
      newNetPotentials[netId] = [...potentials]
    }

    const newStates: Record<string, ComponentRuntimeState> = {}
    let changed = false
    for (const instance of Object.values(components)) {
      const def = getComponentDefinition(instance.type)
      const prior = states[instance.id]
      const next: ComponentRuntimeState = { pressed: prior.pressed, coilEnergized: prior.coilEnergized }

      const coilPins = def.pins.filter((p) => p.kind === 'coil')
      if (coilPins.length === 2) {
        next.coilEnergized = energizedAcross(
          newNetPotentials,
          newPinToNet,
          `${instance.id}:${coilPins[0].id}`,
          `${instance.id}:${coilPins[1].id}`,
        )
        if (next.coilEnergized !== prior.coilEnergized) changed = true
      }

      const signalPins = def.pins.filter((p) => p.kind === 'signal')
      if (signalPins.length === 2 && !def.contacts?.length) {
        next.lit = energizedAcross(
          newNetPotentials,
          newPinToNet,
          `${instance.id}:${signalPins[0].id}`,
          `${instance.id}:${signalPins[1].id}`,
        )
      }

      const powerPins = def.pins.filter((p) => p.kind === 'power' && !p.potential)
      if (powerPins.length === 3 && !def.contacts?.length) {
        const tags = powerPins.map((p) => {
          const tags = newNetPotentials[newPinToNet[`${instance.id}:${p.id}`]] ?? []
          return tags.length === 1 ? tags[0] : undefined
        })
        const presentCount = powerPins.filter((p) => (newNetPotentials[newPinToNet[`${instance.id}:${p.id}`]] ?? []).length > 0).length
        next.motorRunning = presentCount >= 2
        next.motorDirection = next.motorRunning ? motorDirection(tags) : 'unknown'
      }

      newStates[instance.id] = next
    }

    pinToNet = newPinToNet
    netPotentials = newNetPotentials
    states = newStates
    if (!changed && iteration > 0) break
  }

  return { pinToNet, netPotentials, componentStates: states }
}
