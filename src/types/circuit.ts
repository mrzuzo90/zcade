export interface Point {
  x: number
  y: number
}

/** 0, 90, 180, 270 — symbols only ever rotate in quarter turns. */
export type Rotation = 0 | 90 | 180 | 270

export type PinKind = 'power' | 'power_no' | 'power_nc' | 'coil' | 'auxiliary_no' | 'auxiliary_nc' | 'signal'

export interface PinDefinition {
  id: string
  /** Position relative to the component's own (unrotated) top-left, in px. */
  offset: Point
  kind: PinKind
  /** For coil/contact pairs sharing a control tag (e.g. "KM1"). */
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
  points: Point[]
  netColor?: string
}
