import type { ComponentInstance, ContactSegment, PotentialTag, Wire } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { findJunctions } from '@/engine/wiring'
import { UnionFind, pinKey } from '@/engine/graph'

export type MotorDirection = 'CW' | 'CCW' | 'unknown'

/**
 * Derived only for a 6-wire (U1V1W1/U2V2W2) motor: which external jumper
 * pattern the live wiring currently matches. 'none' covers both "no jumper
 * at all" and "an ambiguous/partial jumper that doesn't cleanly match either
 * known pattern" — same "don't guess" philosophy as `MotorDirection`'s
 * 'unknown'. See `detectMotorWiring()`.
 */
export type MotorWiring = 'star' | 'delta' | 'none'

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
  /** Derived output: true when a 3-pin or 6-pin power load (motor) has at least two phases present at its feed terminals. */
  motorRunning?: boolean
  motorDirection?: MotorDirection
  /** Derived output, 6-wire motors only — see `MotorWiring`/`detectMotorWiring()`. */
  motorWiring?: MotorWiring
  /**
   * TON on-delay timer bookkeeping (components whose `contacts` include a
   * `control: 'timed'` segment — see `ContactSegment.control` in
   * types/circuit.ts). Accumulates by exactly one tick's worth of time
   * (`TICK_MS` below) for every tick this instance's own coil was energized
   * on the *previous* tick, and hard-resets to 0 the tick after the coil
   * drops (never decays gradually) — an on-delay timer, not a latch.
   *
   * This is deliberately seeded from `previousStates` (read once, before the
   * 8-iteration relaxation loop below — see the top-of-tick seeding this
   * mirrors) rather than recomputed inside the loop: the accumulator must
   * advance exactly once per real simulation tick regardless of how many
   * relaxation iterations one evaluateCircuit() call performs internally,
   * or the timing would be wildly wrong (recomputing per-iteration could
   * advance the "clock" up to 8x too fast in a single tick). The trade-off
   * is a one-tick lag between the coil actually energizing/de-energizing
   * and the counter starting/stopping — the same kind of settling lag the
   * existing seal-in `coilEnergized` seeding already accepts.
   */
  timerElapsedMs?: number
  /** Derived output: true once `timerElapsedMs` reaches the instance's preset (`properties.presetMs`, default `DEFAULT_TON_PRESET_MS`) — drives the 55-56 (NO)/57-58 (NC) contacts. */
  timedActive?: boolean
}

export interface SimulationSnapshot {
  pinToNet: Record<string, string>
  netPotentials: Record<string, PotentialTag[]>
  componentStates: Record<string, ComponentRuntimeState>
  /**
   * Ids (from `netPotentials`) of every net whose computed potential-tag set
   * contains 2+ distinct tags — i.e. two or more incompatible power-source
   * potentials shorted onto the same equipotential net (e.g. L1 and L2, or
   * DC_POS and DC_0). A boolean-per-net FLAG only: no current magnitude or
   * fault energy is modeled (see CLAUDE.md Phase 3 — "No short-circuit or
   * overcurrent detection" — that design decision is unchanged; this just
   * surfaces the already-computed `netPotentials` data for a future ERC rule
   * or an operate-mode red-glow overlay to consume). The solver itself does
   * not fault, trip, or block simulation when it finds one.
   */
  shortedNetIds: string[]
}

const MAX_ITERATIONS = 8
/** Canonical forward phase rotation; any cyclic rotation of it is CCW, any cyclic rotation of its reverse is CW. */
const FORWARD_SEQUENCE: PotentialTag[] = ['L1', 'L2', 'L3']
/** Matches store/simulation.ts's TICK_MS (50Hz, per CLAUDE.md's simulation tick rate) — duplicated here rather than imported, to keep engine/ decoupled from store/ (see CLAUDE.md's Separation of Concerns). */
const TICK_MS = 20
/** Sane default TON preset when `instance.properties.presetMs` is not set (3 seconds). */
const DEFAULT_TON_PRESET_MS = 3000

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
    case 'timed':
      active = controlState?.timedActive ?? false
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
 * Detects Star (Y) vs Delta (Δ) external jumper wiring on a 6-wire motor's
 * U2/V2/W2 winding-end terminals, from the same per-net grouping the rest of
 * the solver already builds (`netOf` resolves a pin id to its net id for
 * THIS instance). Deliberately narrow, matching `motorDirection`'s "don't
 * guess" philosophy:
 *   - 'star': U2, V2 and W2 are all on the SAME net (a shorted star point) —
 *     whether that short comes from a bare jumper wire or a contactor's
 *     closed poles doesn't matter here, only the resulting net topology does.
 *   - 'delta': U2/V2/W2 are each jumpered to a DIFFERENT one of V1/W1/U1,
 *     forming the triangle — either cyclic direction (U2→V1→W1→U1 or its
 *     mirror U2→W1→V1→U1) counts, since both are the same physical Δ, just
 *     drawn/rotated the other way per docs/component-catalog.md §5's "or an
 *     equivalent phase-shifted jumper pattern".
 *   - 'none': anything else (unwired, partial, or a pattern matching
 *     neither) — never guessed.
 */
