import { create } from 'zustand'
import type { Point, Wire, WireEndpoint, WireType } from '@/types/circuit'
import { useHistoryStore, type Command } from '@/store/history'
import { useCanvasStore } from '@/store/canvas'
import { getComponentDefinition } from '@/components/symbols/library'

let nextWireId = 1
function generateWireId() {
  return `wire_${nextWireId++}`
}

function sameEndpoint(a: WireEndpoint, b: WireEndpoint) {
  return a.componentId === b.componentId && a.pinId === b.pinId
}

function samePinPair(wire: Wire, from: WireEndpoint, to: WireEndpoint) {
  return (
    (sameEndpoint(wire.from, from) && sameEndpoint(wire.to, to)) ||
    (sameEndpoint(wire.from, to) && sameEndpoint(wire.to, from))
  )
}

function suggestedWireTypeFor(endpoint: WireEndpoint): WireType | undefined {
  const instance = useCanvasStore.getState().components[endpoint.componentId]
  if (!instance) return undefined
  const def = getComponentDefinition(instance.type)
  return def.pins.find((p) => p.id === endpoint.pinId)?.suggestedWireType
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
  /**
   * Sets (or clears, with `undefined`) a wire's manual routing override —
   * the ROUTE Week 2 waypoint-editing entry point (see engine/wiring.ts
   * `dragWireSegment`, which is what WireLayer uses to compute the `points`
   * passed here). Same command-pattern/undo treatment as `setWireType`.
   */
  setWirePoints: (id: string, points: Point[] | undefined) => void
  selectWire: (id: string | null) => void

  /**
   * Replaces the entire wire set wholesale — used by `.zcade` file load (see
   * `src/io/persistence.ts`) and "New Project". Same reasoning as
   * `canvas.ts`'s `loadComponents`: bypasses history entirely (callers pair
   * it with `useHistoryStore.getState().clear()`), preserves loaded ids
   * verbatim, and bumps the id-generator counter past the highest numeric
   * suffix seen so future `completeWire` calls can't collide with a
   * restored wire id.
   */
  loadWires: (wires: Wire[]) => void
}

type WireSetter = (updater: (state: WireStore) => Partial<WireStore>) => void

// --- Commands ---------------------------------------------------------
//
// Content mutations (create/remove a wire, change its type) go through the
// command pattern (see src/store/history.ts), same as canvas.ts. `pendingFrom`
// (the in-progress click-to-click draw gesture) and `selectedWireId` changes
// that happen *without* a content mutation (startWire/cancelWire/selectWire)
// are deliberately left as plain `set()` calls, not commands — they're
// transient interaction state, not circuit content, mirroring why simulation
// state is excluded from history entirely.

class CompleteWireCommand implements Command {
  readonly label = 'wires.completeWire'
  private readonly wire: Wire
  private readonly previousSelectedWireId: string | null
  private readonly set: WireSetter

  constructor(wire: Wire, previousSelectedWireId: string | null, set: WireSetter) {
    this.wire = wire
    this.previousSelectedWireId = previousSelectedWireId
    this.set = set
  }

  do() {
    this.set((state) => ({
      wires: { ...state.wires, [this.wire.id]: this.wire },
      order: [...state.order, this.wire.id],
      selectedWireId: this.wire.id,
    }))
  }

  undo() {
    this.set((state) => {
      const wires = { ...state.wires }
      delete wires[this.wire.id]
      return {
        wires,
        order: state.order.filter((id) => id !== this.wire.id),
        selectedWireId:
          state.selectedWireId === this.wire.id
            ? this.previousSelectedWireId
            : state.selectedWireId,
      }
    })
  }
}

class RemoveWireCommand implements Command {
  readonly label = 'wires.removeWire'
  private readonly wire: Wire
  /** Index in `order` at removal time, so undo reinserts it in place. */
  private readonly index: number
  private readonly previousSelectedWireId: string | null
  private readonly set: WireSetter

  constructor(wire: Wire, index: number, previousSelectedWireId: string | null, set: WireSetter) {
    this.wire = wire
    this.index = index
    this.previousSelectedWireId = previousSelectedWireId
    this.set = set
  }

  do() {
    this.set((state) => {
      const wires = { ...state.wires }
      delete wires[this.wire.id]
      return {
        wires,
        order: state.order.filter((id) => id !== this.wire.id),
        selectedWireId: state.selectedWireId === this.wire.id ? null : state.selectedWireId,
      }
    })
  }

  undo() {
    this.set((state) => {
      if (state.wires[this.wire.id]) return {}
      const order = [...state.order]
      order.splice(Math.min(this.index, order.length), 0, this.wire.id)
      return {
        wires: { ...state.wires, [this.wire.id]: this.wire },
        order,
        selectedWireId: this.previousSelectedWireId,
      }
    })
  }
}

class SetWireTypeCommand implements Command {
  readonly label = 'wires.setWireType'
  private readonly id: string
  private readonly from: WireType | undefined
  private readonly to: WireType | undefined
  private readonly set: WireSetter

