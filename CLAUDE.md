# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview: zCADe

**zCADe: The next-generation industrial schematics & simulation suite.**

zCADe is a modern, open-source, cross-platform industrial schematics and simulation application that succeeds the legacy CADe SIMU ecosystem. It provides a unified environment for electrical schematics, pneumatic logic, PLC programming, and 2D interactive process simulation.

**Key Goals:**
- Cross-platform (Windows, macOS, Linux, Web)
- Real-time electrical, pneumatic, and PLC simulation
- Modern UI/UX with infinite canvas, dark/light themes, and auto-routing
- Open JSON-based file format (`.zcade` or `zcade.json`)
- Extensible component plugin architecture

### Historical Context & Mission
**CADe SIMU** was created by Prof. Juan Luis Villanueva Montoto (CanalPLC) and remains the de facto standard for electrical automation education in Spanish-speaking technical schools and universities. The most widely deployed version is V4.0–V4.2 (Windows-only freeware, no longer maintained). 

**zCADe** is a dignified successor: a modern, cross-platform, open-source replacement for users who:
- Require macOS/Linux native support (educators & technicians outside Windows)
- Need extensibility and plugin architecture for domain-specific components
- Want an open-source alternative for integration in educational environments
- Require offline-first operation in classrooms and industrial settings without internet connectivity

The name "zCADe" signals both a respectful nod to CADe SIMU's legacy and a forward-looking vision: "z" as in the final evolution, the complete next chapter.

---

## Technology Stack & Architecture

### Frontend & Desktop Shell
- **Tauri 2.0**: Lightweight cross-platform desktop shell (~15MB binary, minimal footprint)
- **React 19 + TypeScript**: Modern UI framework with strict typing
- **Tailwind CSS + Shadcn UI**: Styling and accessible UI component patterns
- **Konva.js / HTML5 Canvas**: High-performance canvas rendering for 1000+ components
- **Zustand**: Reactive state management for canvas and simulation state (decoupled from UI renders)
- **Vite**: Fast build tooling

### Simulation Engines (TypeScript — pure, no Rust/Wasm required for V1.0)
- **Electrical Solver**: Topological graph-based voltage/current propagation (NOT matrix-based MNA—simpler for educational circuits)
- **Pneumatic/Hydraulic Solver**: Discrete fluid state solver for pressure flow
- **PLC Runtime**: Siemens LOGO! and S7-1200/S7-300 models with cyclic execution (10ms-100ms ticks)
- **GRAFCET Engine**: SFC (Sequential Function Chart) execution with steps, transitions, and actions

**Technology Choice Rationale**:
- **TypeScript vs Rust/Wasm**: Educational and industrial schematics typically contain 100–500 components. Topological graph evaluation in TypeScript is instantaneous (<5ms per tick at 50Hz). Rust/Wasm migration is deferred to Phase 4+, if ever needed for large-scale fluid dynamics or numerical modeling.
- **Graph-based Solver vs MNA Matrix**: Simpler to understand, test, and visualize for educational contexts. Avoids dense linear algebra libraries; circuit validation is more transparent.
- **Simulation Tick Rate**: 50Hz (20ms) is optimal—fast enough for visual contactor switching and PLC response, slow enough for UI update batching without frame drops.

### Directory Structure (after Phase 1)
```
src/
├── engine/              # All simulation solvers
│   ├── electrical/      # Voltage propagation, circuit graph
│   ├── pneumatic/       # Fluid dynamics
│   ├── plc/             # LOGO!, S7-1200 models, GRAFCET
│   └── graph.ts         # Topological circuit graph builder
├── components/
│   ├── ui/              # Radix/Shadcn UI components
│   └── symbols/         # Electrical/pneumatic component library
├── store/               # Zustand state management
│   ├── canvas.ts        # Canvas state (components, wires, zoom)
│   ├── simulation.ts     # Simulation loop state
│   └── undo.ts          # Undo/redo history stack
├── pages/               # React page components
└── types/               # TypeScript interfaces
tests/
├── engine/              # Unit tests for simulation logic
└── integration/         # Canvas and workflow tests
```

---

## Core Architecture Concepts

### 1. **Topological Circuit Graph**
Every electrical schematic is modeled as a directed graph where:
- **Nodes** represent net groups (groups of pins electrically connected by wires)
- **Edges** represent power/signal flow through components
- Component pins are indexed (e.g., Contactor `KM1` has pins: `1`, `2`, `3`, `4`, `5`, `6`, `A1`, `A2`)
- The graph builder runs after wire changes to determine voltage propagation paths

