import type { ComponentDefinition } from '@/types/circuit'

/** IEC 60617 signaling-lamp lens colors (docs/component-catalog.md §9), keyed by `lamp` instances' `properties.color`. */
export const LAMP_COLORS = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  white: '#f9fafb',
} as const

export type LampColor = keyof typeof LAMP_COLORS

export const DEFAULT_LAMP_COLOR: LampColor = 'red'

/** Resolves a `lamp` instance's `properties.color` to a hex value, falling back to `DEFAULT_LAMP_COLOR` for unset/unrecognized values (never throws — a bad value just renders the default lens color). */
export function resolveLampColor(color: unknown): string {
  return LAMP_COLORS[color as LampColor] ?? LAMP_COLORS[DEFAULT_LAMP_COLOR]
}

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
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
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

  // `properties.color` (per-instance, free-form — same "instance.properties.*"
  // pattern as timer_ton's `presetMs`/aux_contact_block's `linkedTo`, no
  // schema enforcement) selects the lens color per IEC signaling convention
  // (Verde/Rojo/Amarillo/Azul/Blanco — docs/component-catalog.md §9).
  // Defaults to `DEFAULT_LAMP_COLOR` when unset/unrecognized. Purely
  // cosmetic — `lit` derivation in engine/solver.ts is unaffected; see
  // `LAMP_COLORS` below and its use in ComponentSymbol.tsx (resolves to the
  // `signalColor` SymbolRenderer prop, a fixed lens-fill color kept
  // independent of the selection/energize `currentColor` convention).
  lamp: {
    type: 'lamp',
    label: 'H',
    category: 'electrical',
    width: 30,
    height: 30,
    pins: [
      { id: '1', offset: { x: 15, y: 0 }, kind: 'signal', suggestedWireType: 'L1' },
      { id: '2', offset: { x: 15, y: 30 }, kind: 'signal', suggestedWireType: 'N' },
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
    height: 60,
    pins: [
      { id: '1', offset: { x: 0, y: 10 }, kind: 'power' },
      { id: '2', offset: { x: 60, y: 10 }, kind: 'power' },
      { id: '3', offset: { x: 0, y: 20 }, kind: 'power' },
      { id: '4', offset: { x: 60, y: 20 }, kind: 'power' },
      { id: '5', offset: { x: 0, y: 30 }, kind: 'power' },
      { id: '6', offset: { x: 60, y: 30 }, kind: 'power' },
      { id: '95', offset: { x: 0, y: 40 }, kind: 'auxiliary_nc' },
      { id: '96', offset: { x: 60, y: 40 }, kind: 'auxiliary_nc' },
      // Fault-signal contact (docs/component-catalog.md §3): NO, closes on
      // trip to drive a fault lamp — independent of 95-96's NC seal-in-break
      // role. Same `tripped` control state, opposite polarity.
      { id: '97', offset: { x: 0, y: 50 }, kind: 'auxiliary_no' },
      { id: '98', offset: { x: 60, y: 50 }, kind: 'auxiliary_no' },
    ],
    contacts: [
      { pins: ['1', '2'], behavior: 'always_closed' },
      { pins: ['3', '4'], behavior: 'always_closed' },
      { pins: ['5', '6'], behavior: 'always_closed' },
      { pins: ['95', '96'], behavior: 'nc', control: 'tripped' },
      { pins: ['97', '98'], behavior: 'no', control: 'tripped' },
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

  // ---------------------------------------------------------------------
  // Phase A, Week 2 (SOLV) — TON timer + 6-wire Y-Δ motor. Same placeholder-
  // pin-layout caveat as the block above (pending SYM's real IEC symbols):
  // do not treat width/height/offsets here as final.
  // ---------------------------------------------------------------------

  // TON (on-delay) timer relay: bundles the A1-A2 coil with its 55-56 (NO)/
  // 57-58 (NC) timed contacts in one component, per docs/component-catalog.md
  // §8 and COMPLETE_PROJECT_ROADMAP.md's Change Log v1.1 correction — a bare
  // coil with no contact to switch can't drive any of the three canonical
  // circuits. `label: 'KT'` follows the common IEC timing-relay convention
  // ("K" relay + "T" timed); the catalog/CLAUDE.md don't specify a prefix for
  // this component, unlike KM/Q/F/S/H/M/Y which are explicitly called out.
  // See engine/solver.ts's `timerElapsedMs`/`timedActive` derivation for the
  // tick-accumulation rules (accumulates only while A1-A2 is energized,
  // reset to 0 the tick after it drops) and `instance.properties.presetMs`
  // for the per-instance preset (defaults to `DEFAULT_TON_PRESET_MS` if unset).
  timer_ton: {
    type: 'timer_ton',
    label: 'KT',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'A1', offset: { x: 0, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 40, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
      { id: '55', offset: { x: 0, y: 20 }, kind: 'auxiliary_no' },
      { id: '56', offset: { x: 40, y: 20 }, kind: 'auxiliary_no' },
      { id: '57', offset: { x: 0, y: 40 }, kind: 'auxiliary_nc' },
      { id: '58', offset: { x: 40, y: 40 }, kind: 'auxiliary_nc' },
    ],
    contacts: [
      { pins: ['55', '56'], behavior: 'no', control: 'timed' },
      { pins: ['57', '58'], behavior: 'nc', control: 'timed' },
    ],
  },

  // 6-wire (double-star) 3-phase motor: U1-V1-W1 are the line-side feed
  // terminals, U2-V2-W2 are the winding-end terminals whose external
  // jumpering (not any internal switch on this component) determines Star
  // (Y) vs Delta (Δ) configuration — docs/component-catalog.md §5. No
  // internal `contacts`: like `motor_3p`, this is a pure external-pin load,
  // and its role (motorRunning/motorDirection/motorWiring) is derived
  // generically in engine/solver.ts from having exactly 6 `kind: 'power'`
  // pins with no `potential` and no `contacts` — see the pin-kind-derives-
  // role convention documented on `ComponentRuntimeState`. The specific
  // U1/V1/W1/U2/V2/W2 *names* (not just the count of 6) are what
  // `detectMotorWiring()` looks up, since Y/Δ jumper-pattern detection is
  // necessarily keyed to this exact IEC terminal convention — the same
  // trade-off already accepted for the 3-pin `motor_3p`'s U/V/W lookup.
  motor_3p_6wire: {
    type: 'motor_3p_6wire',
    label: 'M',
    category: 'electrical',
    width: 90,
    height: 60,
    pins: [
      { id: 'U1', offset: { x: 15, y: 0 }, kind: 'power' },
      { id: 'V1', offset: { x: 30, y: 0 }, kind: 'power' },
      { id: 'W1', offset: { x: 45, y: 0 }, kind: 'power' },
      { id: 'U2', offset: { x: 15, y: 60 }, kind: 'power' },
      { id: 'V2', offset: { x: 30, y: 60 }, kind: 'power' },
      { id: 'W2', offset: { x: 45, y: 60 }, kind: 'power' },
    ],
  },

  // ---------------------------------------------------------------------
  // Phase A, Week 2 (SYM) — 3 trivial additions per docs/component-catalog.md,
  // real symbols authored alongside (not placeholders — final pin layout).
  // ---------------------------------------------------------------------

  // 4-pole contactor: same coil/contact shape as contactor_3p, one more pole.
  // Pole spacing tightened (20px vs contactor_3p's 30px) to fit 4 poles in
  // the same 60x80 footprint/coil column — see docs/component-catalog.md §4
  // ("Bornes: 1-2, 3-4, 5-6, 7-8").
  contactor_4p: {
    type: 'contactor_4p',
    label: 'KM',
    category: 'electrical',
    width: 60,
    height: 80,
    pins: [
      { id: '1', offset: { x: 0, y: 10 }, kind: 'power_no' },
      { id: '2', offset: { x: 60, y: 10 }, kind: 'power_no' },
      { id: '3', offset: { x: 0, y: 30 }, kind: 'power_no' },
      { id: '4', offset: { x: 60, y: 30 }, kind: 'power_no' },
      { id: '5', offset: { x: 0, y: 50 }, kind: 'power_no' },
      { id: '6', offset: { x: 60, y: 50 }, kind: 'power_no' },
      { id: '7', offset: { x: 0, y: 70 }, kind: 'power_no' },
      { id: '8', offset: { x: 60, y: 70 }, kind: 'power_no' },
      { id: 'A1', offset: { x: 30, y: 0 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'L1' },
      { id: 'A2', offset: { x: 30, y: 80 }, kind: 'coil', linkedTo: 'coil', suggestedWireType: 'N' },
    ],
    contacts: [
      { pins: ['1', '2'], behavior: 'no', control: 'coil' },
      { pins: ['3', '4'], behavior: 'no', control: 'coil' },
      { pins: ['5', '6'], behavior: 'no', control: 'coil' },
      { pins: ['7', '8'], behavior: 'no', control: 'coil' },
    ],
  },

  // Single-phase AC source: L/N/PE per CLAUDE.md's Power Source Pins table
  // (Brown/Blue/Green-Yellow). `PotentialTag` has no generic "L" tag (only
  // L1/L2/L3), so the single phase pin uses 'L1' — the same convention
  // power_source_3p already established for phase potentials.
  power_source_1p: {
    type: 'power_source_1p',
    label: 'L-N-PE',
    category: 'electrical',
    width: 60,
    height: 30,
    pins: [
      { id: 'L', offset: { x: 0, y: 30 }, kind: 'power', potential: 'L1' },
      { id: 'N', offset: { x: 30, y: 30 }, kind: 'power', potential: 'N' },
      { id: 'PE', offset: { x: 60, y: 30 }, kind: 'power', potential: 'PE' },
    ],
  },

  // Terminal strip / borne block (docs/component-catalog.md §15, "X1, X2...").
  // 4 straight-through terminals, each modeled the same way as
  // circuit_breaker_3p/thermal_overload_relay's pass-through power poles: a
  // top and bottom pin per terminal bridged by an `always_closed` contact
  // (no switching function — a terminal block is just a physical splice
  // point between two sides of the cabinet wiring).
  terminal_strip: {
    type: 'terminal_strip',
    label: 'X',
    category: 'electrical',
    width: 60,
    height: 20,
    pins: [
      { id: '1', offset: { x: 0, y: 0 }, kind: 'power' },
      { id: '1B', offset: { x: 0, y: 20 }, kind: 'power' },
      { id: '2', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: '2B', offset: { x: 20, y: 20 }, kind: 'power' },
      { id: '3', offset: { x: 40, y: 0 }, kind: 'power' },
      { id: '3B', offset: { x: 40, y: 20 }, kind: 'power' },
      { id: '4', offset: { x: 60, y: 0 }, kind: 'power' },
      { id: '4B', offset: { x: 60, y: 20 }, kind: 'power' },
    ],
    contacts: [
      { pins: ['1', '1B'], behavior: 'always_closed' },
      { pins: ['2', '2B'], behavior: 'always_closed' },
      { pins: ['3', '3B'], behavior: 'always_closed' },
      { pins: ['4', '4B'], behavior: 'always_closed' },
    ],
  },

  // ---------------------------------------------------------------------
  // Unifilar (single-line) symbols — extracted from the ADG symbol sheet
  // (see assets/symbols/unifilares/index.json) and integrated per
  // docs/superpowers/plans/2026-07-25-unifilar-symbol-integration.md.
  // Single-line archetypes: a component sits inline on a feeder, so the
  // default is a vertical 2-pin pass-through (IN top-center / OUT
  // bottom-center). `category` stays 'electrical' (the closed union in
  // types/circuit.ts is untouched); palette grouping lives in categories.ts.
  // ---------------------------------------------------------------------

  // -- Protecciones --------------------------------------------------------
  bt_seccionador: {
    type: 'bt_seccionador',
    label: 'Q',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_interruptor_seccionador: {
    type: 'bt_interruptor_seccionador',
    label: 'Q',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_fusible: {
    type: 'bt_fusible',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_fusible_seccionable: {
    type: 'bt_fusible_seccionable',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_interruptor_diferencial: {
    type: 'bt_interruptor_diferencial',
    label: 'Q',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_interruptor_automatico_rele: {
    type: 'bt_interruptor_automatico_rele',
    label: 'Q',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  bt_interruptor_temporizador: {
    type: 'bt_interruptor_temporizador',
    label: 'Q',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'always_closed' }],
  },
  // Surge protective device: isolated (archetype B) — IN/OUT declared but NO
  // bridging contact, since an SPD shunts transients to earth rather than
  // conducting the feeder in series.
  bt_protector_sobretensiones: {
    type: 'bt_protector_sobretensiones',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
  },
  // ANSI protection relays: placeholder trip contact (behavior 'no',
  // control 'tripped', never asserted for now — no voltage/current magnitude
  // modeling exists yet, matching the Phase 3 scope decision in engine/solver.ts).
  protecciones_rele_27_tension_minima: {
    type: 'protecciones_rele_27_tension_minima',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_57_cortocircuito: {
    type: 'protecciones_rele_57_cortocircuito',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_59_tension_maxima: {
    type: 'protecciones_rele_59_tension_maxima',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_59n_tension_maxima_homopolar: {
    type: 'protecciones_rele_59n_tension_maxima_homopolar',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_64_fallo_tierra: {
    type: 'protecciones_rele_64_fallo_tierra',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_81_frecuencia: {
    type: 'protecciones_rele_81_frecuencia',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
  protecciones_rele_87_diferencial: {
    type: 'protecciones_rele_87_diferencial',
    label: 'F',
    category: 'electrical',
    width: 40,
    height: 40,
    pins: [
      { id: 'IN', offset: { x: 20, y: 0 }, kind: 'power' },
      { id: 'OUT', offset: { x: 20, y: 40 }, kind: 'power' },
    ],
    contacts: [{ pins: ['IN', 'OUT'], behavior: 'no', control: 'tripped' }],
  },
}

export function getComponentDefinition(type: string): ComponentDefinition {
  const def = COMPONENT_LIBRARY[type]
  if (!def) throw new Error(`Unknown component type: ${type}`)
  return def
}
