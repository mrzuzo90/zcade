import { useEffect, useRef, useState } from 'react'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import type { Point } from '@/types/circuit'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import { useHistoryStore } from '@/store/history'
import { GridLayer } from '@/components/Canvas/GridLayer'
import { WireLayer } from '@/components/Canvas/WireLayer'
import { ComponentSymbol } from '@/components/symbols/ComponentSymbol'

const ZOOM_STEP = 1.08

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)

  const components = useCanvasStore((s) => s.components)
  const order = useCanvasStore((s) => s.order)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const scale = useCanvasStore((s) => s.scale)
  const position = useCanvasStore((s) => s.position)
  const showGrid = useCanvasStore((s) => s.showGrid)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)

  const setPosition = useCanvasStore((s) => s.setPosition)
  const zoomAt = useCanvasStore((s) => s.zoomAt)
  const selectComponent = useCanvasStore((s) => s.selectComponent)
  const moveComponent = useCanvasStore((s) => s.moveComponent)
  const rotateComponent = useCanvasStore((s) => s.rotateComponent)
  const removeComponent = useCanvasStore((s) => s.removeComponent)
  const addComponent = useCanvasStore((s) => s.addComponent)

  const pendingFrom = useWireStore((s) => s.pendingFrom)
  const selectedWireId = useWireStore((s) => s.selectedWireId)
  const cancelWire = useWireStore((s) => s.cancelWire)
  const selectWire = useWireStore((s) => s.selectWire)
  const removeWire = useWireStore((s) => s.removeWire)
  const removeWiresForComponent = useWireStore((s) => s.removeWiresForComponent)

  const isRunning = useSimulationStore((s) => s.isRunning)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (isRunning) return

      // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo — CORE (src/store/history.ts).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useHistoryStore.getState().redo()
        else useHistoryStore.getState().undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useHistoryStore.getState().redo()
        return
      }

      if (e.key === 'Escape') {
        if (pendingFrom) cancelWire()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault()
          if (pendingFrom?.componentId === selectedId) cancelWire()
          removeWiresForComponent(selectedId)
          removeComponent(selectedId)
        } else if (selectedWireId) {
          e.preventDefault()
          removeWire(selectedWireId)
        }
        return
      }
      if (!selectedId) return
      if (e.key === 'r' || e.key === 'R') {
        rotateComponent(selectedId, e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, selectedWireId, pendingFrom, isRunning, rotateComponent, removeComponent, removeWire, removeWiresForComponent, cancelWire])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const deltaScale = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    zoomAt(pointer, deltaScale)
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== e.target.getStage()) return
    setPosition({ x: e.target.x(), y: e.target.y() })
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (pendingFrom) {
      cancelWire()
      return
    }
    selectComponent(null)
    selectWire(null)
  }

  const handleStageMouseMove = () => {
    if (!pendingFrom) return
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    setPreviewPoint({ x: (pointer.x - position.x) / scale, y: (pointer.y - position.y) / scale })
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isRunning) return
    const type = e.dataTransfer.getData('application/x-zcade-component')
    if (!type) return
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const rect = container.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top
    const worldX = (clientX - position.x) / scale
    const worldY = (clientY - position.y) / scale
    addComponent(type, worldX, worldY)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-gray-900"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
        draggable={!pendingFrom}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleStageMouseMove}
      >
        {showGrid && (
          <GridLayer scale={scale} position={position} width={size.width} height={size.height} />
        )}
        <WireLayer components={components} previewPoint={previewPoint} />
        <Layer>
          {order.map((id) => {
            const instance = components[id]
            if (!instance) return null
            return (
              <ComponentSymbol
                key={id}
                instance={instance}
                selected={id === selectedId}
                snapEnabled={snapEnabled}
                onSelect={(componentId) => {
                  selectComponent(componentId)
                  selectWire(null)
                }}
                onMove={moveComponent}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