**Key Files** (when implementing):
- `src/engine/graph.ts` — topological graph builder and net grouping logic
- `src/types/circuit.ts` — NodeNet, ComponentPin interfaces

### 2. **Real-Time Electrical Solver (50Hz/60Hz Tick)**
During each simulation tick:
1. Identify all power source voltages (3-phase AC, DC supplies, transformers)
2. Propagate voltage through closed switch contacts and contactor main contacts
3. Evaluate coil energization states (A1-A2 potential difference)
4. Update contactor linked contact states (NO contacts close, NC contacts open when coil active)
5. Compute motor phase presence and animate rotor

**Power Source Pins**:
- 3-Phase: L1 (Brown), L2 (Black), L3 (Grey) — 120° phase shift
- Single-Phase: L (Brown), N (Blue), PE (Green-Yellow)
- DC: +24V (Red), 0V (Blue/Black)

**Contactor Logic Example**:
```
IF KM1.coil (A1-A2) is energized
  THEN close all KM1 power NO contacts (1→2, 3→4, 5→6)
  AND open all KM1 power NC contacts (if any)
  AND update linked auxiliary contacts with tag "KM1"
```

### 3. **Component Pinout Standard**
All electrical components follow a strict pinning convention:

**Contactor (3-pole, 24VDC coil)**:
```
Power contacts: [1↔2, 3↔4, 5↔6]  (NO — normally open)
Coil pins: [A1, A2]
Auxiliary contacts (if present): [13↔14] (NO), [21↔22] (NC)
```

**Thermal Overload Relay**:
```
Input: [1, 3, 5] (3-phase motor terminals)
Output: [2, 4, 6] (to downstream load)
Trip contact: [95↔96] (NO), opens when thermal threshold exceeded
Reset: manual mechanical button
```

**Motor (3-Phase)**:
```
Terminals: [U, V, W] (phase inputs)
Body: draws internal rotor (animated based on phase sequence detection)
Direction: CCW if U→V→W, CW if U→W→V
```

### 4. **Wire System & Auto-Node Creation**
- Wires are drawn as orthogonal polylines (point-to-point routing)
- When a wire crosses an existing wire/pin, automatically create a **junction node** (visual dot)
- **Wire Colors** (standardized):
  - Phase (L1, L2, L3): Brown, Black, Grey
  - Neutral (N): Blue
  - Earth (PE): Green-Yellow
  - DC +24V: Red
  - DC 0V: Blue or Black
- During simulation, live wires highlight (glow effect) when energized

**Key Files** (when implementing):
- `src/engine/wiring.ts` — wire routing and intersection detection
- `src/components/Canvas/WireDrawer.tsx` — wire UI interaction

### 5. **Simulation State Management (Zustand)**
Simulation state is **separate from UI state** to prevent frame drops:
```typescript
// src/store/simulation.ts
export const useSimulation = create((set) => ({
  tick: 0,
  isRunning: false,
  nets: Map<string, Net>,           // circuit nets (voltage states)
  componentStates: Map<string, any>, // coil energization, motor rpm, etc.
  plcMemory: {...},                 // PLC input/output values
  grafcetState: {...},              // active GRAFCET steps
  // solver functions
  evaluateCircuit: () => {},
  evaluatePLC: () => {},
  tick: () => {}
}))
```

The canvas renderer reads simulation state without subscribing to high-frequency updates. Use offscreen canvas or memoization to prevent unnecessary redraws.

---

## Component Library (Core Types)

### Electrical Components
- **Power Sources**: AC 3-phase, AC 1-phase, DC variable, Transformers, Rectifiers
- **Protection**: Circuit Breakers (1P-4P), Fuses, Differential Relays (RCD)
- **Control**: Contactors (KM), Relays (KA), Timers, Push Buttons, Selector Switches
- **Loads**: 3-phase Motors, Single-phase Motors, Solenoids, Signaling Lamps, Buzzers
- **Motor Starters**: Direct-on-line, Star-Delta (Estrella-Triángulo), Dahlander (2-speed), VFD, Soft Starters

### Pneumatic & Hydraulic Components
- **Actuators**: Single-acting, Double-acting cylinders, Rotary actuators
- **Valves**: 3/2, 5/2, 5/3 directional control (Manual, Solenoid, Pneumatic actuation)
- **Sensors**: Magnetic reed switches, Proximity switches, Pressure switches

