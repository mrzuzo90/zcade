import { MAX_SCALE, MIN_SCALE, useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import type { WireType } from '@/types/circuit'

const WIRE_TYPE_LABEL: Record<WireType, string> = {
  L1: 'L1 (fase 1)',
  L2: 'L2 (fase 2)',
  L3: 'L3 (fase 3)',
  N: 'N (neutro)',
  PE: 'PE (tierra)',
  DC_POS: '+24V DC',
  DC_0: '0V DC',
  signal: 'Señal',
}

export function Toolbar() {
  const scale = useCanvasStore((s) => s.scale)
  const showGrid = useCanvasStore((s) => s.showGrid)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const setScale = useCanvasStore((s) => s.setScale)
  const setPosition = useCanvasStore((s) => s.setPosition)
  const toggleGrid = useCanvasStore((s) => s.toggleGrid)
  const toggleSnap = useCanvasStore((s) => s.toggleSnap)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const rotateComponent = useCanvasStore((s) => s.rotateComponent)
  const removeComponent = useCanvasStore((s) => s.removeComponent)

  const wires = useWireStore((s) => s.wires)
  const selectedWireId = useWireStore((s) => s.selectedWireId)
  const pendingFrom = useWireStore((s) => s.pendingFrom)
  const cancelWire = useWireStore((s) => s.cancelWire)
  const removeWire = useWireStore((s) => s.removeWire)
  const removeWiresForComponent = useWireStore((s) => s.removeWiresForComponent)
  const setWireType = useWireStore((s) => s.setWireType)
  const selectedWire = selectedWireId ? wires[selectedWireId] : null

  const isRunning = useSimulationStore((s) => s.isRunning)
  const startSimulation = useSimulationStore((s) => s.start)
  const stopSimulation = useSimulationStore((s) => s.stop)

  return (
    <header className="flex h-11 items-center gap-3 border-b border-gray-800 bg-gray-950 px-3 text-sm text-gray-200">
      <span className="font-semibold text-gray-100">CADe-Simu Next</span>
      <div className="mx-2 h-5 w-px bg-gray-800" />
      <button
        className={
          isRunning
            ? 'rounded bg-red-900/60 px-3 py-1 font-medium text-red-200 hover:bg-red-900'
            : 'rounded bg-green-900/60 px-3 py-1 font-medium text-green-200 hover:bg-green-900'
        }
        onClick={() => (isRunning ? stopSimulation() : startSimulation())}
      >
        {isRunning ? '■ Detener' : '▶ Simular'}
      </button>
      <div className="mx-2 h-5 w-px bg-gray-800" />
      <button
        className="rounded px-2 py-1 hover:bg-gray-800"
        onClick={() => setScale(Math.max(MIN_SCALE, scale / 1.2))}
      >
        −
      </button>
      <span className="w-12 text-center tabular-nums text-gray-400">{Math.round(scale * 100)}%</span>
      <button
        className="rounded px-2 py-1 hover:bg-gray-800"
        onClick={() => setScale(Math.min(MAX_SCALE, scale * 1.2))}
      >
        +
      </button>
      <button
        className="rounded px-2 py-1 hover:bg-gray-800"
        onClick={() => {
          setScale(1)
          setPosition({ x: 0, y: 0 })
        }}
      >
        Restablecer vista
      </button>
      <div className="mx-2 h-5 w-px bg-gray-800" />
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={showGrid} onChange={toggleGrid} /> Grilla
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} /> Ajustar a grilla
      </label>
      <div className="mx-2 h-5 w-px bg-gray-800" />
      <button
        className="rounded px-2 py-1 hover:bg-gray-800 disabled:opacity-30"
        disabled={!selectedId || isRunning}
        onClick={() => selectedId && rotateComponent(selectedId)}
      >
        ⟳ Rotar (R)
      </button>
      <button
        className="rounded px-2 py-1 hover:bg-gray-800 disabled:opacity-30"
        disabled={!selectedId || isRunning}
        onClick={() => {
          if (!selectedId) return
          if (pendingFrom?.componentId === selectedId) cancelWire()
          removeWiresForComponent(selectedId)
          removeComponent(selectedId)
        }}
      >
        Eliminar (Supr)
      </button>
      {selectedWire && !isRunning && (
        <>
          <div className="mx-2 h-5 w-px bg-gray-800" />
          <label className="flex items-center gap-1.5">
            Cable:
            <select
              className="rounded border border-gray-800 bg-gray-900 px-1.5 py-1 text-gray-200"
              value={selectedWire.wireType ?? ''}
              onChange={(e) => setWireType(selectedWire.id, (e.target.value || undefined) as WireType | undefined)}
            >
              <option value="">Sin asignar</option>
              {(Object.keys(WIRE_TYPE_LABEL) as WireType[]).map((type) => (
                <option key={type} value={type}>
                  {WIRE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded px-2 py-1 hover:bg-gray-800"
            onClick={() => removeWire(selectedWire.id)}
          >
            Eliminar cable
          </button>
        </>
      )}
    </header>
  )
}
