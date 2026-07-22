import { MAX_SCALE, MIN_SCALE, useCanvasStore } from '@/store/canvas'

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

  return (
    <header className="flex h-11 items-center gap-3 border-b border-gray-800 bg-gray-950 px-3 text-sm text-gray-200">
      <span className="font-semibold text-gray-100">CADe-Simu Next</span>
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
        disabled={!selectedId}
        onClick={() => selectedId && rotateComponent(selectedId)}
      >
        ⟳ Rotar (R)
      </button>
      <button
        className="rounded px-2 py-1 hover:bg-gray-800 disabled:opacity-30"
        disabled={!selectedId}
        onClick={() => selectedId && removeComponent(selectedId)}
      >
        Eliminar (Supr)
      </button>
    </header>
  )
}
