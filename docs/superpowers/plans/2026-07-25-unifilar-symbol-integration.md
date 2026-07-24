# Unifilar Symbol Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 52 new unifilar symbols (+2 art-only swaps) from the approved spec real, usable, simulatable components that appear in a category-organized palette — closing the gap where they were extracted to disk but never wired into the app.

**Architecture:** Each symbol becomes (a) a `COMPONENT_LIBRARY` entry in `library.ts` and (b) an authored SVG under `assets/symbols/` with `viewBox="0 0 W H"`, a `<g id="pins">` whose circle coords match the library offsets exactly, and `layer:*` groups per `schema.md`. The registry's existing non-recursive `import.meta.glob('/assets/symbols/*.svg')` auto-registers them; a strict parity test (`tests/symbols/symbolRegistry.test.ts`) guards library↔SVG drift. Palette categorization is driven by a NEW palette-owned map (`categories.ts`), NOT by `ComponentDefinition.category` — this honors the spec's "no changes to types/circuit.ts" constraint (the `category` union stays `'electrical'|'pneumatic'|'plc'`; every new entry keeps `category: 'electrical'`).

**Tech Stack:** TypeScript, React 19, Konva/react-konva, Vitest, Vite (`import.meta.glob`), Tailwind v4.

## Global Constraints

- **No changes to `src/types/circuit.ts` or `src/engine/solver.ts`** (spec Decision #9). Every archetype is expressible with existing `PinDefinition.potential`, `PinDefinition.suggestedWireType`, and the already-supported `ContactSegment.control` values (`'pressed'|'coil'|'tripped'|'latched'|'timed'`) + `behavior` (`'always_closed'|'no'|'nc'`). New `library.ts` entries therefore all use `category: 'electrical'` (the closed union is untouched); palette grouping comes from `categories.ts` instead.
- **SVG authoring rules** (`schema.md`, enforced by `svgParser.ts` + parity test): body geometry is `<path>` ONLY — no `<rect>`/`<circle>`/`<line>`/`<polyline>` for artwork (circles/rects drawn as `d` arcs/lines per the `schema.md` cheat-sheet). `viewBox` MUST be exactly `0 0 <width> <height>` matching the library footprint. Pin markers are `<circle data-pin-id data-pin-kind cx cy r="1"/>` inside `<g id="pins">` (outside any `layer:` group so they never render), with `cx/cy` equal to the library pin `offset.x/offset.y`. Use `stroke="currentColor"` for state-tracking lines; literal hex only for fixed-color marks (green `#22c55e` closed-contact bridge, amber `#f59e0b` energized glow).
- **Footprints on the 10px grid**: all pin offsets are multiples of 10 so pins land on grid intersections at the default `gridSize=10` (`store/canvas.ts`).
- **Filenames = type ids verbatim** (snake_case, category-prefixed `bt_`/`at_`/`protecciones_rele_`), spec Decision #2. The SVG filename (minus `.svg`) IS the registered symbol id and MUST equal the `library.ts` key/`type`.
- **`at_caja_celda_flechas_numeros` is EXCLUDED** (diagram annotation, spec Decision #5): no `library.ts` entry, and its SVG must NOT exist in the `assets/symbols/` glob root (else `listSymbolTypes()` picks it up and the exact-list parity assertion fails). It stays only in `assets/symbols/unifilares/` (not globbed).
- **The raw extraction dir `assets/symbols/unifilares/` is preserved** as the archival vector source + visual reference for authoring. It is NOT globbed (glob is single-level `*.svg`), so it never affects the registry. Authored symbols are written fresh into `assets/symbols/` root (spec Decision #1's "move" is realized as "author-in-place using the raw file as reference"; a raw un-authored SVG moved into the root would break parity, so it is re-authored, not copied).
- **Verification per task**: `npm run type-check && npm run lint && npm run test` must pass before commit. `npm run build` at the final task.

## Category Scheme (`categories.ts`)

Palette sections, in display order, with every one of the 69 final types assigned. `CATEGORY_BY_TYPE` MUST cover every `COMPONENT_LIBRARY` key (a unit test asserts this).

| Category id | Label (ES) | Types |
|---|---|---|
| `fuentes` | Fuentes de alimentación | `power_source_3p`, `power_source_dc`, `power_source_1p`, `bt_generador_ca`, `bt_bateria_almacenamiento`, `bt_modulos_fotovoltaicos` |
| `mando_control` | Mando y control | `contactor_3p`, `contactor_4p`, `push_button_no`, `push_button_nc`, `aux_contact_block_no`, `aux_contact_block_nc`, `timer_ton`, `emergency_stop`, `terminal_strip`, `bt_interruptor_temporizador` |
| `protecciones` | Protecciones | `circuit_breaker_3p`, `thermal_overload_relay`, `bt_seccionador`, `bt_interruptor_seccionador`, `bt_fusible`, `bt_fusible_seccionable`, `bt_interruptor_diferencial`, `bt_interruptor_automatico_rele`, `bt_protector_sobretensiones`, `protecciones_rele_27_tension_minima`, `protecciones_rele_57_cortocircuito`, `protecciones_rele_59_tension_maxima`, `protecciones_rele_59n_tension_maxima_homopolar`, `protecciones_rele_64_fallo_tierra`, `protecciones_rele_81_frecuencia`, `protecciones_rele_87_diferencial` |
| `maquinas` | Máquinas | `motor_3p`, `motor_3p_6wire`, `bt_bateria_condensadores`, `bt_transformador`, `bt_inversor`, `bt_regulador_cc` |
| `lineas` | Líneas y embarrados | `bt_embarrado`, `bt_linea_monofasica`, `bt_linea_trifasica_f`, `bt_linea_trifasica_fn`, `bt_linea_trifasica_fnt`, `bt_linea_cc`, `bt_linea_cc_tierra` |
| `medida` | Medida | `bt_medidor_directo`, `bt_medidor_indirecto`, `bt_vatimetro_directo`, `bt_vatimetro_indirecto`, `bt_sumador_intensidades`, `bt_indicador`, `at_celda_medida` |
| `baja_tension` | Baja tensión (BT) | `lamp`, `bt_puesta_a_tierra`, `bt_enchufe`, `bt_iluminacion`, `bt_resistencia`, `bt_cuadro_de_protecciones`, `bt_caja_seccionamiento`, `bt_caja_general_proteccion` |
| `alta_tension` | Alta tensión (AT) | `at_celda_interruptor_automatico`, `at_celda_interruptor_seccionador`, `at_celda_interruptor_seccionador_fusible`, `at_celda_interruptor_seccionador_telecontrol`, `at_celda_interruptor_seccionador_seccionalizadora`, `at_celda_interruptor_seccionador_interruptor_automatico`, `at_celda_servicios_auxiliares`, `at_celda_remonte`, `at_transformador_at_bt` |

Note: `at_celda_medida` is placed under `medida` (spec's Full Mapping Table lists it there); the other `at_*` cells go under `alta_tension`.

## Archetype → pin/contact recipe

Single-line symbols sit inline on a feeder, so the default is a **vertical 2-pin passthrough** (top pin `IN` at `(w/2, 0)`, bottom pin `OUT` at `(w/2, h)`). Standard footprint `40 × 40` unless noted.

| Archetype | Pins | Contacts | stateLayers |
|---|---|---|---|
| **A — Source** | 1 pin `L` at `(w/2, 0)` carrying a fixed `potential` (ground: `(w/2,0)` kind `power` potential `PE`) | none | `base` only |
| **B — Isolated** | `IN` `(w/2,0)`, `OUT` `(w/2,h)`, kind `power` | **none** (deliberate galvanic isolation — no bridging segment) | `base` only |
| **C — Passthrough** | `IN` `(w/2,0)`, `OUT` `(w/2,h)`, kind `power` | one `{ pins:['IN','OUT'], behavior:'always_closed' }` | `base` only (always_closed → no toggle layer needed) |
| **C-multi** (multi-conductor lines / multi-terminal boxes) | one `IN`/`OUT` pair per conductor, kind `power`, spread horizontally on the 10px grid | one `always_closed` segment per conductor pair | `base` only |
| **D — Signal load** | exactly 2 `kind:'signal'` pins: `1` `(w/2,0)`, `2` `(w/2,h)` (add `suggestedWireType` `L1`/`N` like `lamp`) | none (solver derives `lit` from the 2 signal pins) | `base` (+ `energized` if you draw a lit overlay) |
| **E — Multi-segment cell** | `IN` `(w/2,0)`, `OUT` `(w/2,h)`, kind `power`; internal apparatus modeled as segments in series on the same line | one `always_closed` segment per contained apparatus, all on `['IN','OUT']`? No — chain via intermediate pins (see Task 8) | per-segment if any non-`always_closed` |
| **F — Relay placeholder** | `IN` `(w/2,0)`, `OUT` `(w/2,h)`, kind `power` | one `{ pins:['IN','OUT'], behavior:'no', control:'tripped' }` (always open for now — no magnitude modeling; matches Phase 3 scope) | `contact-IN-OUT-open`/`-closed` |

> **IMPORTANT — always_closed contacts need NO toggle layer** (parity test line 75 `continue`s on `always_closed`). Archetypes A/B/C/C-multi/E-with-only-always_closed therefore need only a `base` layer and can omit the `<metadata id="stateLayers">` block entirely (the parser defaults `base` to the layer named `base`). Only archetype **F** (and any `no`/`nc` segment) needs `contact-<a>-<b>-open`/`-closed` layers + a `stateLayers` metadata block.

---

### Reference SVG template — Archetype C (passthrough, `bt_fusible`, 40×40)

Copy this shape for every C/B/A symbol, swapping only the `layer:base` artwork (redraw the glyph from the raw source in `assets/symbols/unifilares/<file>.svg`, scaled/translated into the `0 0 40 40` box, centered on the vertical line `x=20`) and the pins block:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <!-- bt_fusible: inline fuse on a vertical feeder. Rectangle body + line. -->
  <g id="layer:base">
    <path d="M20,0 L20,40" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M14,10 L26,10 L26,30 L14,30 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </g>
  <g id="pins">
    <circle data-pin-id="IN" data-pin-kind="power" cx="20" cy="0" r="1"/>
    <circle data-pin-id="OUT" data-pin-kind="power" cx="20" cy="40" r="1"/>
  </g>
</svg>
```

Library entry for the same symbol:

```typescript
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
```

### Reference SVG template — Archetype F (relay placeholder, needs toggle layers, 40×40)

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <g id="layer:base">
    <path d="M20,0 L20,10" stroke="currentColor" stroke-width="1.5"/>
    <path d="M20,30 L20,40" stroke="currentColor" stroke-width="1.5"/>
    <!-- ANSI relay circle (two-arc path per schema.md cheat-sheet) + code text drawn as paths -->
    <path d="M20,10 A10,10 0 1,0 20,30 A10,10 0 1,0 20,10 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </g>
  <g id="layer:contact-IN-OUT-open">
    <path d="M20,10 L26,20" stroke="currentColor" stroke-width="1.5"/>
  </g>
  <g id="layer:contact-IN-OUT-closed">
    <path d="M20,10 L20,30" stroke="#22c55e" stroke-width="2.5"/>
  </g>
  <g id="pins">
    <circle data-pin-id="IN" data-pin-kind="power" cx="20" cy="0" r="1"/>
    <circle data-pin-id="OUT" data-pin-kind="power" cx="20" cy="40" r="1"/>
  </g>
  <metadata id="stateLayers">
    { "base": "base", "contacts": { "IN-OUT": { "open": "contact-IN-OUT-open", "closed": "contact-IN-OUT-closed" } } }
  </metadata>
</svg>
```

Library entry:

```typescript
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
```

---

## Task 1: Palette categorization (`categories.ts` + palette rewrite)

Lands first, verifiable against the current 17 types (they regroup into real sections). No new symbols yet.

**Files:**
- Create: `src/components/symbols/categories.ts`
- Modify: `src/components/Canvas/ComponentPalette.tsx`
- Test: `tests/symbols/categories.test.ts` (create)

**Interfaces:**
- Produces: `PALETTE_CATEGORIES: { id: string; label: string }[]` (ordered), `CATEGORY_BY_TYPE: Record<string, string>`, `categoryForType(type: string): string`.
- Consumes: `COMPONENT_LIBRARY` keys from `library.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/symbols/categories.test.ts
import { describe, expect, it } from 'vitest'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'
import { PALETTE_CATEGORIES, CATEGORY_BY_TYPE, categoryForType } from '@/components/symbols/categories'

describe('palette categories', () => {
  it('every library type has a category mapping', () => {
    for (const type of Object.keys(COMPONENT_LIBRARY)) {
      expect(CATEGORY_BY_TYPE[type], `missing category for ${type}`).toBeDefined()
    }
  })
  it('every mapped category id is a declared palette category', () => {
    const ids = new Set(PALETTE_CATEGORIES.map((c) => c.id))
    for (const cat of Object.values(CATEGORY_BY_TYPE)) expect(ids.has(cat)).toBe(true)
  })
  it('categoryForType falls back to a real category for unknown types', () => {
    expect(PALETTE_CATEGORIES.some((c) => c.id === categoryForType('nonexistent'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/symbols/categories.test.ts`
Expected: FAIL — cannot resolve `@/components/symbols/categories`.

- [ ] **Step 3: Create `categories.ts`**

Include ALL 69 final type ids in `CATEGORY_BY_TYPE` now (the not-yet-added ones are harmless — the "every library type has a mapping" test only checks the reverse direction). Use the Category Scheme table above.

```typescript
// src/components/symbols/categories.ts
/** Palette sections in display order. Drives ComponentPalette grouping — deliberately
 *  independent of ComponentDefinition.category (a closed 'electrical'|'pneumatic'|'plc'
 *  union in types/circuit.ts we are constrained not to touch). */
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

