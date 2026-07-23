import { create } from 'zustand'
import type { ComponentInstance, Rotation } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'
import { useHistoryStore, type Command } from '@/store/history'

let nextId = 1
function generateId(type: string) {
  return `${type}_${nextId++}`
}

export const GRID_SIZE = 10
export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

export function snapToGrid(value: number, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize
}

interface CanvasStore {
  components: Record<string, ComponentInstance>
  order: string[]
  selectedId: string | null

  scale: number
  position: { x: number; y: number }
  showGrid: boolean
  snapEnabled: boolean

  addComponent: (type: string, x: number, y: number) => string
  moveComponent: (id: string, x: number, y: number) => void
  rotateComponent: (id: string, direction?: 1 | -1) => void
  removeComponent: (id: string) => void
  selectComponent: (id: string | null) => void

  setScale: (scale: number) => void
  setPosition: (position: { x: number; y: number }) => void
  zoomAt: (pointer: { x: number; y: number }, deltaScale: number) => void
  toggleGrid: () => void
  toggleSnap: () => void

  /**
   * Replaces the entire component set wholesale — used by `.zcade` file
   * load (see `src/io/persistence.ts`) and "New Project". Deliberately
   * bypasses the command/history layer entirely: loading a file is a fresh
   * baseline, not a user edit to undo (mirrors `history.clear()`'s own doc
   * comment — "e.g. on file load/new project"). Callers are responsible for
   * calling `useHistoryStore.getState().clear()` alongside this.
   *
   * Also bumps the internal id-generator counter past the highest numeric
   * suffix found in the loaded ids, so a subsequent `addComponent` call in
   * the same session can never mint an id that collides with a restored
   * one (loaded ids are preserved verbatim, not regenerated, since wires
   * reference them by id).
   */
  loadComponents: (components: ComponentInstance[]) => void
}

type CanvasSetter = (updater: (state: CanvasStore) => Partial<CanvasStore>) => void

// --- Commands ---------------------------------------------------------
//
// Content mutations (add/move/rotate/remove a component) go through the
// command pattern (see src/store/history.ts) so every one of them is
// undoable, per CLAUDE.md / roadmap Section 10.2. View state (scale,
// position, grid/snap toggles) and pure selection are deliberately NOT
// wrapped as commands: undoing a pan/zoom or a selection change isn't
// meaningful CAD-editor behavior — the same reasoning the Phase 3 solver
// used to keep simulation state out of history entirely.

/** Rapid successive moves of the same component collapse into one undo step. */
const MOVE_COALESCE_WINDOW_MS = 600

class MoveComponentCommand implements Command {
  readonly label = 'canvas.moveComponent'
  readonly timestamp = Date.now()
  private readonly id: string
  private readonly from: { x: number; y: number }
  private readonly to: { x: number; y: number }
  private readonly set: CanvasSetter

  constructor(
    id: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    set: CanvasSetter,
  ) {
    this.id = id
    this.from = from
    this.to = to
    this.set = set
  }

  private patch(pos: { x: number; y: number }) {
    this.set((state) => {
      const existing = state.components[this.id]
      if (!existing) return {}
      return { components: { ...state.components, [this.id]: { ...existing, x: pos.x, y: pos.y } } }
    })
  }

  do() {
    this.patch(this.to)
  }

  undo() {
    this.patch(this.from)
  }

  coalesceWith(next: Command): Command | null {
    if (!(next instanceof MoveComponentCommand)) return null
    if (next.id !== this.id) return null
    if (next.timestamp - this.timestamp > MOVE_COALESCE_WINDOW_MS) return null
    return new MoveComponentCommand(this.id, this.from, next.to, this.set)
  }
}

class RotateComponentCommand implements Command {
  readonly label = 'canvas.rotateComponent'
  private readonly id: string
  private readonly from: Rotation
  private readonly to: Rotation
  private readonly set: CanvasSetter

  constructor(id: string, from: Rotation, to: Rotation, set: CanvasSetter) {
    this.id = id
    this.from = from
    this.to = to
    this.set = set
  }

  private patch(rotation: Rotation) {
    this.set((state) => {
      const existing = state.components[this.id]
      if (!existing) return {}
      return { components: { ...state.components, [this.id]: { ...existing, rotation } } }
    })
  }

  do() {
    this.patch(this.to)
  }

  undo() {
    this.patch(this.from)
  }
}

class AddComponentCommand implements Command {
  readonly label = 'canvas.addComponent'
  private readonly instance: ComponentInstance
  private readonly previousSelectedId: string | null
  private readonly set: CanvasSetter

  constructor(instance: ComponentInstance, previousSelectedId: string | null, set: CanvasSetter) {
    this.instance = instance
    this.previousSelectedId = previousSelectedId
    this.set = set
  }