### PLC & Control Components
- **LOGO! Logic Module**: 24V inputs (I1-I8), Relay/Transistor outputs (Q1-Q4), LCD display
- **S7-1200 / S7-300 PLC**: Modular IO mapping, ladder/FBD execution
- **GRAFCET Runtime**: Steps, transitions, macro-steps, AND/OR branches

---

## File Format: `.zcade`

All projects are stored in a human-readable, version-controlled JSON format:

```json
{
  "version": "1.0.0",
  "meta": {
    "title": "Star-Delta Motor Starter",
    "author": "Zuzo",
    "date": "2026-07-22",
    "sheetSize": "A4",
    "orientation": "landscape",
    "gridSize": 10
  },
  "components": [
    {
      "id": "comp_km1",
      "type": "contactor_3p",
      "label": "KM1",
      "x": 200,
      "y": 150,
      "rotation": 0,
      "properties": {
        "coilVoltage": "24VDC",
        "contacts": [
          { "id": "1", "type": "power_no", "linkedTo": "KM1" },
          { "id": "A1", "type": "coil", "pair": "A2" }
        ]
      }
    }
  ],
  "wires": [
    {
      "id": "wire_1",
      "fromPin": "comp_supply:L1",
      "toPin": "comp_km1:1",
      "points": [[100, 150], [200, 150]],
      "type": "phase_l1",
      "color": "#964B00"
    }
  ],
  "plcPrograms": {
    "logo_1": {
      "type": "LOGO",
      "language": "LADDER",
      "code": "..."
    }
  }
}
```

**Key Design Decisions**:
- Wire connections reference component pins by `componentId:pinId`, not direct coordinates (robust to component moves)
- Component properties include linked contact groups for automatic state propagation
- PLC programs are embedded inline; can be referenced by ID in the simulation engine

---

## Project Roadmap

**For the complete, authoritative roadmap governing all 6 phases (A–F, weeks 1–11, Jul 27 – Oct 9 2026), see `COMPLETE_PROJECT_ROADMAP.md`.**

That document is the **single source of truth** for all development work and is subject to change (see Change Log at end of roadmap). It contains:
- Detailed phase-by-phase breakdown with specialist agent roles
- Critical path analysis and parallelization strategy
- Concrete daily task lists and integration points
- Success criteria (gates) for each phase
- Complete risk register with mitigation plans

### Completed Phases (Prototype)

The working prototype integrates:
- **Phases 1–3** ✅ (commits `68d7383` → `9f714b2`): infinite canvas + grid/zoom, 6 Konva-drawn components, orthogonal wiring with union-find graph, 50 Hz fixed-point electrical solver with seal-in logic, operate-mode UI, 41 passing tests. This serves as the foundation for Phase A of the production roadmap.

---

## Implementation Status (Phase 1)

Completed 2026-07-22. Scaffolded from scratch (empty repo) with `npm create vite@latest . -- --template react-ts`, then `npx tauri init`, `git init`, first commit `68d7383`.

**Environment**: Rust toolchain wasn't present on this machine — installed via `brew install rustup-init` (keg-only formula named `rustup`) + `rustup toolchain install stable`. `PATH` for `/opt/homebrew/opt/rustup/bin` was added to `~/.zshrc` so `cargo`/`rustc` are available in future shells.

