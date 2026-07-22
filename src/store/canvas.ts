import { create } from 'zustand'
import type { ComponentInstance, Rotation } from '@/types/circuit'
import { getComponentDefinition } from '@/components/symbols/library'

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
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  components: {},
  order: [],
  selectedId: null,

  scale: 1,
  position: { x: 0, y: 0 },
  showGrid: true,
  snapEnabled: true,

  addComponent: (type, x, y) => {
    const def = getComponentDefinition(type)
    const { snapEnabled } = get()
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
    set((state) => ({
      components: { ...state.components, [id]: instance },
      order: [...state.order, id],
      selectedId: id,
    }))
    return id
  },

  moveComponent: (id, x, y) => {
    const { snapEnabled } = get()
    set((state) => {
      const existing = state.components[id]
      if (!existing) return state
      return {
        components: {
          ...state.components,
          [id]: {
            ...existing,
            x: snapEnabled ? snapToGrid(x) : x,
            y: snapEnabled ? snapToGrid(y) : y,
          },
        },
      }
    })
  },

  rotateComponent: (id, direction = 1) => {
    set((state) => {
      const existing = state.components[id]
      if (!existing) return state
      const next = (((existing.rotation + direction * 90) % 360) + 360) % 360 as Rotation
      return {
        components: { ...state.components, [id]: { ...existing, rotation: next } },
      }
    })
  },

  removeComponent: (id) => {
    set((state) => {
      const components = { ...state.components }
      delete components[id]
      return {
        components,
        order: state.order.filter((existingId) => existingId !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    })
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
}))
