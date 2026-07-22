import { COMPONENT_LIBRARY } from '@/components/symbols/library'
import { useCanvasStore } from '@/store/canvas'

const CATEGORY_LABEL: Record<string, string> = {
  electrical: 'Eléctrico',
  pneumatic: 'Neumático',
  plc: 'PLC',
}

export function ComponentPalette() {
  const addComponent = useCanvasStore((s) => s.addComponent)

  const grouped = Object.values(COMPONENT_LIBRARY).reduce<Record<string, (typeof COMPONENT_LIBRARY)[string][]>>(
    (acc, def) => {
      ;(acc[def.category] ??= []).push(def)
      return acc
    },
    {},
  )

  return (
    <aside className="flex h-full w-56 flex-col gap-4 overflow-y-auto border-r border-gray-800 bg-gray-950 p-3 text-gray-200">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Componentes</h2>
      {Object.entries(grouped).map(([category, defs]) => (
        <div key={category} className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-medium text-gray-400">{CATEGORY_LABEL[category] ?? category}</h3>
          {defs.map((def) => (
            <button
              key={def.type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-cadesimu-component', def.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => addComponent(def.type, 200, 200)}
              className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-left text-sm hover:border-blue-500 hover:bg-gray-800 active:cursor-grabbing"
              title={`Arrastra al lienzo, o haz clic para añadir. Tipo: ${def.type}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-800 text-[10px] font-semibold text-gray-300">
                {def.label}
              </span>
              <span className="truncate">{def.type}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
