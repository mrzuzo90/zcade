/**
 * Palette sections in display order. Drives ComponentPalette grouping —
 * deliberately independent of `ComponentDefinition.category` (a closed
 * 'electrical'|'pneumatic'|'plc' union in types/circuit.ts we are constrained
 * not to touch, see the unifilar-symbol-integration spec Decision #9). Every
 * component type is assigned a palette category here; a unit test asserts the
 * mapping covers every COMPONENT_LIBRARY key.
 */
export const PALETTE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'fuentes', label: 'Fuentes de alimentación' },
  { id: 'mando_control', label: 'Mando y control' },
  { id: 'protecciones', label: 'Protecciones' },
  { id: 'maquinas', label: 'Máquinas' },
  { id: 'lineas', label: 'Líneas y embarrados' },
  { id: 'medida', label: 'Medida' },
  { id: 'baja_tension', label: 'Baja tensión (BT)' },
  { id: 'alta_tension', label: 'Alta tensión (AT)' },
]

const FALLBACK_CATEGORY = 'baja_tension'

/**
 * Maps every component `type` to a palette category id. Covers all 69 final
 * types (17 Tier-1 + 52 unifilar); the unifilar entries are listed ahead of
 * their library.ts entries landing, which is harmless — the palette only
 * renders categories that actually have members.
 */
export const CATEGORY_BY_TYPE: Record<string, string> = {
  // fuentes
  power_source_3p: 'fuentes',
  power_source_dc: 'fuentes',
  power_source_1p: 'fuentes',
  bt_generador_ca: 'fuentes',
  bt_bateria_almacenamiento: 'fuentes',
  bt_modulos_fotovoltaicos: 'fuentes',
  // mando_control
  contactor_3p: 'mando_control',
  contactor_4p: 'mando_control',
  push_button_no: 'mando_control',
  push_button_nc: 'mando_control',
  aux_contact_block_no: 'mando_control',
  aux_contact_block_nc: 'mando_control',
  timer_ton: 'mando_control',
  emergency_stop: 'mando_control',
  terminal_strip: 'mando_control',
  bt_interruptor_temporizador: 'mando_control',
  // protecciones
  circuit_breaker_3p: 'protecciones',
  thermal_overload_relay: 'protecciones',
  bt_seccionador: 'protecciones',
  bt_interruptor_seccionador: 'protecciones',
  bt_fusible: 'protecciones',
  bt_fusible_seccionable: 'protecciones',
  bt_interruptor_diferencial: 'protecciones',
  bt_interruptor_automatico_rele: 'protecciones',
  bt_protector_sobretensiones: 'protecciones',
  protecciones_rele_27_tension_minima: 'protecciones',
  protecciones_rele_57_cortocircuito: 'protecciones',
  protecciones_rele_59_tension_maxima: 'protecciones',
  protecciones_rele_59n_tension_maxima_homopolar: 'protecciones',
  protecciones_rele_64_fallo_tierra: 'protecciones',
  protecciones_rele_81_frecuencia: 'protecciones',
  protecciones_rele_87_diferencial: 'protecciones',
  // maquinas
  motor_3p: 'maquinas',
  motor_3p_6wire: 'maquinas',
  bt_bateria_condensadores: 'maquinas',
  bt_transformador: 'maquinas',
  bt_inversor: 'maquinas',
  bt_regulador_cc: 'maquinas',
  // lineas
  bt_embarrado: 'lineas',
  bt_linea_monofasica: 'lineas',
  bt_linea_trifasica_f: 'lineas',
  bt_linea_trifasica_fn: 'lineas',
  bt_linea_trifasica_fnt: 'lineas',
  bt_linea_cc: 'lineas',
  bt_linea_cc_tierra: 'lineas',
  // medida
  bt_medidor_directo: 'medida',
  bt_medidor_indirecto: 'medida',
  bt_vatimetro_directo: 'medida',
  bt_vatimetro_indirecto: 'medida',
  bt_sumador_intensidades: 'medida',
  bt_indicador: 'medida',
  at_celda_medida: 'medida',
  // baja_tension
  lamp: 'baja_tension',
  bt_puesta_a_tierra: 'baja_tension',
  bt_enchufe: 'baja_tension',
  bt_iluminacion: 'baja_tension',
  bt_resistencia: 'baja_tension',
  bt_cuadro_de_protecciones: 'baja_tension',
  bt_caja_seccionamiento: 'baja_tension',
  bt_caja_general_proteccion: 'baja_tension',
  // alta_tension
  at_celda_interruptor_automatico: 'alta_tension',
  at_celda_interruptor_seccionador: 'alta_tension',
  at_celda_interruptor_seccionador_fusible: 'alta_tension',
  at_celda_interruptor_seccionador_telecontrol: 'alta_tension',
  at_celda_interruptor_seccionador_seccionalizadora: 'alta_tension',
  at_celda_interruptor_seccionador_interruptor_automatico: 'alta_tension',
  at_celda_servicios_auxiliares: 'alta_tension',
  at_celda_remonte: 'alta_tension',
  at_transformador_at_bt: 'alta_tension',
}

export function categoryForType(type: string): string {
  return CATEGORY_BY_TYPE[type] ?? FALLBACK_CATEGORY
}