export const CATEGORY_BY_TYPE: Record<string, string> = {
  // fuentes
  power_source_3p: 'fuentes', power_source_dc: 'fuentes', power_source_1p: 'fuentes',
  bt_generador_ca: 'fuentes', bt_bateria_almacenamiento: 'fuentes', bt_modulos_fotovoltaicos: 'fuentes',
  // mando_control
  contactor_3p: 'mando_control', contactor_4p: 'mando_control',
  push_button_no: 'mando_control', push_button_nc: 'mando_control',
  aux_contact_block_no: 'mando_control', aux_contact_block_nc: 'mando_control',
  timer_ton: 'mando_control', emergency_stop: 'mando_control', terminal_strip: 'mando_control',
  bt_interruptor_temporizador: 'mando_control',
  // protecciones
  circuit_breaker_3p: 'protecciones', thermal_overload_relay: 'protecciones',
  bt_seccionador: 'protecciones', bt_interruptor_seccionador: 'protecciones',
  bt_fusible: 'protecciones', bt_fusible_seccionable: 'protecciones',
  bt_interruptor_diferencial: 'protecciones', bt_interruptor_automatico_rele: 'protecciones',
  bt_protector_sobretensiones: 'protecciones',
  protecciones_rele_27_tension_minima: 'protecciones', protecciones_rele_57_cortocircuito: 'protecciones',
  protecciones_rele_59_tension_maxima: 'protecciones', protecciones_rele_59n_tension_maxima_homopolar: 'protecciones',
  protecciones_rele_64_fallo_tierra: 'protecciones', protecciones_rele_81_frecuencia: 'protecciones',
  protecciones_rele_87_diferencial: 'protecciones',
  // maquinas
  motor_3p: 'maquinas', motor_3p_6wire: 'maquinas', bt_bateria_condensadores: 'maquinas',
  bt_transformador: 'maquinas', bt_inversor: 'maquinas', bt_regulador_cc: 'maquinas',
  // lineas
  bt_embarrado: 'lineas', bt_linea_monofasica: 'lineas', bt_linea_trifasica_f: 'lineas',
  bt_linea_trifasica_fn: 'lineas', bt_linea_trifasica_fnt: 'lineas', bt_linea_cc: 'lineas',
  bt_linea_cc_tierra: 'lineas',
  // medida
  bt_medidor_directo: 'medida', bt_medidor_indirecto: 'medida', bt_vatimetro_directo: 'medida',
  bt_vatimetro_indirecto: 'medida', bt_sumador_intensidades: 'medida', bt_indicador: 'medida',
  at_celda_medida: 'medida',
  // baja_tension
  lamp: 'baja_tension', bt_puesta_a_tierra: 'baja_tension', bt_enchufe: 'baja_tension',
  bt_iluminacion: 'baja_tension', bt_resistencia: 'baja_tension', bt_cuadro_de_protecciones: 'baja_tension',
  bt_caja_seccionamiento: 'baja_tension', bt_caja_general_proteccion: 'baja_tension',
  // alta_tension
  at_celda_interruptor_automatico: 'alta_tension', at_celda_interruptor_seccionador: 'alta_tension',
  at_celda_interruptor_seccionador_fusible: 'alta_tension', at_celda_interruptor_seccionador_telecontrol: 'alta_tension',
  at_celda_interruptor_seccionador_seccionalizadora: 'alta_tension',
  at_celda_interruptor_seccionador_interruptor_automatico: 'alta_tension',
  at_celda_servicios_auxiliares: 'alta_tension', at_celda_remonte: 'alta_tension',
  at_transformador_at_bt: 'alta_tension',
}

