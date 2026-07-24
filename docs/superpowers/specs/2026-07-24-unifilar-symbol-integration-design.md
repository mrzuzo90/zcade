# Integración de símbolos unifilares (ADG sheet) como componentes simulables

Status: approved by Zuzo 2026-07-24. Feeds into an implementation plan (writing-plans).

## Context

The `/unifilar` skill (commit `fda988d`) extracted 55 pure-vector single-line-diagram
symbols from `simbolos.pdf` (ADG, oct 2023) into `assets/symbols/unifilares/*.svg`,
cataloged by category in `assets/symbols/unifilares/index.json`. These are
catalog-only today: no pins, no state layers, and outside `symbolRegistry.ts`'s
non-recursive glob, so nothing registers them and they aren't usable as
components in the canvas/solver.

Zuzo's direction: these are the **normalized symbols to use going forward**, and
where one overlaps conceptually with an existing Tier 1 component (`library.ts`),
it should **replace** that component's placeholder artwork. All 55 are to be
integrated in one design/plan pass (not split into a first batch).

## Decisions

1. **File placement**: move all 55 SVGs from `assets/symbols/unifilares/` to
   `assets/symbols/` (the registry's existing non-recursive glob root). No
   change to `symbolRegistry.ts` or its parity tests. `index.json` path
   references updated accordingly.
2. **Naming**: new component `type` ids are the extracted filenames verbatim
   (snake_case, category-prefixed: `bt_`, `at_`, `protecciones_rele_`) — no
   translation to the existing mixed English/Spanish convention.
3. **Overlap with existing catalog**: only two symbols have a clean 1:1
   conceptual match to an existing `library.ts` type. For those, the existing
   `type`, pins, and `ContactSegment`s are **kept unchanged** — only the SVG
   artwork is replaced (redrawn to the existing pin coordinates):
   - `bt_motor.svg` → replaces `motor_3p.svg`
   - `bt_interruptor_automatico.svg` → replaces `circuit_breaker_3p.svg`

   All other superficially-similar existing types (`lamp`, `timer_ton`,
   `power_source_3p`/`_dc`/`_1p`) are left untouched; the corresponding new
   unifilar symbols (`bt_iluminacion`, `bt_interruptor_temporizador`,
   `bt_generador_ca`, `bt_bateria_almacenamiento`, `bt_linea_*`, etc.) are
   independent new types rather than forced merges — the unifilar symbol
   represents a whole line/feeder/source at a coarser abstraction level than
   the existing pin-level component, and forcing a merge would misrepresent
   either one.
4. **Old placeholder SVGs for the 2 swapped types are deleted**, not archived.
5. **`at_caja_celda_flechas_numeros` is excluded from the component catalog.**
   It's diagram annotation (arrows + legend numbers for labeling AT cell
   diagrams on the source sheet), not a physical apparatus — no pins, no
   `library.ts` entry.
6. **AT cells modeled as one component per cell**, with multiple internal
   `ContactSegment`s (one per apparatus the cell physically contains:
   disconnector, breaker, fuse, etc.) — reflects that a cell is installed and
   operated as one physical unit, and lets each internal apparatus still have
   its own live open/closed state.