  constructor(id: string, from: WireType | undefined, to: WireType | undefined, set: WireSetter) {
    this.id = id
    this.from = from
    this.to = to
    this.set = set
  }

  private patch(wireType: WireType | undefined) {
    this.set((state) => {
      const existing = state.wires[this.id]
      if (!existing) return {}
      return { wires: { ...state.wires, [this.id]: { ...existing, wireType } } }
    })
  }

  do() {
    this.patch(this.to)
  }

  undo() {
    this.patch(this.from)
  }
}

class SetWirePointsCommand implements Command {
  readonly label = 'wires.setWirePoints'
  private readonly id: string
  private readonly from: Point[] | undefined
  private readonly to: Point[] | undefined
  private readonly set: WireSetter

  constructor(id: string, from: Point[] | undefined, to: Point[] | undefined, set: WireSetter) {
    this.id = id
    this.from = from
    this.to = to
    this.set = set
  }

  private patch(points: Point[] | undefined) {
    this.set((state) => {
      const existing = state.wires[this.id]
      if (!existing) return {}
      return { wires: { ...state.wires, [this.id]: { ...existing, points } } }
    })
  }

  do() {
    this.patch(this.to)
  }

  undo() {
    this.patch(this.from)
  }
}

export const useWireStore = create<WireStore>((set, get) => {
  const setter: WireSetter = (updater) => set(updater)

  return {
    wires: {},
    order: [],
    selectedWireId: null,
    pendingFrom: null,

    startWire: (endpoint) => set({ pendingFrom: endpoint, selectedWireId: null }),

    completeWire: (endpoint) => {
      const { pendingFrom, wires, selectedWireId } = get()
      if (!pendingFrom) return null

      if (sameEndpoint(pendingFrom, endpoint)) {
        set({ pendingFrom: null })
        return null
      }
      const duplicate = Object.values(wires).some((wire) =>
        samePinPair(wire, pendingFrom, endpoint),
      )
      if (duplicate) {
        set({ pendingFrom: null })
        return null
      }

      const id = generateWireId()
      const fromHint = suggestedWireTypeFor(pendingFrom)
      const toHint = suggestedWireTypeFor(endpoint)
      const wireType = fromHint && toHint ? (fromHint === toHint ? fromHint : undefined) : (fromHint ?? toHint)
      const wire: Wire = wireType ? { id, from: pendingFrom, to: endpoint, wireType } : { id, from: pendingFrom, to: endpoint }
      // Clearing the in-progress draw gesture is transient UI state, not
      // undoable content — see file header comment.
      set({ pendingFrom: null })
      useHistoryStore.getState().execute(new CompleteWireCommand(wire, selectedWireId, setter))
      return id
    },

    cancelWire: () => set({ pendingFrom: null }),

    removeWire: (id) => {
      const { wires, order, selectedWireId } = get()
      const existing = wires[id]
      if (!existing) return
      const index = order.indexOf(id)
      useHistoryStore
        .getState()
        .execute(new RemoveWireCommand(existing, index, selectedWireId, setter))
    },

    // Cascades to every wire touching `componentId`. Each wire is its own
    // RemoveWireCommand, but because they're all issued synchronously here,
    // history's turn-based batching (src/store/history.ts) commits them as a
    // single Transaction — one undo step restores every wire.
    removeWiresForComponent: (componentId) => {
      const { order, wires, selectedWireId } = get()
      const toRemove = order.filter((id) => {
        const wire = wires[id]
        return wire.from.componentId === componentId || wire.to.componentId === componentId
      })
      const history = useHistoryStore.getState()
      for (const id of toRemove) {
        const current = get()
        const existing = current.wires[id]
        if (!existing) continue
        const index = current.order.indexOf(id)
        history.execute(new RemoveWireCommand(existing, index, selectedWireId, setter))
      }
    },

    setWireType: (id, wireType) => {
      const existing = get().wires[id]
      if (!existing) return
      useHistoryStore
        .getState()
        .execute(new SetWireTypeCommand(id, existing.wireType, wireType, setter))
    },

    setWirePoints: (id, points) => {
      const existing = get().wires[id]
      if (!existing) return
      useHistoryStore.getState().execute(new SetWirePointsCommand(id, existing.points, points, setter))
    },

    selectWire: (id) => set({ selectedWireId: id, pendingFrom: null }),

    loadWires: (wires) => {
      const record: Record<string, Wire> = {}
      const order: string[] = []
      let maxSuffix = 0
      for (const wire of wires) {
        record[wire.id] = wire
        order.push(wire.id)
        const match = /_(\d+)$/.exec(wire.id)
        if (match) maxSuffix = Math.max(maxSuffix, Number(match[1]))
      }
      nextWireId = Math.max(nextWireId, maxSuffix + 1)
      set({ wires: record, order, selectedWireId: null, pendingFrom: null })
    },
  }
})
