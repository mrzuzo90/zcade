import { create } from 'zustand'
import type { PotentialTag } from '@/types/circuit'
import { evaluateCircuit, type ComponentRuntimeState } from '@/engine/solver'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'

export const TICK_MS = 20 // 50Hz, per CLAUDE.md's simulation tick rate

interface SimulationStore {
  isRunning: boolean
  tickCount: number
  pinToNet: Record<string, string>
  netPotentials: Record<string, PotentialTag[]>
  componentStates: Record<string, ComponentRuntimeState>

  start: () => void
  stop: () => void
  tick: () => void
  setPressed: (componentId: string, pressed: boolean) => void
}

let intervalId: ReturnType<typeof setInterval> | null = null

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  isRunning: false,
  tickCount: 0,
  pinToNet: {},
  netPotentials: {},
  componentStates: {},

  start: () => {
    if (intervalId !== null) return
    set({ isRunning: true })
    intervalId = setInterval(() => get().tick(), TICK_MS)
  },

  stop: () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    // Powering off de-energizes everything, mirroring a real cabinet losing supply.
    set({ isRunning: false, tickCount: 0, pinToNet: {}, netPotentials: {}, componentStates: {} })
  },

  tick: () => {
    const { components } = useCanvasStore.getState()
    const { wires } = useWireStore.getState()
    const { componentStates: previousStates } = get()

    const snapshot = evaluateCircuit(components, Object.values(wires), previousStates)
    set((state) => ({
      tickCount: state.tickCount + 1,
      pinToNet: snapshot.pinToNet,
      netPotentials: snapshot.netPotentials,
      componentStates: snapshot.componentStates,
    }))
  },

  setPressed: (componentId, pressed) => {
    set((state) => ({
      componentStates: {
        ...state.componentStates,
        [componentId]: { ...state.componentStates[componentId], pressed },
      },
    }))
  },
}))
