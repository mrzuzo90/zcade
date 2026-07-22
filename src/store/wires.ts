import { create } from 'zustand'
import type { Wire, WireEndpoint, WireType } from '@/types/circuit'

let nextWireId = 1
function generateWireId() {
  return `wire_${nextWireId++}`
}

function sameEndpoint(a: WireEndpoint, b: WireEndpoint) {
  return a.componentId === b.componentId && a.pinId === b.pinId
}

function samePinPair(wire: Wire, from: WireEndpoint, to: WireEndpoint) {
  return (sameEndpoint(wire.from, from) && sameEndpoint(wire.to, to)) || (sameEndpoint(wire.from, to) && sameEndpoint(wire.to, from))
}

interface WireStore {
  wires: Record<string, Wire>
  order: string[]
  selectedWireId: string | null
  /** Source pin of a wire currently being drawn, or null when idle. */
  pendingFrom: WireEndpoint | null

  startWire: (endpoint: WireEndpoint) => void
  /** Completes the pending wire at `endpoint`. Returns the new wire's id, or null if the attempt was rejected/cancelled. */
  completeWire: (endpoint: WireEndpoint) => string | null
  cancelWire: () => void

  removeWire: (id: string) => void
  removeWiresForComponent: (componentId: string) => void
  setWireType: (id: string, wireType: WireType | undefined) => void
  selectWire: (id: string | null) => void
}

export const useWireStore = create<WireStore>((set, get) => ({
  wires: {},
  order: [],
  selectedWireId: null,
  pendingFrom: null,

  startWire: (endpoint) => set({ pendingFrom: endpoint, selectedWireId: null }),

  completeWire: (endpoint) => {
    const { pendingFrom, wires } = get()
    if (!pendingFrom) return null

    if (sameEndpoint(pendingFrom, endpoint)) {
      set({ pendingFrom: null })
      return null
    }
    const duplicate = Object.values(wires).some((wire) => samePinPair(wire, pendingFrom, endpoint))
    if (duplicate) {
      set({ pendingFrom: null })
      return null
    }

    const id = generateWireId()
    const wire: Wire = { id, from: pendingFrom, to: endpoint }
    set((state) => ({
      wires: { ...state.wires, [id]: wire },
      order: [...state.order, id],
      pendingFrom: null,
      selectedWireId: id,
    }))
    return id
  },

  cancelWire: () => set({ pendingFrom: null }),

  removeWire: (id) => {
    set((state) => {
      const wires = { ...state.wires }
      delete wires[id]
      return {
        wires,
        order: state.order.filter((existingId) => existingId !== id),
        selectedWireId: state.selectedWireId === id ? null : state.selectedWireId,
      }
    })
  },

  removeWiresForComponent: (componentId) => {
    set((state) => {
      const toRemove = state.order.filter((id) => {
        const wire = state.wires[id]
        return wire.from.componentId === componentId || wire.to.componentId === componentId
      })
      if (toRemove.length === 0) return state
      const wires = { ...state.wires }
      for (const id of toRemove) delete wires[id]
      return {
        wires,
        order: state.order.filter((id) => !toRemove.includes(id)),
        selectedWireId: toRemove.includes(state.selectedWireId ?? '') ? null : state.selectedWireId,
      }
    })
  },

  setWireType: (id, wireType) => {
    set((state) => {
      const existing = state.wires[id]
      if (!existing) return state
      return { wires: { ...state.wires, [id]: { ...existing, wireType } } }
    })
  },

  selectWire: (id) => set({ selectedWireId: id, pendingFrom: null }),
}))
