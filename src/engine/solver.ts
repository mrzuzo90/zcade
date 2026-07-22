import type { ComponentInstance, ContactSegment, PotentialTag, Wire } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { findJunctions } from '@/engine/wiring'
import { UnionFind, pinKey } from '@/engine/graph'

export type MotorDirection = 'CW' | 'CCW' | 'unknown'

export interface ComponentRuntimeState {
  /** User input: true while a pushbutton is physically held down. */
  pressed?: boolean
  /**
   * User input: true while a manual reset action is being applied this tick
   * (e-stop twist-reset). Same "caller sets it, solver just carries it
   * forward" shape as `pressed` — see the top-of-tick seeding in
   * evaluateCircuit — but modeled as a separate input because a latching
   * e-stop genuinely has two distinct physical actions (push-to-trip,
   * twist-to-reset), not one momentary button.
   */
  resetRequested?: boolean
  /**
   * User input: manual thermal-overload trip toggle (operate-mode). Unlike
   * `pressed`, this is a persistent toggle, not a momentary hold — the
   * caller sets it true to simulate an overload and false to reset, with no
   * solver-side derivation needed (contrast with `latched` below).
   */
  tripped?: boolean
  /** Derived output: true when a component with coil pins has a closed loop across two distinct potentials. */
  coilEnergized?: boolean
  /**
   * Derived output: true once a component with a 'latched'-controlled
   * contact segment (e.g. a latching emergency stop) has been triggered via
   * `pressed`; stays true across ticks — regardless of `pressed` reverting
   * to false — until `resetRequested` clears it. See the derivation in
   * evaluateCircuit for why this can't oscillate within the 8-iteration cap.
   */
  latched?: boolean
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

/** Which runtime field on `controlState` drives this segment. Defaults to 'coil' — matches the pre-Phase-A behavior where an untagged `control` meant "coil". */
function isSegmentClosed(segment: ContactSegment, controlState: ComponentRuntimeState | undefined): boolean {
  if (segment.behavior === 'always_closed') return true
  let active: boolean
  switch (segment.control) {
    case 'pressed':
      active = controlState?.pressed ?? false
      break
    case 'tripped':
      active = controlState?.tripped ?? false
      break
    case 'latched':
      active = controlState?.latched ?? false
      break
    case 'coil':
    default:
      active = controlState?.coilEnergized ?? false
      break
  }
  return segment.behavior === 'no' ? active : !active
}

/**
 * Resolves which component instance's state a 'coil'-controlled segment
 * should actually read — see the `ContactSegment.linkedTo` doc comment in
 * types/circuit.ts for the full resolution order and rationale. Only ever
 * called for `control === 'coil'` segments; every other control kind is
 * always self-referential (a pushbutton's own `pressed`, a thermal relay's
 * own `tripped`, an e-stop's own `latched`).
 */
function resolveCoilControlState(
  segment: ContactSegment,
  instance: ComponentInstance,
  components: Record<string, ComponentInstance>,
  states: Record<string, ComponentRuntimeState>,
): ComponentRuntimeState | undefined {
  const tag = (instance.properties?.linkedTo as string | undefined) ?? segment.linkedTo
  if (!tag) return states[instance.id]
  const target = Object.values(components).find((other) => other.id !== instance.id && other.label === tag)
  return target ? states[target.id] : states[instance.id]
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
 *
 * Phase A extension — cross-instance linked contacts: the same relaxation
 * now also resolves 'coil'-controlled segments belonging to a DIFFERENT
 * component instance than the one whose coilEnergized they read (see
 * `resolveCoilControlState` / `ContactSegment.linkedTo`). This is exactly
 * as safe as the existing self-referential seal-in case, because it reads
 * from the same last-iteration `states` snapshot the self-referential case
 * always used — there is no new category of feedback loop, only a longer
 * one (through another instance's coil instead of this instance's own),
 * so the existing 8-iteration cap and prior-tick seeding still apply
 * unchanged (Risk 1 mitigation; see the oscillation/stability test in
 * tests/engine/solver.test.ts).
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
      resetRequested: previousStates[id]?.resetRequested ?? false,
      tripped: previousStates[id]?.tripped ?? false,
      coilEnergized: previousStates[id]?.coilEnergized ?? false,
      latched: previousStates[id]?.latched ?? false,
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
        const controlState =
          segment.control === 'coil' ? resolveCoilControlState(segment, instance, components, states) : states[instance.id]
        if (isSegmentClosed(segment, controlState)) {
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
      const next: ComponentRuntimeState = {
        pressed: prior.pressed,
        resetRequested: prior.resetRequested,
        tripped: prior.tripped,
        coilEnergized: prior.coilEnergized,
        latched: prior.latched,
      }

      // Derived latch (e.g. a latching emergency stop): once `pressed`
      // trips it, it stays true across ticks regardless of `pressed`
      // reverting, until `resetRequested` explicitly clears it. Reading
      // `prior` (last iteration's/previous tick's value) each time is a
      // monotonic OR gated by a fixed-for-the-tick reset flag, so this
      // settles in at most one extra iteration — no oscillation risk.
      const hasLatchingContact = def.contacts?.some((c) => c.control === 'latched') ?? false
      if (hasLatchingContact) {
        next.latched = prior.resetRequested ? false : (prior.latched ?? false) || (prior.pressed ?? false)
        if (next.latched !== prior.latched) changed = true
      }

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