**What's in place**:
- `src/store/canvas.ts` — Zustand store: components, selection, scale/position, `GRID_SIZE = 10`px, `snapToGrid()`. All mutations (`addComponent`, `moveComponent`, `rotateComponent`, `zoomAt`, …) live here, not in components.
- `src/types/circuit.ts` — `ComponentDefinition`/`ComponentInstance`/`PinDefinition` etc. Pin offsets and component footprints are in **px directly** (not abstract grid units) — simpler to render with Konva since `GRID_SIZE` is a fixed constant.
- `src/components/symbols/library.ts` — starter `COMPONENT_LIBRARY` with 6 types (contactor_3p, push_button_no/nc, motor_3p, circuit_breaker_3p, lamp), pins per the pinout convention in this doc.
- `src/components/symbols/ComponentSymbol.tsx` — renders one instance. Rotation pivots around the symbol's **center**, not top-left corner (Konva `Group` uses `offsetX/Y = width/2, height/2` with `x/y` shifted to match) — a naive `rotation={instance.rotation}` at the top-left origin swings the box out of place; keep this pattern for any new symbol rendering.
- `src/components/Canvas/CanvasStage.tsx` — Konva `Stage`, pan via native stage dragging, zoom via wheel centered on pointer (`zoomAt`), drop target for drag-and-drop from the palette (converts client coords → world coords using current scale/position). Keyboard: `R` rotate selected (`Shift+R` reverse), `Delete`/`Backspace` remove selected.
- `src/components/Canvas/GridLayer.tsx` — only draws grid lines intersecting the viewport; step size auto-multiplies/divides by 5 to stay legible (12–120px on screen) as you zoom.
- `src/components/Canvas/ComponentPalette.tsx` — sidebar; components are draggable (native HTML5 DnD, `dataTransfer` key `application/x-cadesimu-component`) onto the canvas, or click to add at a fixed point.
- Tailwind v4 (`@tailwindcss/vite` plugin, no `tailwind.config.js` needed) — dark UI by default (`bg-gray-900`/`gray-950` etc.), no light theme yet.
- Path alias `@/*` → `src/*`, wired in both `vite.config.ts` (`resolve.alias`) and `tsconfig.app.json` (`paths`, requires `baseUrl` + `ignoreDeprecations: "6.0"` on current TS version).
- ESLint (flat config) + Prettier replace the Vite scaffold's default Oxlint — matches the `npm run lint`/`npm run format` split this doc specifies.
- Vitest + Testing Library configured via `vite.config.ts` (`import { defineConfig } from 'vitest/config'`, not `'vite'`, so the `test` key type-checks); `tests/integration/canvas-store.test.ts` covers the canvas store (add/move/rotate/remove/zoom/snap).
- `src-tauri/tauri.conf.json`: identifier `com.opencade.cadesimu-next`, window 1440×900 (min 1024×640).

