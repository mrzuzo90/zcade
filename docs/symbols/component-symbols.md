# Component Symbol Catalog

Every component type currently registered in `src/components/symbols/library.ts`
with an authored SVG symbol under `assets/symbols/`, listed with its full pin
layout. This is a generated-by-hand reference kept in sync with `library.ts` by
`tests/symbols/symbolRegistry.test.ts` (viewBox/pin/contact parity fails CI on
drift) — if the two ever disagree, `library.ts` is the runtime source of
truth, this document is wrong and needs updating.

See `src/components/symbols/schema.md` for how to author a new symbol SVG,
and `docs/component-catalog.md` for the domain-level (pre-implementation)
pin/borne numbering catalog this library draws from.

Columns: **Pin** (id as wired in `.zcade`/the wire store) · **Kind**
(`PinKind`, drives pin dot color and solver role derivation) · **Offset**
(`x,y` px at rotation 0, top-left origin) · **Potential** (fixed source
potential, power-source pins only).

---

## Power sources

### `power_source_3p` — label `L1-3`, 60×30

3-phase AC source.

| Pin | Kind | Offset | Potential |
|---|---|---|---|
| L1 | power | 0,30 | L1 |
| L2 | power | 30,30 | L2 |
| L3 | power | 60,30 | L3 |

### `power_source_dc` — label `24V`, 40×30

DC source.

| Pin | Kind | Offset | Potential |
|---|---|---|---|
| +24V | power | 0,30 | DC_POS |
| 0V | power | 40,30 | DC_0 |

### `power_source_1p` — label `L-N-PE`, 60×30 *(Week 2)*

