import { Circle, Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import { useEffect, useState } from 'react'
import type { ComponentInstance } from '@/types/circuit'
import { getComponentDefinition, resolveLampColor } from '@/components/symbols/library'
import { getSymbolDefinition } from '@/components/symbols/symbolRegistry'
import { SymbolRenderer } from '@/components/symbols/SymbolRenderer'
import { isContactClosed } from '@/components/symbols/contactState'
import { snapToGrid } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'

/** Component types that render an animated rotor (see the rAF effect below) — both the 3-wire and 6-wire 3-phase motors. */
const ROTATING_MOTOR_TYPES = new Set(['motor_3p', 'motor_3p_6wire'])

const PIN_COLOR: Record<string, string> = {
  power: '#f59e0b',
  power_no: '#f59e0b',
  power_nc: '#f59e0b',
  coil: '#3b82f6',
  auxiliary_no: '#10b981',
  auxiliary_nc: '#ef4444',
  signal: '#a855f7',
}

/** Degrees per millisecond the rotor sweeps while running — purely cosmetic, not simulation-truth. */
const ROTOR_SPEED = 0.25

interface ComponentSymbolProps {
  instance: ComponentInstance
  selected: boolean
  snapEnabled: boolean
  onSelect: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}

export function ComponentSymbol({
  instance,
  selected,
  snapEnabled,
  onSelect,
  onMove,
}: ComponentSymbolProps) {
  const def = getComponentDefinition(instance.type)
  const halfW = def.width / 2
  const halfH = def.height / 2
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [rotorAngle, setRotorAngle] = useState(0)

  const pendingFrom = useWireStore((s) => s.pendingFrom)
  const startWire = useWireStore((s) => s.startWire)
  const completeWire = useWireStore((s) => s.completeWire)

  const isRunning = useSimulationStore((s) => s.isRunning)
  const runtimeState = useSimulationStore((s) => s.componentStates[instance.id])
  const setPressed = useSimulationStore((s) => s.setPressed)
  const isPressable = def.contacts?.some((c) => c.control === 'pressed') ?? false
  const isEnergized = Boolean(
    runtimeState?.coilEnergized || runtimeState?.lit || runtimeState?.motorRunning,
  )
  const isPressedNow = Boolean(runtimeState?.pressed)
  const symbolDef = getSymbolDefinition(instance.type)
  const contactClosed = Object.fromEntries(
    (def.contacts ?? []).map((segment) => [
      segment.pins.join('-'),
      isContactClosed(segment, runtimeState),
    ]),
  )
  // Only `lamp` ever supplies a non-default `signalColor` — every other
  // symbol's paths simply don't use the `"signalColor"` sentinel, so passing
  // `undefined` for them is a no-op (SymbolRenderer falls back to its own
  // default). See library.ts's LAMP_COLORS / resolveLampColor and the
  // schema.ts doc comment on the sentinel.
  const signalColor =
    instance.type === 'lamp' ? resolveLampColor(instance.properties.color) : undefined

  useEffect(() => {
    if (!ROTATING_MOTOR_TYPES.has(instance.type) || !runtimeState?.motorRunning) return
    const direction = runtimeState.motorDirection === 'CW' ? 1 : -1
    let frameId: number
    let lastTime = performance.now()
    const step = (now: number) => {
      const delta = now - lastTime
      lastTime = now
      setRotorAngle((angle) => (angle + direction * delta * ROTOR_SPEED) % 360)
      frameId = requestAnimationFrame(step)
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [instance.type, runtimeState?.motorRunning, runtimeState?.motorDirection])

  const handlePinDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, pinId: string) => {
    e.cancelBubble = true
    if (isRunning) return
    if (pendingFrom) {
      completeWire({ componentId: instance.id, pinId })
    } else {
      startWire({ componentId: instance.id, pinId })
    }
  }

  const setCursor = (stage: Konva.Stage | null, cursor: string) => {
    if (stage) stage.container().style.cursor = cursor
  }

  const handlePress = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, pressed: boolean) => {
    e.cancelBubble = true
    setPressed(instance.id, pressed)
  }

  // The group pivots around the symbol's own center (via offset) so rotation
  // swings it in place instead of around the top-left corner.
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const topLeftX = node.x() - halfW
    const topLeftY = node.y() - halfH
    const x = snapEnabled ? snapToGrid(topLeftX) : topLeftX
    const y = snapEnabled ? snapToGrid(topLeftY) : topLeftY
    node.position({ x: x + halfW, y: y + halfH })
    onMove(instance.id, x, y)
  }

  const strokeColor = selected ? '#60a5fa' : isEnergized ? '#f59e0b' : '#9ca3af'

  return (
    <Group
      x={instance.x + halfW}
      y={instance.y + halfH}
      offsetX={halfW}
      offsetY={halfH}
      rotation={instance.rotation}
      draggable={!isRunning}
      onClick={() => onSelect(instance.id)}
      onTap={() => onSelect(instance.id)}
      onDragStart={() => onSelect(instance.id)}
      onDragEnd={handleDragEnd}
      onMouseDown={isRunning && isPressable ? (e) => handlePress(e, true) : undefined}
      onMouseUp={isRunning && isPressable ? (e) => handlePress(e, false) : undefined}
      onMouseLeave={isRunning && isPressable ? (e) => handlePress(e, false) : undefined}
      onTouchStart={isRunning && isPressable ? (e) => handlePress(e, true) : undefined}
      onTouchEnd={isRunning && isPressable ? (e) => handlePress(e, false) : undefined}
    >
      {symbolDef ? (
        <SymbolRenderer
          def={symbolDef}
          width={def.width}
          height={def.height}
          statusColor={strokeColor}
          signalColor={signalColor}
          energized={isEnergized}
          contactClosed={contactClosed}
          bodyFill={isPressedNow ? '#111827' : 'transparent'}
        />
      ) : (
        // Fallback for any component type without an authored SVG symbol yet
        // (none as of Phase A W1 — every library.ts type has one — but kept
        // so a future type added before its symbol exists still renders
        // something selectable instead of nothing).
        <Rect
          width={def.width}
          height={def.height}
          fill={isPressedNow ? '#111827' : '#1f2937'}
          stroke={strokeColor}
          strokeWidth={selected || isEnergized ? 2 : 1}
          cornerRadius={2}
        />
      )}
      <Text
        text={instance.label}
        width={def.width}
        height={def.height}
        align="center"
        verticalAlign="middle"
        fill="#e5e7eb"
        fontSize={12}
      />
      {ROTATING_MOTOR_TYPES.has(instance.type) && (
        <Group x={halfW} y={halfH} rotation={rotorAngle} listening={false}>
          <Circle radius={Math.min(halfW, halfH) - 6} stroke="#6b7280" strokeWidth={1} />
          <Line
            points={[0, 0, 0, -(Math.min(halfW, halfH) - 8)]}
            stroke={runtimeState?.motorRunning ? '#f59e0b' : '#6b7280'}
            strokeWidth={2}
          />
        </Group>
      )}
      {instance.type === 'motor_3p_6wire' &&
        (runtimeState?.motorWiring === 'star' || runtimeState?.motorWiring === 'delta') && (
          // Small external-wiring-configuration badge (Y/Δ) — ganging
          // `motorWiring` (SOLV, Week 2) into the symbol's visuals, called
          // out as "Not yet built" in CLAUDE.md's Phase A W2 SOLV section.
          // Purely a rendering readout of already-solved state, same as the
          // rotor direction arrow above.
          <Text
            text={runtimeState.motorWiring === 'star' ? 'Y' : 'Δ'}
            x={halfW - 8}
            y={def.height - 16}
            width={16}
            height={16}
            align="center"
            verticalAlign="middle"
            fill="#f59e0b"
            fontSize={12}
            fontStyle="bold"
            listening={false}
          />
        )}
      {def.pins.map((pin) => {
        const isPending = pendingFrom?.componentId === instance.id && pendingFrom.pinId === pin.id
        const isHovered = hoveredPin === pin.id
        return (
          <Group key={pin.id}>
            {(isHovered || isPending) && (
              <Circle
                x={pin.offset.x}
                y={pin.offset.y}
                radius={7}
                fill="#60a5fa"
                opacity={0.35}
                listening={false}
              />
            )}
            <Circle
              x={pin.offset.x}
              y={pin.offset.y}
              radius={3}
              fill={PIN_COLOR[pin.kind] ?? '#d1d5db'}
              stroke={isPending ? '#60a5fa' : undefined}
              strokeWidth={isPending ? 1.5 : 0}
            />
            {/* Larger transparent hit target so pins are easy to click without covering the visible dot. */}
            <Circle
              x={pin.offset.x}
              y={pin.offset.y}
              radius={8}
              fill="transparent"
              onMouseDown={(e) => {
                e.cancelBubble = true
              }}
              onClick={(e) => handlePinDown(e, pin.id)}
              onTap={(e) => handlePinDown(e, pin.id)}
              onTouchStart={(e) => {
                e.cancelBubble = true
              }}
              onMouseEnter={(e) => {
                setHoveredPin(pin.id)
                setCursor(e.target.getStage(), 'crosshair')
              }}
              onMouseLeave={(e) => {
                setHoveredPin(null)
                setCursor(e.target.getStage(), 'default')
              }}
            />
          </Group>
        )
      })}
    </Group>
  )
}