function detectMotorWiring(netOf: (pinId: string) => string | undefined): MotorWiring {
  const u1 = netOf('U1')
  const v1 = netOf('V1')
  const w1 = netOf('W1')
  const u2 = netOf('U2')
  const v2 = netOf('V2')
  const w2 = netOf('W2')

  if (u2 !== undefined && u2 === v2 && u2 === w2) {
    return 'star'
  }

  if (u2 !== undefined && v2 !== undefined && w2 !== undefined) {
    const deltaForward = u2 === v1 && v2 === w1 && w2 === u1
    const deltaReverse = u2 === w1 && v2 === u1 && w2 === v1
    if (deltaForward || deltaReverse) return 'delta'
  }

  return 'none'
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
      timerElapsedMs: previousStates[id]?.timerElapsedMs ?? 0,
      timedActive: previousStates[id]?.timedActive ?? false,
    }
  }

  // TON timer tick-accumulation — runs exactly ONCE per evaluateCircuit()
  // call (i.e. once per real simulation tick), deliberately before/outside
  // the relaxation loop below. It reads `previousStates` (last tick's
  // settled coilEnergized), never anything computed inside this tick's own
  // iterations, and the resulting timerElapsedMs/timedActive are then held
  // fixed (carried forward unchanged) across every iteration of this tick's
  // relaxation — see the `next` construction inside the loop. See the
  // `timerElapsedMs` doc comment on ComponentRuntimeState for the one-tick
  // lag this implies.
  for (const instance of Object.values(components)) {
    const def = getComponentDefinition(instance.type)
    const isTimer = def.contacts?.some((c) => c.control === 'timed') ?? false
    if (!isTimer) continue
    const wasEnergized = previousStates[instance.id]?.coilEnergized ?? false
    const priorElapsed = previousStates[instance.id]?.timerElapsedMs ?? 0
    const elapsed = wasEnergized ? priorElapsed + TICK_MS : 0
    const presetMs = (instance.properties?.presetMs as number | undefined) ?? DEFAULT_TON_PRESET_MS
    states[instance.id].timerElapsedMs = elapsed
    states[instance.id].timedActive = elapsed >= presetMs
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
        // Carried forward unchanged across relaxation iterations — these are
        // computed exactly once per tick, before this loop (see above).
        timerElapsedMs: prior.timerElapsedMs,
        timedActive: prior.timedActive,
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

      // 6-wire (U1V1W1/U2V2W2) motor: same pin-kind-derives-role convention
      // as the 3-pin case above, keyed on the pin count alone for role
      // detection — but Y/Δ pattern detection (detectMotorWiring) needs the
      // specific IEC pin names, since it's about WHICH terminals are
      // jumpered together, not just how many phases are present.
      if (powerPins.length === 6 && !def.contacts?.length) {
        const netOf = (pinId: string) => newPinToNet[`${instance.id}:${pinId}`]
        const feedPins = ['U1', 'V1', 'W1']
        const tags = feedPins.map((id) => {
          const tags = newNetPotentials[netOf(id)] ?? []
          return tags.length === 1 ? tags[0] : undefined
        })
        const presentCount = feedPins.filter((id) => (newNetPotentials[netOf(id)] ?? []).length > 0).length
        next.motorRunning = presentCount >= 2
        next.motorDirection = next.motorRunning ? motorDirection(tags) : 'unknown'
        next.motorWiring = detectMotorWiring(netOf)
      }

      newStates[instance.id] = next
    }

    pinToNet = newPinToNet
    netPotentials = newNetPotentials
    states = newStates
    if (!changed && iteration > 0) break
  }

  const shortedNetIds = Object.entries(netPotentials)
    .filter(([, tags]) => tags.length > 1)
    .map(([netId]) => netId)

  return { pinToNet, netPotentials, componentStates: states, shortedNetIds }
}
