import { useEffect, useRef, useState } from 'react'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore } from '@/store/canvas'
import { GridLayer } from '@/components/Canvas/GridLayer'
import { ComponentSymbol } from '@/components/symbols/ComponentSymbol'

const ZOOM_STEP = 1.08

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

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
      if (!selectedId) return
      if (e.key === 'r' || e.key === 'R') {
        rotateComponent(selectedId, e.shiftKey ? -1 : 1)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeComponent(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, rotateComponent, removeComponent])

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
    if (e.target === e.target.getStage()) selectComponent(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/x-cadesimu-component')
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
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {showGrid && (
          <GridLayer scale={scale} position={position} width={size.width} height={size.height} />
        )}
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
                onSelect={selectComponent}
                onMove={moveComponent}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