Single-phase AC source (L/N/PE, CLAUDE.md's Power Source Pins table). The `L`
pin uses the `L1` potential tag — `PotentialTag` has no generic "L" value.

| Pin | Kind | Offset | Potential |
|---|---|---|---|
| L | power | 0,30 | L1 |
| N | power | 30,30 | N |
| PE | power | 60,30 | PE |

---

## Protection & switching

### `circuit_breaker_3p` — label `Q`, 60×40

3-pole breaker. Always-closed pass-through poles (no trip modeling).

| Pin | Kind | Offset |
|---|---|---|
| 1 | power | 0,10 |
| 2 | power | 60,10 |
| 3 | power | 0,20 |
| 4 | power | 60,20 |
| 5 | power | 0,30 |
| 6 | power | 60,30 |

Contacts: `1-2`, `3-4`, `5-6` — all `always_closed`.

### `thermal_overload_relay` — label `F`, 60×60 *(Week 2 art)*

Pass-through power poles plus a trip-driven NC seal-in-break contact and a
trip-driven NO fault-signal contact (both `control: 'tripped'`, opposite
polarity — see the symbol's red/green open-state coloring for how they stay
visually distinguishable).

| Pin | Kind | Offset |
|---|---|---|
| 1 | power | 0,10 |
| 2 | power | 60,10 |
| 3 | power | 0,20 |
| 4 | power | 60,20 |
| 5 | power | 0,30 |
| 6 | power | 60,30 |
| 95 | auxiliary_nc | 0,40 |
| 96 | auxiliary_nc | 60,40 |
| 97 | auxiliary_no | 0,50 |
| 98 | auxiliary_no | 60,50 |

Contacts: `1-2`/`3-4`/`5-6` `always_closed`; `95-96` `nc, control: tripped`;
`97-98` `no, control: tripped`.

### `terminal_strip` — label `X`, 60×20 *(Week 2)*

4-terminal borne strip. Purely a physical splice point — each terminal's top
and bottom pin are bridged by an `always_closed` contact.

| Pin | Kind | Offset |
|---|---|---|
| 1 | power | 0,0 |
| 1B | power | 0,20 |
| 2 | power | 20,0 |
| 2B | power | 20,20 |
| 3 | power | 40,0 |
| 3B | power | 40,20 |
| 4 | power | 60,0 |
| 4B | power | 60,20 |

Contacts: `1-1B`, `2-2B`, `3-3B`, `4-4B` — all `always_closed`.

---

## Contactors & relays

### `contactor_3p` — label `KM`, 60×80

3-pole contactor. Power poles close when the instance's own coil (A1-A2)
energizes.

| Pin | Kind | Offset |
|---|---|---|
| 1 | power_no | 0,10 |
| 2 | power_no | 60,10 |
| 3 | power_no | 0,40 |
| 4 | power_no | 60,40 |
| 5 | power_no | 0,70 |
| 6 | power_no | 60,70 |
| A1 | coil | 30,0 |
| A2 | coil | 30,80 |

Contacts: `1-2`, `3-4`, `5-6` — all `no, control: coil`.

### `contactor_4p` — label `KM`, 60×80 *(Week 2)*

Same coil/contact shape as `contactor_3p`, one more pole (pole spacing
tightened to 20px to fit 4 in the same footprint).

| Pin | Kind | Offset |
|---|---|---|
| 1 | power_no | 0,10 |
| 2 | power_no | 60,10 |
| 3 | power_no | 0,30 |
| 4 | power_no | 60,30 |
| 5 | power_no | 0,50 |
| 6 | power_no | 60,50 |
| 7 | power_no | 0,70 |
| 8 | power_no | 60,70 |
| A1 | coil | 30,0 |
| A2 | coil | 30,80 |

Contacts: `1-2`, `3-4`, `5-6`, `7-8` — all `no, control: coil`.

### `aux_contact_block_no` — label `KM`, 40×20 *(Week 2 art)*

No coil pins of its own — tracks a *different* instance's coil via
`ContactSegment.linkedTo` / `instance.properties.linkedTo` (cross-instance
resolution, see `types/circuit.ts`).

| Pin | Kind | Offset |
|---|---|---|
| 13 | auxiliary_no | 0,10 |
| 14 | auxiliary_no | 40,10 |

Contacts: `13-14` — `no, control: coil`.

### `aux_contact_block_nc` — label `KM`, 40×20 *(Week 2 art)*

Same cross-instance mechanism as `aux_contact_block_no`, NC.

| Pin | Kind | Offset |
|---|---|---|
| 21 | auxiliary_nc | 0,10 |
| 22 | auxiliary_nc | 40,10 |

Contacts: `21-22` — `nc, control: coil`.

### `timer_ton` — label `KT`, 40×40 *(Week 2 art)*

On-delay timer: bundles the A1-A2 coil with its own 55-56 (NO) / 57-58 (NC)
timed contacts (always self-referential — never a cross-instance
`linkedTo`). `instance.properties.presetMs` sets the delay (defaults to
`DEFAULT_TON_PRESET_MS`, 3000ms).

| Pin | Kind | Offset |
|---|---|---|
| A1 | coil | 0,0 |
| A2 | coil | 40,0 |
| 55 | auxiliary_no | 0,20 |
| 56 | auxiliary_no | 40,20 |
| 57 | auxiliary_nc | 0,40 |
| 58 | auxiliary_nc | 40,40 |

Contacts: `55-56` `no, control: timed`; `57-58` `nc, control: timed`.

### `emergency_stop` — label `S`, 40×20 *(Week 2 art)*

Latching (mushroom-head, twist-to-release) e-stop. Pressing it drives a
persistent solver-derived `latched` state, not the momentary `pressed` alone
— stays open across ticks until an explicit `resetRequested`.

| Pin | Kind | Offset |
|---|---|---|
| 1 | auxiliary_nc | 0,10 |
| 2 | auxiliary_nc | 40,10 |

Contacts: `1-2` — `nc, control: latched`.

---

## Manual switches

### `push_button_no` — label `S`, 40×20

| Pin | Kind | Offset |
|---|---|---|
| 13 | auxiliary_no | 0,10 |
| 14 | auxiliary_no | 40,10 |

Contacts: `13-14` — `no, control: pressed`.

### `push_button_nc` — label `S`, 40×20

| Pin | Kind | Offset |
|---|---|---|
| 21 | auxiliary_nc | 0,10 |
| 22 | auxiliary_nc | 40,10 |

Contacts: `21-22` — `nc, control: pressed`.

---

## Loads

### `motor_3p` — label `M`, 60×60

3-terminal (U/V/W) motor, fixed internal Y/Δ winding. Role/rotor animation
derived generically from having exactly 3 `power` pins with no `potential`
and no `contacts`.

| Pin | Kind | Offset |
|---|---|---|
| U | power | 15,0 |
| V | power | 30,0 |
| W | power | 45,0 |

### `motor_3p_6wire` — label `M`, 90×60 *(Week 2 art)*

6-terminal motor: external jumpering of U2/V2/W2 (not any internal switch)
selects Star vs Delta — see `detectMotorWiring()` in `engine/solver.ts`. Both
top (line feed) and bottom (winding end) terminals render on the symbol; the
animated rotor and a small Y/Δ badge (`ComponentSymbol.tsx`) both key off
this component's solved `motorRunning`/`motorWiring`.

| Pin | Kind | Offset |
|---|---|---|
| U1 | power | 15,0 |
| V1 | power | 30,0 |
| W1 | power | 45,0 |
| U2 | power | 15,60 |
| V2 | power | 30,60 |
| W2 | power | 45,60 |

### `lamp` — label `H`, 30×30

Signal lamp. `instance.properties.color` (`red`/`green`/`yellow`/`blue`/
`white`, `LAMP_COLORS` in `library.ts`) picks the lens fill color — defaults
to `red` (`DEFAULT_LAMP_COLOR`) for unset/unrecognized values. Cosmetic only;
`lit` derivation is unaffected by `color`.

| Pin | Kind | Offset |
|---|---|---|
| 1 | signal | 15,0 |
| 2 | signal | 15,30 |

---

## Adding to this document

When you add a new type to `COMPONENT_LIBRARY`, add a section here with the
same table shape. `tests/symbols/symbolRegistry.test.ts` will fail CI if the
symbol's pins ever drift from `library.ts` — it does **not** check this
document, so keeping it current is a manual step (unlike the pins/viewBox
themselves, which can't drift silently).