  do() {
    this.set((state) => ({
      components: { ...state.components, [this.instance.id]: this.instance },
      order: [...state.order, this.instance.id],
      selectedId: this.instance.id,
    }))
  }

  undo() {
    this.set((state) => {
      const components = { ...state.components }
      delete components[this.instance.id]
      return {
        components,
        order: state.order.filter((id) => id !== this.instance.id),
        selectedId:
          state.selectedId === this.instance.id ? this.previousSelectedId : state.selectedId,
      }
    })
  }
}

class RemoveComponentCommand implements Command {
  readonly label = 'canvas.removeComponent'
  private readonly instance: ComponentInstance
  /** Index in `order` at the time of removal, so undo reinserts it in place. */
  private readonly index: number
  private readonly previousSelectedId: string | null
  private readonly set: CanvasSetter

  constructor(
    instance: ComponentInstance,
    index: number,
    previousSelectedId: string | null,
    set: CanvasSetter,
  ) {
    this.instance = instance
    this.index = index
    this.previousSelectedId = previousSelectedId
    this.set = set
  }

  do() {
    this.set((state) => {
      const components = { ...state.components }
      delete components[this.instance.id]
      return {
        components,
        order: state.order.filter((id) => id !== this.instance.id),
        selectedId: state.selectedId === this.instance.id ? null : state.selectedId,
      }
    })
  }

  undo() {
    this.set((state) => {
      if (state.components[this.instance.id]) return {}
      const order = [...state.order]
      order.splice(Math.min(this.index, order.length), 0, this.instance.id)
      return {
        components: { ...state.components, [this.instance.id]: this.instance },
        order,
        selectedId: this.previousSelectedId,
      }
    })
  }
}

export const useCanvasStore = create<CanvasStore>((set, get) => {
  const setter: CanvasSetter = (updater) => set(updater)

  return {
    components: {},
    order: [],
    selectedId: null,

    scale: 1,
    position: { x: 0, y: 0 },
    showGrid: true,
    snapEnabled: true,

    addComponent: (type, x, y) => {
      const def = getComponentDefinition(type)
      const { snapEnabled, selectedId } = get()
      const id = generateId(type)
      const instance: ComponentInstance = {
        id,
        type,
        label: def.label,
        x: snapEnabled ? snapToGrid(x) : x,
        y: snapEnabled ? snapToGrid(y) : y,
        rotation: 0,
        properties: {},
      }
      useHistoryStore.getState().execute(new AddComponentCommand(instance, selectedId, setter))
      return id
    },

    moveComponent: (id, x, y) => {
      const { snapEnabled, components } = get()
      const existing = components[id]
      if (!existing) return
      const to = { x: snapEnabled ? snapToGrid(x) : x, y: snapEnabled ? snapToGrid(y) : y }
      if (to.x === existing.x && to.y === existing.y) return
      useHistoryStore
        .getState()
        .execute(new MoveComponentCommand(id, { x: existing.x, y: existing.y }, to, setter))
    },

    rotateComponent: (id, direction = 1) => {
      const existing = get().components[id]
      if (!existing) return
      const next = ((((existing.rotation + direction * 90) % 360) + 360) % 360) as Rotation
      useHistoryStore
        .getState()
        .execute(new RotateComponentCommand(id, existing.rotation, next, setter))
    },

    removeComponent: (id) => {
      const { components, order, selectedId } = get()
      const existing = components[id]
      if (!existing) return
      const index = order.indexOf(id)
      useHistoryStore
        .getState()
        .execute(new RemoveComponentCommand(existing, index, selectedId, setter))
    },

    selectComponent: (id) => set({ selectedId: id }),

    setScale: (scale) => set({ scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) }),
    setPosition: (position) => set({ position }),

    zoomAt: (pointer, deltaScale) => {
      const { scale, position } = get()
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * deltaScale))
      const worldX = (pointer.x - position.x) / scale
      const worldY = (pointer.y - position.y) / scale
      set({
        scale: nextScale,
        position: {
          x: pointer.x - worldX * nextScale,
          y: pointer.y - worldY * nextScale,
        },
      })
    },

    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

    loadComponents: (components) => {
      const record: Record<string, ComponentInstance> = {}
      const order: string[] = []
      let maxSuffix = 0
      for (const component of components) {
        record[component.id] = component
        order.push(component.id)
        const match = /_(\d+)$/.exec(component.id)
        if (match) maxSuffix = Math.max(maxSuffix, Number(match[1]))
      }
      nextId = Math.max(nextId, maxSuffix + 1)
      set({ components: record, order, selectedId: null })
    },
  }
})
