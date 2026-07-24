import { useState } from 'react'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'
import { PALETTE_CATEGORIES, categoryForType } from '@/components/symbols/categories'
import { useCanvasStore } from '@/store/canvas'
import { useSimulationStore } from '@/store/simulation'

export function ComponentPalette() {
  const addComponent = useCanvasStore((s) => s.addComponent)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = Object.values(COMPONENT_LIBRARY).reduce<
    Record<string, (typeof COMPONENT_LIBRARY)[string][]>
  >((acc, def) => {
    const cat = categoryForType(def.type)
    ;(acc[cat] ??= []).push(def)
    return acc
  }, {})

  return (
    <aside className="flex h-full w-56 flex-col gap-3 overflow-y-auto border-r border-gray-800 bg-gray-950 p-3 text-gray-200">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Componentes</h2>
      {PALETTE_CATEGORIES.filter((c) => grouped[c.id]?.length).map((cat) => {
        const isCollapsed = collapsed[cat.id]
        return (
          <div key={cat.id} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
              className="flex items-center justify-between text-[11px] font-medium text-gray-400 hover:text-gray-200"
            >
              <span>{cat.label}</span>
              <span>{isCollapsed ? '▸' : '▾'}</span>
            </button>
            {!isCollapsed &&
              grouped[cat.id].map((def) => (
                <button
                  key={def.type}
                  type="button"
                  draggable={!isRunning}
                  disabled={isRunning}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-zcade-component', def.type)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => !isRunning && addComponent(def.type, 200, 200)}
                  className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-left text-sm hover:border-blue-500 hover:bg-gray-800 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-800 disabled:hover:bg-gray-900"
                  title={`Arrastra al lienzo, o haz clic para añadir. Tipo: ${def.type}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-800 text-[10px] font-semibold text-gray-300">
                    {def.label}
                  </span>
                  <span className="truncate">{def.type}</span>
                </button>
              ))}
          </div>
        )
      })}
    </aside>
  )
}
