# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview: CADe-Simu Next (OpenCADe)

**CADe-Simu Next** is a modern, open-source, cross-platform industrial schematics and simulation application inspired by CADe SIMU and PC SIMU. It provides a unified environment for electrical schematics, pneumatic logic, PLC programming, and 2D interactive process simulation.

**Key Goals:**
- Cross-platform (Windows, macOS, Linux, Web)
- Real-time electrical, pneumatic, and PLC simulation
- Modern UI/UX with infinite canvas, dark/light themes, and auto-routing
- Open JSON-based file format (`.cadesimu.json`)
- Extensible component plugin architecture

### Historical Context
**CADe SIMU** was created by Prof. Juan Luis Villanueva Montoto (CanalPLC) and remains the de facto standard for electrical automation education in Spanish-speaking technical schools and universities. The most widely deployed version is V4.0–V4.2 (Windows-only freeware, no longer maintained). This project exists to provide a modern, cross-platform, open-source replacement for users who:
- Require macOS/Linux native support (educators & technicians outside Windows)
- Need extensibility and plugin architecture for domain-specific components
- Want an open-source alternative for integration in educational environments
- Require offline-first operation in classrooms and industrial settings without internet connectivity

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

## File Format: `.cadesimu.json`

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

## Development Roadmap (Phases)

### **Phase 1: Foundation & Canvas Infrastructure**
- Tauri 2.0 + React 19 setup
- Infinite grid canvas with zoom/pan/snap-to-grid
- Draggable component symbols with rotation and pin anchors
- **Command**: `npm run dev` (Tauri dev window)

### **Phase 2: Wiring Engine & Topological Graph**
- Point-to-point wire routing with orthogonal lines
- Automatic junction node creation
- Topological circuit graph builder
- Wire color coding and net identification

### **Phase 3: Electrical Simulation Engine**
- Graph solver at 50Hz/60Hz tick rate
- Voltage propagation through switches
- Contactor coil logic and linked contact automation
- Motor phase detection and animation

### **Phase 4: Pneumatic & PLC Simulation**
- LOGO! / S7-1200 PLC emulation
- GRAFCET execution engine
- Pneumatic valve and cylinder motion physics

### **Phase 5: PC-SIMU 2D Process View**
- Interactive 2D scene (conveyors, tanks, elevators)
- Direct IO mapping to schematic elements

### **Phase 6: Export, BOM & Polish**
- PDF export with DIN 6771 title blocks
- Bill of Materials (CSV/Excel)
- Keyboard shortcuts, multi-language support

### Timeline & MVP Definition

**Weeks 1–3 (MVP — Core Editor + Basic Simulation)**:
- Phases 1, 2, 3 (Foundation, Wiring, Electrical Simulation)
- Minimum viable product: create schematics, wire them, simulate AC/DC power flow and basic contactor logic
- No PLC, no GRAFCET, no 2D process view

**Weeks 4–6 (Beta — Automation Logic)**:
- Phase 4: PLC LOGO! emulation, GRAFCET engine, pneumatic valves
- Industrial automation control sequences enabled

**Weeks 7–9 (V1.0 Release — Full-Featured)**:
- Phases 5, 6: 2D process simulation, PDF export, multi-platform packaging (Windows/macOS/Linux)
- Feature-complete for educational and industrial SME use

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
- `.cadesimu.json` example projects in `/examples/` directory (template circuits: motor starters, star-delta, PLC logic)
- Inline code comments only for non-obvious domain logic (IEC 60617 pinout conventions, GRAFCET state machines)
