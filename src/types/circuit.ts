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
  /** For coil/contact pairs sharing a control tag (e.g. "KM1"). */
  linkedTo?: string
  /** Set only on power-source pins: the fixed potential this pin always carries (see engine/solver.ts). */
  potential?: PotentialTag
}

/** How a pair of pins within one component conducts, and what runtime input/output controls it (see engine/solver.ts). */
export type ContactBehavior = 'always_closed' | 'no' | 'nc'

export interface ContactSegment {
  /** The two pin ids (within the same component) this segment bridges when closed. */
  pins: [string, string]
  behavior: ContactBehavior
  /** Runtime state key that drives 'no'/'nc' segments — ignored for 'always_closed'. */
  control?: 'pressed' | 'coil'
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

/** A net is a set of pins held at the same potential, transitively joined by wires and junctions. */
export interface NodeNet {
  id: string
  pins: WireEndpoint[]
  wireIds: string[]
}