**Not yet built as of Phase 1** (wire drawing/routing, junction nodes, and the topological graph builder were added in Phase 2 — see [Implementation Status (Phase 2)](#implementation-status-phase-2) below): any solver, undo/redo, `.zcade` load/save, light theme.

**Verified working**: `npm run type-check`, `npm run lint`, `npm run test` (7/7 passing), `npm run build`, and `cargo check` in `src-tauri/` all pass. Manually exercised in Chrome via `npm run dev` (add/drag/rotate/select/deselect/delete, palette drag-and-drop, pan, zoom) — not yet run through `npm run tauri dev` (native window), which does a full Rust build and wasn't exercised end-to-end this session.

---

## Implementation Status (Phase 2)

Completed 2026-07-22, directly on top of Phase 1 (commit `2f177aa`).

**What's in place**:
- `src/engine/wiring.ts` — pure geometry/routing helpers: `getPinPosition()` resolves a pin's absolute canvas position accounting for component rotation (mirrors the same center-pivot rotation `ComponentSymbol` uses, via a cardinal-angle `rotatePoint()` — no trig, since rotation is always a multiple of 90°); `routeOrthogonal()` computes a Manhattan (horizontal-then-vertical elbow) route between two points; `getWirePath()` resolves a wire's rendered polyline live from current pin positions (an explicit `wire.points` override is supported but unused by the live editor — see design decision below); `findJunctions()` detects T-taps; `WIRE_TYPE_COLORS` holds the IEC palette from this doc's wire-color table.
- `src/engine/graph.ts` — `buildCircuitGraph()` groups pins into equipotential `NodeNet`s via a small path-compressed union-find, unioning both direct wire endpoints and T-junction taps (see below). Deliberately scoped to static wiring only — it does **not** account for component-internal switching (e.g. an open contactor contact splitting a net), since that depends on live simulation state and belongs to the Phase 3 solver.
- `src/store/wires.ts` — Zustand store: `wires`/`order`/`selectedWireId`/`pendingFrom`. `startWire`/`completeWire`/`cancelWire` implement click-to-start, click-to-finish wire drawing (not click-and-drag). `completeWire` rejects same-pin and duplicate (already-connected, either direction) attempts. `removeWiresForComponent` cascades deletion when a component is removed — callers (CanvasStage, Toolbar) are responsible for calling it alongside `removeComponent`, it is not automatic.
- `src/components/Canvas/WireLayer.tsx` — renders all wires (via `getWirePath`), the dashed in-progress preview line, and junction dots. Selecting a wire highlights every wire in its net (via `buildCircuitGraph`) in accent blue — this is the "net identification" feature; unselected wires render in their assigned `WIRE_TYPE_COLORS` color, or neutral gray if unassigned.
- `src/components/symbols/ComponentSymbol.tsx` — pins gained an invisible radius-8 hit circle (`fill="transparent"`, which Konva still hit-tests) layered under the visible dot, for a forgiving click target. The pin's wire-start/complete logic lives in `onClick`/`onTap` (not `onMouseDown`) — a `mousedown`-only handler was tried first and failed: Konva's synthetic `click` event bubbles to the parent `Group` independently of `cancelBubble` set during `mousedown`, so it still reached the Group's own `onClick` and selected the whole component instead of the pin. `onMouseDown` is kept only to `cancelBubble` there too, preventing the draggable parent Group from initiating a drag.
- `src/components/Canvas/Toolbar.tsx` / `CanvasStage.tsx` — when a wire is selected, the toolbar swaps in a wire-type `<select>` (IEC role → color, via `setWireType`) and an "Eliminar cable" button. `Escape` cancels a pending wire; clicking empty canvas does too (checked before the existing deselect-on-empty-click behavior). Stage panning (`draggable`) is disabled while a wire is pending, so the click-to-place gesture isn't mistaken for a canvas drag.

**Key design decisions**:
- **Wires store only pin references, not fixed coordinates.** `Wire.points` is optional and unused by the live editor — every render recomputes the polyline from current pin positions via `getWirePath()`. This was called out as a requirement in this doc's "Wire System" section ("robust to component moves") and matters concretely: without it, moving a wired component would leave its wires visually detached until some explicit re-route step. The `points` override exists only for a future manual-waypoint-editing feature and for round-tripping a saved `.zcade`.
- **Junction (T-tap) detection is intentionally narrower than "any two wires crossing," and (revised in Phase 3) only ever fires for a manually-routed host wire.** A junction is only created where one wire's *endpoint pin* geometrically lands on the interior of another wire's segment that the user explicitly routed via a manual `points` override — never against an auto-routed elbow. Phase 3's solver tests caught the reason why: on any grid-aligned layout (the norm for ladder-style schematics), an unrelated component's pin routinely ends up sitting on some other wire's auto-routed leg by pure coincidence, and treating that as a real tap silently produced wrong circuits. See the doc comment on `findJunctions` in `engine/wiring.ts`. Two wires that cross without a shared endpoint are rendered as an unmarked crossing (no dot, no arc-hop polish yet).
- **Wire electrical role (L1/L2/L3/N/PE/DC+/DC0/signal) is manually assigned, not inferred**, even though Phase 3 added power-source components and a live solver. `wireType` (cosmetic, edit-time) and the solver's computed net potentials (live, simulation-time) are deliberately two separate systems — see Phase 3 notes below for why they aren't merged.
- **Component pin kinds (`power_no`, `coil`, etc.) are not used to restrict what can be wired together.** Any pin can connect to any other pin at draw time — electrical rule checking (ERC) is out of scope for the wiring layer and would be a later, separate pass.

**Not yet built** (left for later phases): manual wire waypoint editing (so geometric T-junctions are effectively dormant until then), arc-hop rendering for unrelated crossing wires, `.zcade` wire load/save, any pin-kind/ERC validation.

**Verified working**: `npm run type-check`, `npm run lint`, `npm run test` (26/26 passing, including new `tests/engine/wiring.test.ts`, `tests/engine/graph.test.ts`, `tests/integration/wire-store.test.ts`), `npm run build`. Manually exercised in Chrome via `npm run dev`: draw a wire pin-to-pin (start/preview/complete), select a wire and assign an IEC wire-type color from the toolbar, cascade-delete a component's wires on component removal, and cancel a pending wire with `Escape`.

---

## Implementation Status (Phase 3)

Completed 2026-07-23, directly on top of Phase 2 (commit range starting after the Phase 2 CLAUDE.md update).

**What's in place**:
- New component types in `src/components/symbols/library.ts`: `power_source_3p` (pins L1/L2/L3, label "L1-3") and `power_source_dc` (pins +24V/0V, label "24V") — the first components whose pins carry a fixed `potential` (a `PotentialTag`, i.e. the `WireType` set minus `'signal'`). Also added `contacts: ContactSegment[]` to `contactor_3p` (its 3 power poles, each `behavior: 'no'`, `control: 'coil'`), `push_button_no`/`push_button_nc` (`control: 'pressed'`), and `circuit_breaker_3p` (`'always_closed'` — no trip modeling yet).
- `src/types/circuit.ts` — `PotentialTag`, `ContactBehavior`, `ContactSegment`, and `PinDefinition.potential` / `ComponentDefinition.contacts`.
- `src/engine/solver.ts` — `evaluateCircuit(components, wires, previousStates)`, the core Phase 3 deliverable. **This is a fixed-point relaxation, not a single topological pass**: it rebuilds a union-find conduction graph (wires + T-junctions, exactly as `graph.ts`, plus each component's currently-closed `contacts` segments), computes per-net potentials from source pins, derives `coilEnergized`/`lit`/`motorRunning`/`motorDirection`, and repeats up to 8 times per tick. This is necessary, not a nice-to-have: a seal-in (self-hold) control circuit — a contactor's own auxiliary contact wired in parallel with its start button — has a contact whose open/closed state depends on the very coil state it helps determine. Seeding each tick's first iteration from the *previous* tick's `coilEnergized` (not resetting to false) is what makes the seal-in stay latched after the start button is released, and only drop out when the control path is genuinely broken (see the seal-in tests in `tests/engine/solver.test.ts` — idle / latch-and-release / stop-breaks-it / requires-start-again).
- Component "role" (coil / lamp-like load / 3-phase motor load) is **derived from pin kinds already on the component, not a separate declared field**: exactly 2 `kind: 'coil'` pins → coil energization logic; exactly 2 `kind: 'signal'` pins with no `contacts` → lamp `lit` logic; exactly 3 `kind: 'power'` pins with no `potential` and no `contacts` → motor `motorRunning`/`motorDirection`. This keeps the solver generic instead of hardcoding per-`instance.type` behavior, at the cost of requiring careful pin-kind bookkeeping when adding new component types (get it wrong and a component silently gets no runtime state).
- `src/store/simulation.ts` — `useSimulationStore`: `isRunning`, `tickCount`, `pinToNet`/`netPotentials` (this tick's solved graph), `componentStates` (persisted across ticks — this is what makes seal-in work). `start()`/`stop()` manage a `setInterval` at `TICK_MS = 20` (50Hz, per this doc). **`stop()` fully resets `componentStates`/`pinToNet`/`netPotentials`/`tickCount`** — modeled as a cabinet losing supply (everything de-energizes), not a pause. `setPressed(id, pressed)` is the only external input; `tick()` reads `components`/`wires` via `useCanvasStore.getState()`/`useWireStore.getState()` directly (cross-store `getState()` reads, not props) rather than taking them as arguments.
- UI wiring for "operate mode": `Toolbar.tsx` gained a ▶ Simular / ■ Detener button; while `isRunning`, `CanvasStage.tsx`'s keyboard shortcuts, `ComponentPalette.tsx`'s add-component actions, and `Toolbar.tsx`'s rotate/delete buttons are all disabled, and `ComponentSymbol.tsx` sets `draggable={!isRunning}`. This is a deliberate "you can operate switches, but not edit the circuit" mode split, not enforced by a single gate — each interactive surface checks `isRunning` itself.
- `ComponentSymbol.tsx` visuals: body stroke turns amber when `coilEnergized || lit || motorRunning` (reuses the existing `selected` blue-stroke slot's priority — selection still wins visually). Pushbutton-like components (`def.contacts?.some(c => c.control === 'pressed')`) get `onMouseDown`/`onMouseUp`/`onMouseLeave`/touch-equivalents wired to `setPressed` *only* while `isRunning`; otherwise those same events fall through to normal select/drag. `motor_3p` renders an extra rotor (circle + radial line) whose angle is **local component state driven by `requestAnimationFrame`, not simulation-store state** — rotation speed/smoothness is cosmetic and doesn't need to be 50Hz-quantized or reproducible, so it's kept out of the solver entirely (`ROTOR_SPEED` constant, direction sign from `motorDirection`).
- `WireLayer.tsx`: while `isRunning`, a wire whose net has any potential gets a glow (`stroke: '#facc15'`, `shadowBlur`) overriding the edit-time selection/net-highlight colors from Phase 2 (which still apply when not running).
- **Bug found and fixed during this phase**: Phase 2's T-junction detection (`findJunctions`) checked whether *any* wire endpoint pin landed on *any* other wire's auto-routed path — this produced false-positive electrical connections as soon as two unrelated components shared a grid row (extremely common in ladder-style layouts), because `routeOrthogonal`'s elbow bend is an arbitrary algorithmic choice, not something the user placed. Caught by the very first non-trivial solver test (a source wired straight to a coil, with the auto-router's elbow leg incidentally passing under an unrelated pin). Fixed by restricting T-junction hosts to wires with an explicit manual `points` override — see the Phase 2 section above and `findJunctions`' doc comment. Since manual waypoint editing doesn't exist yet, geometric T-junction detection is effectively dormant until it does; existing Phase 2 tests were updated to supply explicit `points` to keep exercising the feature.

**Key design decisions**:
- **Coil/lamp "energized" means the two pins' nets carry non-empty and *different* potential-tag sets — not merely "both connected to something."** Two pins shorted onto the exact same net (same tags) are correctly treated as not energized (no meaningful voltage difference across the load); see `energizedAcross()`/`potentialsEqual()`. This is deliberately a boolean "is there a source-backed loop" check, not real voltage/current magnitude modeling — sufficient for the educational relay-logic circuits this tool targets, and avoids pulling in numeric circuit analysis.
- **No short-circuit or overcurrent detection.** If a net happens to reach two different source potentials in a way that would be a dead short in reality, the solver just reports both tags in that net's potential set and moves on — it doesn't fault, trip, or flag anything. Explicitly out of scope for now.
- **Wire `wireType` (Phase 2, manual/cosmetic) and the solver's `netPotentials` (Phase 3, live/computed) are intentionally not unified.** It would be possible to auto-derive a wire's displayed color from its live net potential when simulating, but the two systems serve different purposes (schematic documentation vs. runtime truth) and merging them would mean a wire's *edit-time* color depends on whether a simulation happens to be running — confusing. The energized-glow overlay in `WireLayer` achieves the "show me what's live" need without touching `wireType`.
- **Motor direction detection only recognizes a clean 3-phase L1/L2/L3 wiring** (`motorDirection()` in `solver.ts` checks for exactly 3 distinct `PotentialTag`s all drawn from `['L1','L2','L3']`); anything else (DC source, missing phase, non-standard tags) reports `'unknown'` rather than guessing.

**Not yet built** (left for later phases): trip/overload modeling for `circuit_breaker_3p` (always closed), remotely-wired auxiliary contact blocks sharing a coil's reference tag via `linkedTo` across *different* component instances (today a contactor's contacts are only ever controlled by that same instance's own coil — see the code comment on `contactor_3p` in `library.ts`), any PLC/GRAFCET logic (Phase 4), short-circuit/overcurrent detection, real voltage/current magnitude simulation.

**Verified working**: `npm run type-check`, `npm run lint`, `npm run test` (41/41 passing, including new `tests/engine/solver.test.ts` and `tests/integration/simulation-store.test.ts`), `npm run build`. Manually exercised in Chrome via `npm run dev`: built a source → breaker → motor circuit, started the simulation and confirmed wires glow amber, the motor body outlines amber, and the rotor visibly rotates and keeps advancing frame over frame; confirmed Detener fully de-energizes everything (wires/motor back to neutral, rotor freezes); confirmed Rotar/Eliminar are disabled and dragging is blocked on a selected component while running.

---

## Critical Requirements & Constraints

### Offline-First & Connectivity
- **Requirement**: 100% functional offline. Many classrooms, workshops, and industrial plants lack stable internet.
- **Implication**: No cloud sync, no remote AI analysis, no mandatory authentication. All features work with Tauri's local execution model.
- **Exception**: Optional cloud export/sync may be added post-V1.0 as opt-in feature.

### User Base & Scale
- **Target Users**: FP/University students, educators, electrical technicians, automation engineers
- **Typical Project Scale**: 100–500 components per schematic (standard for industrial control cabinets)
- **Performance Requirement**: Render and simulate circuits with 500+ components at 60 FPS canvas, 50Hz solver tick
- **Implication**: No heavy matrix computations in hot loops; lazy evaluation where possible

### Canvas & Interaction
- **Konva.js Rationale**: Hierarchical node management (pin groups, rotated symbols), multiple layers (grid, wires, components, UI overlays). Superior to raw Canvas or Fabric.js for CAD-like precision and interactivity.
- **Alternatives Rejected**: 
  - tldraw / Excalidraw: Hand-drawn aesthetic, insufficient geometric precision for industrial pin-level connections
  - HTML5 Canvas (raw): No hierarchical node structure; manual transform matrices required for zoom/pan/rotate
  - Fabric.js: Older, less maintained; Konva is optimized for industrial/CAD workflows

---

## Code Quality Standards

### Performance Considerations
- **Canvas rendering**: Use Konva Layer batching or offscreen canvas for grid/wires — decouple from 60Hz simulation ticks
- **Simulation loop**: Runs independently at 50/60Hz; canvas renders at monitor refresh rate (~60Hz)
- **State updates**: Keep Zustand simulation state small and update-focused; avoid re-renders of canvas during high-frequency ticks

### Type Safety
- Maintain 100% TypeScript coverage
- Define explicit interfaces for:
  - Circuit graph nodes and nets
  - Component pin definitions
  - Simulation solver inputs/outputs
  - PLC memory maps
  - GRAFCET step and transition states

### Testing Strategy
- **Unit tests** (`tests/engine/`): Verify electrical solver logic (e.g., contactor state machine, motor phase detection)
- **Integration tests**: Canvas undo/redo, wire routing, component placement workflows
- Use Vitest for fast test execution

---

## Common Development Commands (Phase 1+)

Once project is initialized:
```bash
# Development
npm run dev              # Start Tauri dev window
npm run build            # Build desktop executable

# Testing & Quality
npm run test             # Run Vitest unit tests
npm run test:watch       # Watch mode
npm run test:ui          # UI test runner
npm run type-check       # TypeScript check

# Formatting
npm run format           # Prettier format
npm run lint             # ESLint check
```

---

## Key References & Design Inspirations

- **CADe SIMU**: Legacy industrial automation schematic editor (Spanish standard)
- **PC SIMU**: 2D industrial process visualization and control
- **Siemens LOGO!**: Compact logic module for basic automation (24V, 8 inputs, 4 outputs)
- **GRAFCET / SFC**: IEC 61131-3 Sequential Function Chart standard
- **Electrical Standards**: IEC 60617 (electrical symbols), DIN 6771 (technical drawings)

---

## Important Architectural Patterns

1. **Separation of Concerns**:
   - Canvas UI (`src/components/Canvas/`) handles only rendering and user interaction
   - Simulation engines (`src/engine/`) are pure logic, testable independently
   - State management (`src/store/`) orchestrates both layers

2. **Decoupled Rendering & Simulation**:
   - Simulation loop runs at physics tick (50/60Hz)
   - Canvas renders at display refresh rate (~60Hz)
   - Zustand store provides throttled state snapshots to prevent frame drops

3. **Component Pin Model**:
   - Every electrical component has typed pins (power, coil, auxiliary, signal)
   - Pins are indexed and referenced by `componentId:pinId`
   - Wires connect pins; never coordinates

4. **Graph-Based Circuit Solver**:
   - Circuits are topological graphs, not matrix-based
   - Nets (connected pin groups) accumulate voltage from all upstream power sources
   - Contactor logic uses tag-based contact linking (e.g., "KM1" coil controls all contacts tagged "KM1")

---

**CADe-Simu Next** combines the proven educational value of CADe SIMU with modern web technologies, extensibility, and cross-platform accessibility.

---

## Team & Development Model

**Core Team**: 
- **Zuzo** (Product Owner, Domain Expert): Deep expertise in electrical circuits, PLC, pneumatics, industrial automation standards (IEC 60617, DIN 6771). Defines feature scope, UX decisions, component library priorities.
- **Claude Code** (Implementation Copilot): Generates scaffolding, components, tests, and iterates on features based on Zuzo's direction. Maintains code quality, proposes architectural refinements.

**Collaboration Pattern**:
1. Zuzo provides high-level direction, design decisions, or feedback on implementation
2. Claude Code generates code, tests, and documentation
3. Zuzo reviews, tests in-app, and iterates
4. Decisions are recorded in `CLAUDE.md` to prevent context loss across sessions

**Documentation**:
- In-app component tooltips and interactive guide (post-MVP)
- `.zcade` example projects in `/examples/` directory (template circuits: motor starters, star-delta, PLC logic)
- Inline code comments only for non-obvious domain logic (IEC 60617 pinout conventions, GRAFCET state machines)
