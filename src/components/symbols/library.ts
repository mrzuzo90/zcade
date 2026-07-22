import type { ComponentDefinition } from '@/types/circuit'

/**
 * Component footprints use a 60px grid cell as their base unit so pins land
 * on grid intersections at the default gridSize (10px, see store/canvas.ts).
 */
export const COMPONENT_LIBRARY: Record<string, ComponentDefinition> = {
  contactor_3p: {
    type: 'contactor_3p',
    label: 'KM',
    category: 'electrical',
    width: 60,
    height: 80,
    pins: [
      { id: '1', offset: { x: 0, y: 10 }, kind: 'power_no' },
      { id: '2', offset: { x: 60, y: 10 }, kind: 'power_no' },
      { id: '3', offset: { x: 0, y: 40 }, kind: 'power_no' },
      { id: '4', offset: { x: 60, y: 40 }, kind: 'power_no' },
      { id: '5', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '6', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil' },
    ],
  },

  push_button_no: {
    type: 'push_button_no',
    label: 'S',
    category: 'electrical',
    width: 40,
    height: 20,
    pins: [
      { id: '13', offset: { x: 0, y: 10 }, kind: 'auxiliary_no' },
      { id: '14', offset: { x: 40, y: 10 }, kind: 'auxiliary_no' },
    ],
  },

  push_button_nc: {
    type: 'push_button_nc',
    label: 'S',
    category: 'electrical',
    width: 40,
    height: 20,
    pins: [
      { id: '21', offset: { x: 0, y: 10 }, kind: 'auxiliary_nc' },
      { id: '22', offset: { x: 40, y: 10 }, kind: 'auxiliary_nc' },
    ],
  },

  motor_3p: {
    type: 'motor_3p',
    label: 'M',
    category: 'electrical',
    width: 60,
    height: 60,
    pins: [
      { id: 'U', offset: { x: 15, y: 0 }, kind: 'power' },
      { id: 'V', offset: { x: 30, y: 0 }, kind: 'power' },
      { id: 'W', offset: { x: 45, y: 0 }, kind: 'power' },
    ],
  },

  circuit_breaker_3p: {
    type: 'circuit_breaker_3p',
    label: 'Q',
    category: 'electrical',
    width: 60,
    height: 40,
    pins: [
      { id: '1', offset: { x: 0, y: 10 }, kind: 'power' },
      { id: '2', offset: { x: 60, y: 10 }, kind: 'power' },
      { id: '3', offset: { x: 0, y: 20 }, kind: 'power' },
      { id: '4', offset: { x: 60, y: 20 }, kind: 'power' },
      { id: '5', offset: { x: 0, y: 30 }, kind: 'power' },
      { id: '6', offset: { x: 60, y: 30 }, kind: 'power' },
    ],
  },

  lamp: {
    type: 'lamp',
    label: 'H',
    category: 'electrical',
    width: 30,
    height: 30,
    pins: [
      { id: '1', offset: { x: 15, y: 0 }, kind: 'signal' },
      { id: '2', offset: { x: 15, y: 30 }, kind: 'signal' },
    ],
  },
}

export function getComponentDefinition(type: string): ComponentDefinition {
  const def = COMPONENT_LIBRARY[type]
  if (!def) throw new Error(`Unknown component type: ${type}`)
  return def
}
