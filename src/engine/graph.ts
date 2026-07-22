import type { ComponentInstance, NodeNet, Wire, WireEndpoint } from '@/types/circuit'
import { findJunctions } from '@/engine/wiring'

export function pinKey(endpoint: WireEndpoint): string {
  return `${endpoint.componentId}:${endpoint.pinId}`
}

/** Simple path-compressed union-find over pin keys. Reused by engine/solver.ts for the live conduction graph. */
export class UnionFind {
  private parent = new Map<string, string>()

  private find(key: string): string {
    const parent = this.parent.get(key)
    if (parent === undefined) {
      this.parent.set(key, key)
      return key
    }
    if (parent === key) return key
    const root = this.find(parent)
    this.parent.set(key, root)
    return root
  }

  union(a: string, b: string) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootA, rootB)
  }

  groups(): Map<string, string[]> {
    const result = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      const group = result.get(root)
      if (group) group.push(key)
      else result.set(root, [key])
    }
    return result
  }
}

export interface CircuitGraph {
  nets: NodeNet[]
  /** Lookup from "componentId:pinId" to the id of the net it belongs to. */
  pinToNet: Record<string, string>
}

/**
 * Groups pins into equipotential nets from the static wiring alone (direct
 * wire connections plus T-junction taps). This is the wiring-layer graph
 * only — it does not yet account for component-internal switching (e.g. an
 * open contactor contact splitting a net), which depends on live simulation
 * state and belongs to the Phase 3 solver.
 */
export function buildCircuitGraph(components: Record<string, ComponentInstance>, wires: Wire[]): CircuitGraph {
  const uf = new UnionFind()

  for (const wire of wires) {
    uf.union(pinKey(wire.from), pinKey(wire.to))
  }

  const wireById = new Map(wires.map((w) => [w.id, w]))
  for (const junction of findJunctions(wires, components)) {
    const [firstId, ...restIds] = junction.wireIds
    const first = wireById.get(firstId)
    if (!first) continue
    for (const id of restIds) {
      const wire = wireById.get(id)
      if (!wire) continue
      uf.union(pinKey(first.from), pinKey(wire.from))
    }
  }

  const groups = uf.groups()
  const nets: NodeNet[] = []
  const pinToNet: Record<string, string> = {}
  const wiresByPin = new Map<string, string[]>()
  for (const wire of wires) {
    for (const endpoint of [wire.from, wire.to]) {
      const key = pinKey(endpoint)
      const list = wiresByPin.get(key)
      if (list) list.push(wire.id)
      else wiresByPin.set(key, [wire.id])
    }
  }

  let index = 0
  for (const keys of groups.values()) {
    if (keys.length < 2) continue // a lone pin key with no wire isn't a net
    const netId = `net_${index++}`
    const pins: WireEndpoint[] = keys.map((key) => {
      const [componentId, pinId] = key.split(':')
      return { componentId, pinId }
    })
    const wireIds = [...new Set(keys.flatMap((key) => wiresByPin.get(key) ?? []))]
    nets.push({ id: netId, pins, wireIds })
    for (const key of keys) pinToNet[key] = netId
  }

  return { nets, pinToNet }
}