export function categoryForType(type: string): string {
  return CATEGORY_BY_TYPE[type] ?? FALLBACK_CATEGORY
}
```

- [ ] **Step 4: Rewrite `ComponentPalette.tsx` to group by categories, in declared order, as collapsible sections**

```tsx
import { useState } from 'react'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'
import { PALETTE_CATEGORIES, categoryForType } from '@/components/symbols/categories'
import { useCanvasStore } from '@/store/canvas'
import { useSimulationStore } from '@/store/simulation'

export function ComponentPalette() {
  const addComponent = useCanvasStore((s) => s.addComponent)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = Object.values(COMPONENT_LIBRARY).reduce<Record<string, (typeof COMPONENT_LIBRARY)[string][]>>(
    (acc, def) => {
      const cat = categoryForType(def.type)
      ;(acc[cat] ??= []).push(def)
      return acc
    },
    {},
  )

  return (
    <aside className="flex h-full w-56 flex-col gap-3 overflow-y-auto border-r border-gray-800 bg-gray-950 p-3 text-gray-200">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Componentes</h2>
      {PALETTE_CATEGORIES.filter((c) => grouped[c.id]?.length).map((cat) => {
        const isCollapsed = collapsed[cat.id]
        return (
          <div key={cat.id} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
              className="flex items-center justify-between text-[11px] font-medium text-gray-400 hover:text-gray-200"
            >
              <span>{cat.label}</span>
              <span>{isCollapsed ? '▸' : '▾'}</span>
            </button>
            {!isCollapsed &&
              grouped[cat.id].map((def) => (
                <button
                  key={def.type}
                  type="button"
                  draggable={!isRunning}
                  disabled={isRunning}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-zcade-component', def.type)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => !isRunning && addComponent(def.type, 200, 200)}
                  className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-left text-sm hover:border-blue-500 hover:bg-gray-800 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-800 disabled:hover:bg-gray-900"
                  title={`Arrastra al lienzo, o haz clic para añadir. Tipo: ${def.type}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-800 text-[10px] font-semibold text-gray-300">
                    {def.label}
                  </span>
                  <span className="truncate">{def.type}</span>
                </button>
              ))}
          </div>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 5: Run tests + type-check + lint**

Run: `npx vitest run tests/symbols/categories.test.ts && npm run type-check && npm run lint`
Expected: PASS (3 category tests green).

- [ ] **Step 6: Commit**

```bash
git add src/components/symbols/categories.ts src/components/Canvas/ComponentPalette.tsx tests/symbols/categories.test.ts
git commit -m "feat(palette): category-organized collapsible palette (categories.ts)"
```

---

## Tasks 2–7: Author symbols by category

Each of these tasks follows the SAME procedure; only the symbol set differs. For every symbol in the task:

1. Read the raw source at `assets/symbols/unifilares/<type>.svg` for the glyph shape.
2. Author `assets/symbols/<type>.svg` per the archetype template (viewBox `0 0 W H`, `layer:base` redraw centered on `x=w/2`, `<g id="pins">` at exact offsets, contact toggle layers + `stateLayers` metadata ONLY for archetype F / non-always_closed segments).
3. Add the `library.ts` entry (data given per symbol below).
4. Add the type id to `symbolRegistry.test.ts`'s type list (see Step for each task).

**Shared per-task steps** (repeat for each task N with its own symbol list + commit message):

- [ ] **Step A: Extend the parity test's type list**

In `tests/symbols/symbolRegistry.test.ts`, replace the top-level lists with a single explicit `ALL_TYPES` array. First task to run this replaces the `MIGRATED_TYPES`/`WEEK2_TYPES` split; add this block ONCE (in Task 2) and append to it in later tasks:

```typescript
// Full registry after unifilar integration. Historical Week1/Week2 split
// (MIGRATED_TYPES/WEEK2_TYPES) collapsed into one authoritative list.
const ALL_TYPES = [
  // Tier 1 (Week 1/2)
  'power_source_3p', 'power_source_dc', 'power_source_1p',
  'circuit_breaker_3p', 'contactor_3p', 'contactor_4p',
  'push_button_no', 'push_button_nc', 'motor_3p', 'motor_3p_6wire', 'lamp',
  'aux_contact_block_no', 'aux_contact_block_nc', 'thermal_overload_relay',
  'timer_ton', 'emergency_stop', 'terminal_strip',
  // + appended per unifilar task below
]
```

Also update the count assertion (test line ~38) to `expect(listSymbolTypes()).toHaveLength(ALL_TYPES.length)` and its title, and delete the now-unused `MIGRATED_TYPES`/`WEEK2_TYPES` constants.

- [ ] **Step B: Run the parity test — expect FAIL first (types listed but SVG/library missing), then author until green**

Run: `npx vitest run tests/symbols/symbolRegistry.test.ts`
Expected: FAIL until each listed type has both a `library.ts` entry and an authored SVG whose viewBox/pins match.

- [ ] **Step C: type-check + lint + full test suite**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step D: Commit** (message given per task).

---

### Task 2: `protecciones` symbols (14 new)

Append to `ALL_TYPES`: `bt_seccionador`, `bt_interruptor_seccionador`, `bt_fusible`, `bt_fusible_seccionable`, `bt_interruptor_diferencial`, `bt_interruptor_automatico_rele`, `bt_protector_sobretensiones`, `bt_interruptor_temporizador`, `protecciones_rele_27_tension_minima`, `protecciones_rele_57_cortocircuito`, `protecciones_rele_59_tension_maxima`, `protecciones_rele_59n_tension_maxima_homopolar`, `protecciones_rele_64_fallo_tierra`, `protecciones_rele_81_frecuencia`, `protecciones_rele_87_diferencial`.

(Note: `bt_interruptor_temporizador` lives in the `mando_control` palette category but is authored here with the other `bt_` switching gear; palette grouping is orthogonal to which task authors it.)

All are **Archetype C** (passthrough, `always_closed`) EXCEPT `bt_protector_sobretensiones` (**Archetype B**, isolated, NO contact — a surge arrester shunts to ground, not a series pass-through) and the seven `protecciones_rele_*` (**Archetype F**, `no`/`control:'tripped'`, with toggle layers). Footprint `40×40`, pins `IN (20,0)` / `OUT (20,40)` kind `power`, label per below.

Library-entry data (all `category: 'electrical'`, width/height `40`):

| type | label | archetype | contacts |
|---|---|---|---|
| `bt_seccionador` | Q | C | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `bt_interruptor_seccionador` | Q | C | same as C |
| `bt_fusible` | F | C | same as C |
| `bt_fusible_seccionable` | F | C | same as C |
| `bt_interruptor_diferencial` | Q | C | same as C |
| `bt_interruptor_automatico_rele` | Q | C | same as C |
| `bt_interruptor_temporizador` | Q | C | same as C |
| `bt_protector_sobretensiones` | F | B | **omit `contacts`** |
| `protecciones_rele_27_tension_minima` | F | F | `[{ pins:['IN','OUT'], behavior:'no', control:'tripped' }]` |
| `protecciones_rele_57_cortocircuito` | F | F | same as F |
| `protecciones_rele_59_tension_maxima` | F | F | same as F |
| `protecciones_rele_59n_tension_maxima_homopolar` | F | F | same as F |
| `protecciones_rele_64_fallo_tierra` | F | F | same as F |
| `protecciones_rele_81_frecuencia` | F | F | same as F |
| `protecciones_rele_87_diferencial` | F | F | same as F |

For the 7 relays, draw the ANSI code (27/57/59/59N/64/81/87) inside the circle as short `<path>` strokes so they're visually distinguishable (do NOT use `<text>` — parser is path-only).

Commit: `feat(symbols): protecciones unifilar symbols (15 types)`

---

### Task 3: `lineas` symbols (7 new)

Append to `ALL_TYPES`: `bt_embarrado`, `bt_linea_monofasica`, `bt_linea_trifasica_f`, `bt_linea_trifasica_fn`, `bt_linea_trifasica_fnt`, `bt_linea_cc`, `bt_linea_cc_tierra`.

All **Archetype C** single-conductor electrically (single-line representation): one `IN (20,0)`/`OUT (20,40)` pair + one `always_closed` segment, footprint `40×40`, label `W` (wire/line). The conductor count (mono/3F/3F+N/3F+N+T, CC ±, CC ±+T) is shown **cosmetically** as tick-marks/slashes across the line in `layer:base` — NOT as separate pins.

> **Design note / confirm at implementation:** the spec's archetype table said "one segment per conductor" for multi-conductor lines. This plan models them single-line (one electrical pass-through, conductor count cosmetic) because a single-line-diagram line symbol has one physical line entry/exit; giving `bt_linea_trifasica_fnt` 5 separate pin pairs would contradict the single-line abstraction and make it un-wireable as drawn. If Zuzo wants true per-conductor pins, revisit — but single-line is the faithful reading of these ADG symbols. `bt_embarrado` (busbar) is likewise one `always_closed` pass-through here (horizontal bar art), not a chain of taps.

Each: `contacts: [{ pins:['IN','OUT'], behavior:'always_closed' }]`.

Commit: `feat(symbols): line/busbar unifilar symbols (7 types)`

---

### Task 4: `maquinas` + `fuentes` symbols (9 new)

Append to `ALL_TYPES`: `bt_bateria_condensadores`, `bt_transformador`, `bt_inversor`, `bt_regulador_cc`, `bt_generador_ca`, `bt_bateria_almacenamiento`, `bt_modulos_fotovoltaicos`.

| type | label | archetype | pins | contacts |
|---|---|---|---|---|
| `bt_generador_ca` | G | A (source) | `[{ id:'L', offset:{x:20,y:0}, kind:'power', potential:'L1' }]` | omit |
| `bt_bateria_almacenamiento` | G | A (source) | `[{ id:'+', offset:{x:20,y:0}, kind:'power', potential:'DC_POS' }]` | omit |
| `bt_modulos_fotovoltaicos` | G | A (source) | `[{ id:'+', offset:{x:20,y:0}, kind:'power', potential:'DC_POS' }]` | omit |
| `bt_bateria_condensadores` | C | B (isolated) | `IN (20,0)`/`OUT (20,40)` power | omit |
| `bt_transformador` | T | B (isolated) | `IN (20,0)`/`OUT (20,40)` power | omit |
| `bt_inversor` | G | B (isolated) | `IN (20,0)`/`OUT (20,40)` power | omit |
| `bt_regulador_cc` | G | C (passthrough) | `IN (20,0)`/`OUT (20,40)` power | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |

All `category:'electrical'`, `width:40, height:40`. Sources use the two-arc circle path for the round generator/battery glyph; PV as a small hatched rectangle (paths).

Commit: `feat(symbols): machine + source unifilar symbols (7 types)`

---

### Task 5: `medida` symbols (6 new; `at_celda_medida` deferred to Task 8)

Append to `ALL_TYPES`: `bt_medidor_directo`, `bt_medidor_indirecto`, `bt_vatimetro_directo`, `bt_vatimetro_indirecto`, `bt_sumador_intensidades`, `bt_indicador`.

| type | label | archetype | contacts |
|---|---|---|---|
| `bt_medidor_directo` | P | C | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `bt_medidor_indirecto` | P | C | same |
| `bt_vatimetro_directo` | P | C | same |
| `bt_vatimetro_indirecto` | P | C | same |
| `bt_indicador` | P | C | same |
| `bt_sumador_intensidades` | P | B (isolated summing block) | omit |

All `40×40`, pins `IN (20,0)`/`OUT (20,40)` power. Meter glyphs: round two-arc circle with a letter-path (kWh/W/A) inside.

Commit: `feat(symbols): metering unifilar symbols (6 types)`

---

### Task 6: `baja_tension` symbols (7 new)

Append to `ALL_TYPES`: `bt_puesta_a_tierra`, `bt_enchufe`, `bt_iluminacion`, `bt_resistencia`, `bt_cuadro_de_protecciones`, `bt_caja_seccionamiento`, `bt_caja_general_proteccion`.

| type | label | archetype | pins | contacts |
|---|---|---|---|---|
| `bt_puesta_a_tierra` | PE | A (ground) | `[{ id:'PE', offset:{x:20,y:0}, kind:'power', potential:'PE' }]` | omit |
| `bt_iluminacion` | H | D (signal load) | `[{ id:'1', offset:{x:20,y:0}, kind:'signal', suggestedWireType:'L1' }, { id:'2', offset:{x:20,y:40}, kind:'signal', suggestedWireType:'N' }]` | omit |
| `bt_enchufe` | X | C | `IN/OUT` power | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `bt_resistencia` | R | C | `IN/OUT` power | same C |
| `bt_cuadro_de_protecciones` | X | C | `IN/OUT` power | same C |
| `bt_caja_seccionamiento` | X | C | `IN/OUT` power | same C |
| `bt_caja_general_proteccion` | X | C | `IN/OUT` power | same C |

`bt_iluminacion` (archetype D) — the solver's generic `lit` derivation fires on exactly 2 `signal` pins with no contacts; optionally add a `layer:energized` overlay for a lit glow (parser auto-detects a layer literally named `energized`). All `40×40`, `category:'electrical'`.

Commit: `feat(symbols): baja-tensión unifilar symbols (7 types)`

---

### Task 7: `alta_tension` cells — simple cases (Archetype C/B/E-single) (5 new)

Append to `ALL_TYPES`: `at_celda_interruptor_automatico`, `at_celda_interruptor_seccionador`, `at_celda_interruptor_seccionador_telecontrol`, `at_celda_interruptor_seccionador_seccionalizadora`, `at_transformador_at_bt`.

These are single-apparatus cells → one `always_closed` pass-through each (Archetype C), EXCEPT `at_transformador_at_bt` (Archetype B, isolated). Footprint `60×60` (cells are drawn larger, in a bordered box). Pins `IN (30,0)`/`OUT (30,60)` power. Label `AT`.

| type | archetype | contacts |
|---|---|---|
| `at_celda_interruptor_automatico` | C | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `at_celda_interruptor_seccionador` | C | same |
| `at_celda_interruptor_seccionador_telecontrol` | C (+ cosmetic telecontrol badge in base art) | same |
| `at_celda_interruptor_seccionador_seccionalizadora` | C (+ cosmetic sectionalizer flag) | same |
| `at_transformador_at_bt` | B (isolated) | omit |

Draw each cell as a `60×60` bordered box (`M2,2 L58,2 L58,58 L2,58 Z`) containing the apparatus glyph, with the vertical line entering top and exiting bottom.

Commit: `feat(symbols): AT single-apparatus cells (5 types)`

---

## Task 8: AT multi-segment cells (Archetype E) + `at_celda_medida` + `at_celda_remonte` (4 new)

**Files:** `assets/symbols/<type>.svg` (create), `src/components/symbols/library.ts` (modify), `tests/symbols/symbolRegistry.test.ts` (append).

Append to `ALL_TYPES`: `at_celda_interruptor_seccionador_fusible`, `at_celda_interruptor_seccionador_interruptor_automatico`, `at_celda_servicios_auxiliares`, `at_celda_medida`, `at_celda_remonte`.

Multi-segment cells chain apparatus in series via an intermediate pin `MID`, so each apparatus is its own `always_closed` segment on the cell's line:

| type | archetype | pins | contacts |
|---|---|---|---|
| `at_celda_interruptor_seccionador_fusible` | E (2 seg: disconnector + fuse) | `IN (30,0)`, `MID (30,30)` kind `power`, `OUT (30,60)` | `[{ pins:['IN','MID'], behavior:'always_closed' }, { pins:['MID','OUT'], behavior:'always_closed' }]` |
| `at_celda_interruptor_seccionador_interruptor_automatico` | E (2 seg: disconnector + breaker) | same 3-pin | same 2-segment |
| `at_celda_medida` | C (measurement tap) | `IN (30,0)`/`OUT (30,60)` | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `at_celda_remonte` | C (riser/link) | `IN (30,0)`/`OUT (30,60)` | `[{ pins:['IN','OUT'], behavior:'always_closed' }]` |
| `at_celda_servicios_auxiliares` | E + B (fuse segment + isolated secondary) | `IN (30,0)`, `MID (30,30)`, `OUT (30,60)`, plus isolated `AUX (60,30)` kind `power` | `[{ pins:['IN','MID'], behavior:'always_closed' }, { pins:['MID','OUT'], behavior:'always_closed' }]` (AUX intentionally has no bridging segment — the transformer secondary is galvanically isolated) |

> **`at_celda_servicios_auxiliares` — spec flags this as the most structurally complex entry, needing detailed review with Zuzo at implementation time.** The layout above (a series fuse on the main line + an isolated auxiliary transformer secondary tap) is a reasonable first model; **pause and confirm with Zuzo before finalizing it.** All `60×60`, `category:'electrical'`, label `AT`.

- [ ] Step A: Author the 5 SVGs (60×60 bordered box; for E-cells draw each apparatus glyph on its own line segment with the `MID` pin marker at the junction).
- [ ] Step B: Add 5 `library.ts` entries per the table.
- [ ] Step C: Append the 5 types to `ALL_TYPES`.
- [ ] Step D: `npx vitest run tests/symbols/symbolRegistry.test.ts` → PASS.
- [ ] Step E: `npm run type-check && npm run lint && npm run test` → PASS.
- [ ] Step F: Commit `feat(symbols): AT multi-segment cells + medida/remonte (5 types)`.

---

## Task 9: Art-only swaps (`bt_motor` → `motor_3p`, `bt_interruptor_automatico` → `circuit_breaker_3p`)

**Files:** `assets/symbols/motor_3p.svg` (overwrite art), `assets/symbols/circuit_breaker_3p.svg` (overwrite art). NO `library.ts` change, NO parity-list change (types already registered).

Spec Decision #3: keep the existing `type`, pins, and contacts unchanged — replace ONLY the `layer:base` (and existing contact/energized layers) artwork, redrawn from `assets/symbols/unifilares/bt_motor.svg` / `bt_interruptor_automatico.svg` but **re-fit to the existing footprints and pin coordinates** (`motor_3p` 60×60 with U/V/W at x=15/30/45 y=0; `circuit_breaker_3p` 60×40 with its 6 poles). The `<g id="pins">` block and any `contact-*`/`energized` layers + `stateLayers` metadata MUST be preserved exactly (parity test still checks them).

- [ ] Step 1: Read current `assets/symbols/motor_3p.svg` and `assets/symbols/circuit_breaker_3p.svg` to preserve their pins/layers/metadata blocks verbatim.
- [ ] Step 2: Redraw only `layer:base` paths using the unifilar glyph, keeping viewBox + pins + other layers identical.
- [ ] Step 3: `npx vitest run tests/symbols/symbolRegistry.test.ts` → PASS (pins/viewBox unchanged, so parity holds).
- [ ] Step 4: `npm run type-check && npm run lint && npm run test` → PASS.
- [ ] Step 5: Commit `feat(symbols): swap motor_3p/circuit_breaker_3p to unifilar artwork`.

---

## Task 10: Catalog docs + final verification

**Files:** `docs/symbols/component-symbols.md` (modify), `docs/component-catalog.md` (modify).

- [ ] Step 1: Append every new type's pin/borne layout to `docs/symbols/component-symbols.md` (it already documents the existing 17; extend to 69), grouped by the 8 palette categories.
- [ ] Step 2: Add borne-numbering notes for the new types to `docs/component-catalog.md` where the catalog has a matching category section (spec Decision #8 — that doc is the borne-numbering source of truth).
- [ ] Step 3: Full verification suite:

Run: `npm run type-check && npm run lint && npm run test && npm run build`
Expected: ALL PASS. Parity test registers exactly 69 symbol types (`listSymbolTypes().length === 69`).

- [ ] Step 4: Manual visual pass (per spec Verification Plan): `npm run dev`, open the palette, confirm 8 collapsible categories, and drag one component per archetype (A source, B transformer, C fuse, D iluminación, E AT fusible cell, F relay 27) onto the canvas — confirm each renders its glyph, pins are on-grid, and a source→C→D chain simulates (source glows, load lights). Fix any pin-off-grid or invisible-glyph issues found.
- [ ] Step 5: Commit `docs: catalog + symbol reference for 52 unifilar types` and note in CLAUDE.md's implementation-status section that the unifilar integration is complete.

---

## Self-Review

**Spec coverage:**
- Decision #1 (move SVGs to glob root) → realized as author-in-place (Global Constraints explains why moving raw files breaks parity); ✅ covered.
- Decision #2 (verbatim filenames) → Global Constraints + every task uses type-id filenames. ✅
- Decision #3 (2 art-only swaps) → Task 9. ✅
- Decision #4 (delete old placeholder SVGs for swaps) → Task 9 overwrites them in place (equivalent). ✅
- Decision #5 (exclude `at_caja_celda_flechas_numeros`) → Global Constraints. ✅
- Decision #6 (AT cells one-component-per-cell, multi internal segments) → Tasks 7–8. ✅
- Decision #7 (palette by category, collapsible, existing types folded) → Task 1 + categories.ts. ✅
- Decision #8 (update component-catalog.md) → Task 10. ✅
- Decision #9 (no solver/circuit.ts changes) → Global Constraints; categories.ts avoids touching the `category` union. ✅
- All 7 archetypes A–G → archetype recipe table + per-task tables (G = the single excluded annotation, no entry). ✅
- All 55 symbols: 2 swaps (Task 9) + 52 new (Tasks 2–8: 15+7+7+6+7+5+5 = 52) + 1 excluded = 55. ✅

**Placeholder scan:** Per-symbol library data (type/pins/contacts/category/footprint) is fully specified. The one deliberately open item is `at_celda_servicios_auxiliares`'s internal layout (spec itself flags it for Zuzo review) — Task 8 pauses on it rather than guessing silently. Base-layer glyph art is authored from the committed raw source SVGs (referenced by exact path per task) — not a placeholder, a redraw with a concrete source.

**Type consistency:** `categoryForType`/`CATEGORY_BY_TYPE`/`PALETTE_CATEGORIES` names are consistent across Task 1 definition and the palette consumer. `ALL_TYPES` replaces `MIGRATED_TYPES`/`WEEK2_TYPES` once (Task 2) and is appended thereafter. Pin ids `IN`/`OUT`/`MID`/`L`/`PE`/`+` and contact `pins` arrays match between each library table and its SVG `<g id="pins">`.

**Count check:** Tasks 2–8 append 15+7+7+6+7+5+5 = 52 types to `ALL_TYPES`; plus the 17 existing = 69. Matches Task 10's `listSymbolTypes().length === 69`.
