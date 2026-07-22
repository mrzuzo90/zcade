import { CanvasStage } from '@/components/Canvas/CanvasStage'
import { ComponentPalette } from '@/components/Canvas/ComponentPalette'
import { Toolbar } from '@/components/Canvas/Toolbar'

function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-gray-900">
      <Toolbar />
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
