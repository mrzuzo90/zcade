import { useEffect } from 'react'
import { CanvasStage } from '@/components/Canvas/CanvasStage'
import { ComponentPalette } from '@/components/Canvas/ComponentPalette'
import { Toolbar } from '@/components/Canvas/Toolbar'
import { useProjectStore } from '@/store/project'

function RecoveryBanner() {
  const pendingRecovery = useProjectStore((s) => s.pendingRecovery)
  const recoverAutosave = useProjectStore((s) => s.recoverAutosave)
  const dismissRecovery = useProjectStore((s) => s.dismissRecovery)

  if (!pendingRecovery) return null

  const savedAt = new Date(pendingRecovery.mtimeMs).toLocaleString()
  return (
    <div className="flex items-center gap-3 border-b border-amber-900 bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
      <span>
        Se encontró un autoguardado más reciente que tu último archivo guardado ({savedAt}).
        ¿Recuperarlo?
      </span>
      <button
        className="rounded bg-amber-900/60 px-2 py-1 font-medium hover:bg-amber-900"
        onClick={() => void recoverAutosave()}
      >
        Recuperar
      </button>
      <button
        className="rounded px-2 py-1 hover:bg-amber-900/40"
        onClick={() => void dismissRecovery()}
      >
        Descartar
      </button>
    </div>
  )
}

function App() {
  useEffect(() => {
    void useProjectStore.getState().init()
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-900">
      <Toolbar />
      <RecoveryBanner />
      <div className="flex min-h-0 flex-1">
        <ComponentPalette />
        <main className="min-w-0 flex-1">
          <CanvasStage />
        </main>
      </div>
    </div>
  )
}

export default App