7. **Palette reorganization**: `ComponentPalette.tsx` groups components into
   collapsible sections by the `index.json` categories (`baja_tension`,
   `alta_tension`, `protecciones`, `lineas`, `maquinas`, `medida`), with the
   existing Tier 1 types folded into the same scheme (rather than keeping a
   flat list, which doesn't scale past ~70 types).
8. **`docs/component-catalog.md` updated** with all new types' pin/borne
   numbering, per CLAUDE.md's directive that this doc is the source of truth
   for that.
9. **No changes to `engine/solver.ts` or `types/circuit.ts`.** Every archetype
   below is expressible with mechanisms that already exist (`PinDefinition.potential`,
   `ContactSegment.control` values already supported, and the solver's
   existing "derive role from pin shape" logic for lamp-like loads).

## Pin Archetypes

53 new types (55 minus the 2 swaps) are classified into 7 reusable patterns
rather than each getting a bespoke design:

| Archetype | Model | Examples |
|---|---|---|
| **A — Source** | Pins carry a fixed `PotentialTag`, no contacts (same pattern as `power_source_3p`/`_dc`) | `bt_generador_ca`, `bt_bateria_almacenamiento`, `bt_modulos_fotovoltaicos`, `bt_puesta_a_tierra` (1 pin, PE) |
| **B — Isolated** | Pins declared, deliberately **no** `ContactSegment` bridging them (galvanic isolation / non-conduction in normal operation, not modeled quantitatively) | `bt_transformador`, `at_transformador_at_bt`, `bt_inversor`, `bt_bateria_condensadores`, `bt_protector_sobretensiones`, `bt_sumador_intensidades` |
| **C — Passthrough** | One `ContactSegment` per conductor, `control: 'always_closed'` (same pattern as `terminal_strip`); multi-conductor types get one segment per conductor; busbars get a chain of segments across taps | lines, socket, disconnectors/switches, fuses, RCD, breaker+relay, protection panels/boxes, meters/wattmeters, busbar, DC regulator |
| **D — Signal load** | Exactly 2 `kind: 'signal'` pins, no contacts — reuses the solver's existing generic `lit` derivation with zero solver changes | `bt_iluminacion`, `bt_indicador` |
| **E — Multi-segment cell** | Several `always_closed` `ContactSegment`s internally, one per apparatus the cell contains, in series along the cell's line pins | the 6 AT cell types |
| **F — Relay placeholder** | `control: 'tripped'`, always false for now (no voltage/current magnitude modeling exists yet — matches the Phase 3 scope decision) | ANSI protection relays 27/57/59/59N/64/81/87 |
| **G — Excluded (annotation)** | Not given a `library.ts` entry | `at_caja_celda_flechas_numeros` only |

## Full Mapping Table

**Swap (existing type, new art only)**
| Symbol | Replaces |
|---|---|
| `bt_motor` | `motor_3p` |
| `bt_interruptor_automatico` | `circuit_breaker_3p` |

**New — baja_tensión**
| type | Archetype |
|---|---|
| `bt_puesta_a_tierra` | A (1 pin, PE) |
| `bt_enchufe` | C |
| `bt_iluminacion` | D |
| `bt_resistencia` | C |
| `bt_cuadro_de_protecciones` | C (multi-conductor) |
| `bt_caja_seccionamiento` | C (multi-conductor) |
| `bt_caja_general_proteccion` | C (multi-conductor) |

**New — protecciones**
| type | Archetype |
|---|---|
| `bt_seccionador` | C |
| `bt_interruptor_seccionador` | C |
| `bt_fusible` | C |
| `bt_fusible_seccionable` | C |
| `bt_interruptor_diferencial` | C |
| `bt_interruptor_automatico_rele` | C |
| `bt_protector_sobretensiones` | B |
| `bt_interruptor_temporizador` | C |
| `protecciones_rele_27_tension_minima` | F |
| `protecciones_rele_57_cortocircuito` | F |
| `protecciones_rele_59_tension_maxima` | F |
| `protecciones_rele_59n_tension_maxima_homopolar` | F |
| `protecciones_rele_64_fallo_tierra` | F |
| `protecciones_rele_81_frecuencia` | F |
| `protecciones_rele_87_diferencial` | F |

**New — máquinas**
| type | Archetype |
|---|---|
| `bt_bateria_condensadores` | B |
| `bt_transformador` | B |
| `bt_modulos_fotovoltaicos` | A |
| `bt_inversor` | B |
| `bt_regulador_cc` | C |
| `bt_bateria_almacenamiento` | A |
| `bt_generador_ca` | A |

**New — líneas**
| type | Archetype |
|---|---|
| `bt_embarrado` | C (chained taps) |
| `bt_linea_monofasica` | C (3 conductors: F/N/T) |
| `bt_linea_trifasica_f` | C (3 conductors) |
| `bt_linea_trifasica_fn` | C (4 conductors) |
| `bt_linea_trifasica_fnt` | C (5 conductors) |
| `bt_linea_cc` | C (2 conductors) |
| `bt_linea_cc_tierra` | C (3 conductors) |

**New — medida**
| type | Archetype |
|---|---|
| `bt_medidor_directo` | C |
| `bt_medidor_indirecto` | C |
| `bt_vatimetro_directo` | C |
| `bt_vatimetro_indirecto` | C |
| `bt_sumador_intensidades` | B |
| `bt_indicador` | D |
| `at_celda_medida` | C |

**New — alta_tensión**
| type | Archetype | Internal segments |
|---|---|---|
| `at_celda_interruptor_automatico` | E | 1 (breaker) |
| `at_celda_interruptor_seccionador` | E | 1 (disconnector-switch) |
| `at_celda_interruptor_seccionador_fusible` | E | 2 (disconnector-switch + fuse) |
| `at_celda_interruptor_seccionador_telecontrol` | E | 1 (disconnector-switch) + cosmetic remote-control badge |
| `at_celda_interruptor_seccionador_seccionalizadora` | E | 1 (disconnector-switch, sectionalizer flag) |
| `at_celda_interruptor_seccionador_interruptor_automatico` | E | 2 (disconnector-switch + breaker) |
| `at_celda_servicios_auxiliares` | E + B | 1 segment (fuse) + isolated secondary — **flagged as needing detailed review with Zuzo at implementation time**, most structurally complex entry in this batch |
| `at_celda_remonte` | C | riser/link span |
| `at_transformador_at_bt` | B | — |

**Excluded**: `at_caja_celda_flechas_numeros` (diagram annotation, no component entry).

## Verification Plan

- Extend `tests/symbols/symbolRegistry.test.ts` pin/viewBox parity coverage
  from 17 to 69 types (17 existing + 52 new; the 2 swapped symbols replace
  existing entries' artwork without adding new types; `at_caja_celda_flechas_numeros`
  is excluded and doesn't count toward either total).
- Add `library.ts` entries for all 52 new types; update the SVG artwork only
  (no `library.ts` change) for the 2 art-only swaps.
- Author each SVG's `<g id="pins">`, `layer:` groups, and (for archetypes C/E/F)
  `contact-<a>-<b>-open/closed` layers per `schema.md`'s existing convention.
- Update `docs/component-catalog.md` with borne numbering for all new types.
- Restructure `ComponentPalette.tsx` into collapsible category sections.
- Final checks: `npm run type-check`, `npm run lint`, `npm run test`,
  `npm run build`, plus a manual visual pass in `npm run dev` exercising at
  least one component per archetype (A–F) and one AT cell.

## Explicitly Out of Scope

- No changes to `engine/solver.ts`'s magnitude/short-circuit modeling — relay
  archetype F stays a static placeholder until a future quantitative-modeling
  phase.
- No ERC rules for the new types (separate, not-yet-started ERC role per
  `CLAUDE.md`).
- No i18n work (separate outstanding item, unrelated to this design).
