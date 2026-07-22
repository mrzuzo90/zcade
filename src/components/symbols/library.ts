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
    // All three power poles are driven by this same instance's own coil (A1-A2) —
    // a separate remotely-wired contact block sharing the same reference tag
    // isn't modeled yet, see engine/solver.ts scope note.
    contacts: [
      { pins: ['1', '2'], behavior: 'no', control: 'coil' },
      { pins: ['3', '4'], behavior: 'no', control: 'coil' },
      { pins: ['5', '6'], behavior: 'no', control: 'coil' },
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
    contacts: [{ pins: ['13', '14'], behavior: 'no', control: 'pressed' }],
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
    contacts: [{ pins: ['21', '22'], behavior: 'nc', control: 'pressed' }],
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
    // No trip/OFF modeling yet — always conducts, present purely for correct pinout/labeling.
    contacts: [
      { pins: ['1', '2'], behavior: 'always_closed' },
      { pins: ['3', '4'], behavior: 'always_closed' },
      { pins: ['5', '6'], behavior: 'always_closed' },
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

  power_source_3p: {
    type: 'power_source_3p',
    label: 'L1-3',
    category: 'electrical',
    width: 60,
    height: 30,
    pins: [
      { id: 'L1', offset: { x: 0, y: 30 }, kind: 'power', potential: 'L1' },
      { id: 'L2', offset: { x: 30, y: 30 }, kind: 'power', potential: 'L2' },
      { id: 'L3', offset: { x: 60, y: 30 }, kind: 'power', potential: 'L3' },
    ],
  },

  power_source_dc: {
    type: 'power_source_dc',
    label: '24V',
    category: 'electrical',
    width: 40,
    height: 30,
    pins: [
      { id: '+24V', offset: { x: 0, y: 30 }, kind: 'power', potential: 'DC_POS' },
      { id: '0V', offset: { x: 40, y: 30 }, kind: 'power', potential: 'DC_0' },
    ],
  },

  // ---------------------------------------------------------------------
  // Placeholder pending SYM symbol work (Phase A) — minimal pin/contact
  // layout only, added by SOLV purely to exercise cross-instance linkedTo
  // (engine/solver.ts) and the new thermal-overload/e-stop control kinds in
  // tests. Visual footprint/rendering will be replaced by SYM's IEC 60617
  // symbol set; do not treat width/height/offsets here as final.
  // ---------------------------------------------------------------------

  // A physically separate aux contact block: no coil pins of its own, so its
  // '13-14' segment only ever closes via ContactSegment.linkedTo resolving to
  // ANOTHER instance's coil (set per-instance via `properties.linkedTo`,
  // e.g. "KM1") — see the design note on contactor_3p above and
  // ContactSegment.linkedTo in types/circuit.ts.
  aux_contact_block_no: {
    type: 'aux_contact_block_no',
    label: 'KM',
    category: 'electrical',
    width: 40,
    height: 20,
    pins: [
      { id: '13', offset: { x: 0, y: 10 }, kind: 'auxiliary_no' },
      { id: '14', offset: { x: 40, y: 10 }, kind: 'auxiliary_no' },
    ],
    contacts: [{ pins: ['13', '14'], behavior: 'no', control: 'coil' }],
  },

  aux_contact_block_nc: {
    type: 'aux_contact_block_nc',
    label: 'KM',
    category: 'electrical',
    width: 40,
    height: 20,
    pins: [
      { id: '21', offset: { x: 0, y: 10 }, kind: 'auxiliary_nc' },
      { id: '22', offset: { x: 40, y: 10 }, kind: 'auxiliary_nc' },
    ],
    contacts: [{ pins: ['21', '22'], behavior: 'nc', control: 'coil' }],
  },

  // Thermal overload relay: power poles (1-3-5 in / 2-4-6 out) are a
  // straight pass-through — no overcurrent physics yet (matches
  // circuit_breaker_3p's documented scope) — plus the 95-96 trip contact.
  // NOTE: CLAUDE.md's pinout table labels 95-96 "(NO), opens when thermal
  // threshold exceeded" — that pairing is self-contradictory (a NO contact
  // *closes*, it doesn't open, when active). Real thermal overload relays
  // wire 95-96 as NC precisely so a trip BREAKS the contactor coil circuit;
  // implemented here as NC to match the stated functional behavior. Flagged
  // for Tech Lead / CLAUDE.md correction (see EOD note).
  thermal_overload_relay: {
    type: 'thermal_overload_relay',
    label: 'F',
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
      { id: '95', offset: { x: 0, y: 40 }, kind: 'auxiliary_nc' },
      { id: '96', offset: { x: 60, y: 40 }, kind: 'auxiliary_nc' },
    ],
    contacts: [
      { pins: ['1', '2'], behavior: 'always_closed' },
      { pins: ['3', '4'], behavior: 'always_closed' },
      { pins: ['5', '6'], behavior: 'always_closed' },
      { pins: ['95', '96'], behavior: 'nc', control: 'tripped' },
    ],
  },

  // Latching emergency stop: pressing it trips a persistent (solver-derived)
  // `latched` state that keeps the NC contact open across ticks even after
  // release — only an explicit `resetRequested` (twist-reset) clears it.
  // See ComponentRuntimeState.latched / the derivation in engine/solver.ts.
  emergency_stop: {
    type: 'emergency_stop',
    label: 'S',
    category: 'electrical',
    width: 40,
    height: 20,
    pins: [
      { id: '1', offset: { x: 0, y: 10 }, kind: 'auxiliary_nc' },
      { id: '2', offset: { x: 40, y: 10 }, kind: 'auxiliary_nc' },
    ],
    contacts: [{ pins: ['1', '2'], behavior: 'nc', control: 'latched' }],
  },
}

export function getComponentDefinition(type: string): ComponentDefinition {
  const def = COMPONENT_LIBRARY[type]
  if (!def) throw new Error(`Unknown component type: ${type}`)
  return def
}
