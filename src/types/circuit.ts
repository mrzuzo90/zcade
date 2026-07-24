export interface Point {
  x: number
  y: number
}

/** 0, 90, 180, 270 — symbols only ever rotate in quarter turns. */
export type Rotation = 0 | 90 | 180 | 270

export type PinKind = 'power' | 'power_no' | 'power_nc' | 'coil' | 'auxiliary_no' | 'auxiliary_nc' | 'signal'

/** Electrical role used to assign a standardized wire color (see engine/wiring.ts WIRE_TYPE_COLORS). */
export type WireType = 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'DC_POS' | 'DC_0' | 'signal'

/** The fixed potentials a power-source pin can carry — the same tag set as WireType, minus the non-power 'signal' role. */
export type PotentialTag = Exclude<WireType, 'signal'>

export interface PinDefinition {
  id: string
  /** Position relative to the component's own (unrotated) top-left, in px. */
  offset: Point
  kind: PinKind
  /**
   * Cosmetic/bookkeeping pin-pair tag (e.g. both coil pins of one instance
   * tagged "coil" to mark them as a pair) — NOT the cross-instance solver
   * mechanism. For that, see `ContactSegment.linkedTo` below, a distinct
   * field with a distinct (and more important) meaning; the shared name is
   * unfortunate but each is documented at its own declaration.
   */
  linkedTo?: string
  /** Set only on power-source pins: the fixed potential this pin always carries (see engine/solver.ts). */
  potential?: PotentialTag
  /**
   * UI-only hint: which WireType a wire connected to this pin is expected to
   * carry (e.g. a lamp's neutral-side pin). Purely cosmetic/UX — consumed by
   * store/wires.ts's completeWire to auto-color a new wire on connection,
   * and NEVER read by engine/solver.ts. Distinct from `potential` above,
   * which the solver treats as a real source of that tag unconditionally —
   * a load/coil pin only ever receives phase/neutral from whatever it's
   * wired to, so it must not use `potential` (that would make the solver
   * inject a spurious source tag onto that pin's net regardless of actual
   * wiring).
   */
  suggestedWireType?: WireType
}

/** How a pair of pins within one component conducts, and what runtime input/output controls it (see engine/solver.ts). */
export type ContactBehavior = 'always_closed' | 'no' | 'nc'

export interface ContactSegment {
  /** The two pin ids (within the same component) this segment bridges when closed. */
  pins: [string, string]
  behavior: ContactBehavior
  /**
   * Runtime state key that drives 'no'/'nc' segments — ignored for 'always_closed'.
   * - 'pressed': momentary, driven directly by this instance's own `pressed` input.
   * - 'coil': driven by a coil-energized state — normally *this instance's own*
   *   `coilEnergized` (e.g. a contactor's own power poles), but see `linkedTo`
   *   below for the cross-instance case (aux contact blocks).
   * - 'tripped': driven by this instance's own `tripped` input (thermal overload).
   * - 'latched': driven by this instance's own derived `latched` state (e.g. a
   *   latching emergency stop) — see engine/solver.ts's latch derivation.
   * - 'timed': driven by this instance's own derived `timedActive` state (a
   *   TON on-delay timer's 55-56 NO / 57-58 NC contacts) — see the
   *   `timerElapsedMs`/`timedActive` fields on `ComponentRuntimeState`
   *   (engine/solver.ts) for the tick-accumulation rules. Always
   *   self-referential, same as 'tripped'/'latched': a timer's contacts
   *   always follow *that instance's own* coil, never a cross-instance
   *   `linkedTo` tag.
   */
  control?: 'pressed' | 'coil' | 'tripped' | 'latched' | 'timed'
  /**
   * Cross-instance control tag — only consulted when `control === 'coil'`.
   * A physically separate auxiliary contact block (its own ComponentInstance,
   * with no coil pins of its own) can be wired anywhere in a schematic and
   * still track a *different* instance's coil: at solve time, the segment's
   * effective coil state is read from whichever OTHER component instance's
   * `label` equals the resolved tag, instead of this instance's own (absent,
   * for an aux block) coilEnergized. This is what makes a remotely-wired
   * "KM1" aux block follow contactor KM1's own coil — CLAUDE.md's Contactor
   * Logic Example ("update linked auxiliary contacts with tag 'KM1'").
   *
   * Resolution order (see engine/solver.ts resolveCoilControlState()):
   *   1. `instance.properties.linkedTo` (a string) — set per-instance, since
   *      every instance of the SAME aux-block type follows a DIFFERENT
   *      contactor, so the tag can never be a fixed value on the shared
   *      ComponentDefinition alone.
   *   2. This field, `ContactSegment.linkedTo` — a definition-level fallback/
   *      default, useful for a component type where the tag is always the
   *      same (or for tests/fixtures that don't wire up `properties`).
   *   3. Neither set → falls back to this instance's own state, which is
   *      exactly today's (pre-Phase-A) behavior for contactor_3p's own power
   *      poles — zero regression risk for existing circuits.
   * If a tag IS set but no instance carries that label, the segment simply
   * never closes (safe-failure: an aux block with no coil pins of its own
   * never has a true coilEnergized to fall back to, so a bad/typo'd tag
   * fails open, not closed).
   */
  linkedTo?: string
}

export interface ComponentDefinition {
  type: string
  label: string
  category: 'electrical' | 'pneumatic' | 'plc'
  /** Footprint in px at rotation 0. */
  width: number
  height: number
  pins: PinDefinition[]
  /** Internal switchable pin-pairs (contactor power contacts, pushbutton contacts, breaker poles, ...). Absent for pure loads/sources. */
  contacts?: ContactSegment[]
}

export interface ComponentInstance {
  id: string
  type: string
  label: string
  x: number
  y: number
  rotation: Rotation
  properties: Record<string, unknown>
}

export interface WireEndpoint {
  componentId: string
  pinId: string
}

export interface Wire {
  id: string
  from: WireEndpoint
  to: WireEndpoint
  /**
   * Manual routing override. Absent by default: the live editor always routes
   * orthogonally between the endpoints' current pin positions (see
   * engine/wiring.ts getWirePath), so wires stay correct as components move.
   */
  points?: Point[]
  wireType?: WireType
}

/** A junction is a T-tap: one wire's endpoint pin lands on another wire's segment interior. */
export interface Junction {
  point: Point
  wireIds: string[]
}

/**
 * A crossing is two wires' rendered paths passing over one another at a
 * point interior to BOTH paths (neither wire terminates there) — an
 * unrelated overlap, never an electrical connection (that's what Junction
 * is for). Purely a rendering concern (see engine/wiring.ts findCrossings /
 * pathWithHops): rendered as a small arc "hop" on one of the two wires so it
 * visually reads as passing over, not connecting to, the other.
 */
export interface Crossing {
  point: Point
  wireIds: [string, string]
}

/** A net is a set of pins held at the same potential, transitively joined by wires and junctions. */
export interface NodeNet {
  id: string
  pins: WireEndpoint[]
  wireIds: string[]
}
