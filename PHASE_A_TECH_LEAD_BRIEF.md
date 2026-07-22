# COMPLETE PROJECT ROADMAP TECH LEAD BRIEF
## CADe-Simu Next - From MVP to Production Release

**Document Version:** 1.0  
**Date:** 2026-07-23  
**Audience:** Tech Lead Agent (Claude Opus/Sonnet + Plan skill)  
**Purpose:** Design a complete, hierarchical project roadmap (Phases A–F) with role-based architecture for maximum efficiency and unprecedented quality

---

## EXECUTIVE SUMMARY

**CADe-Simu Next** is a modern, cross-platform successor to the legacy CADe SIMU (educational electrical schematic editor from 2000). The original app was technically sophisticated for its time but has outdated UX, no cross-platform support, and limited extensibility. Our mission is to build a **dignified successor** that respects the original's professional and educational value while delivering modern standards in UI/UX, performance, and code quality.

**Project Vision**: Release a production-ready, feature-complete industrial schematic editor + 2D process simulator that runs natively on Windows/macOS/Linux/Web. Professional appearance and UX on first click. Zero external dependencies (offline-first). Educational and professional tooling combined.

**Timeline**: 9–11 weeks from now (late September 2026) to production release.

**Quality Standard**: Every phase must meet "professional grade" standards. No shortcuts. Code quality, UX polish, and test coverage are non-negotiable.

---

## COMPLETE PHASE ROADMAP (9-11 Weeks)

### **Phase A: Editor Profesional** (Weeks 1-2)
**Goal**: Deliver a polished electrical schematic editor with IEC 60617 symbols, smart wiring, undo/redo, and the ability to draw 3 canonical circuits perfectly.

**Deliverables**:
- 25+ IEC 60617 SVG symbols (Tier 1: power sources, contactors, protections, motors, lamps, push buttons)
- SVG loading infrastructure + symbol registry
- Improved auto-routing (A*/Dijkstra-based pathfinding)
- Undo/redo system (command pattern)
- Baseline ERC (electrical rule checking): floating nets, open phases
- Test suite: unit + integration tests for canonical circuits
- Code quality: 100% type-safe TypeScript, ESLint clean

**Success Criteria**:
- All 3 canonical circuits (DOL, Forward-Reverse, Y-Δ) draw and simulate perfectly
- Symbols render pixel-perfect at any zoom level
- Undo/redo works for all operations without state corruption
- No ERC false positives/negatives on test circuits

---

### **Phase B: PLC & Pneumatic Simulation** (Weeks 3-4)
**Goal**: Enable automation logic programming and pneumatic component simulation. Educators can now teach sequential control.

**Deliverables**:
- LOGO! logic module emulation (simplified Siemens LOGO! instruction set)
- Ladder visual programming editor (IEC 61131-3 Ladder)
- PLC I/O mapping (inputs/outputs linked to schematic pins)
- Pneumatic component library (cylinders, valves, pressure switches)
- Pneumatic solver (basic discrete fluid state)
- Integration tests: PLC logic + schematic interaction
- Documentation: "How to program LOGO! in CADe-Simu Next"

**Success Criteria**:
- Example: Start button → PLC input → PLC logic → PLC output → Contactor coil energizes
- Pneumatic cylinder extends/retracts based on valve actuation from electrical schematic
- Test suite covers timing, sequencing, state machines

---

### **Phase C: 2D Process Simulation** (Weeks 5-6)
**Goal**: Full PC SIMU replacement—animated 2D industrial process view coupled to electrical schematic.

**Deliverables**:
- 2D scene renderer (canvas-based animation)
- Process elements library: conveyors, tanks, elevators, presses, motors with load
- PLC/electrical ↔ 2D scene coupling (sensors feed PLC, PLC outputs move objects)
- Physics simplification (no true Newtonian physics—just smooth animations)
- Example projects: bottle filling line, press control, conveyor synchronization
- Test suite: scene rendering, coupling logic

**Success Criteria**:
- A simple bottle-filling simulation with 3 motors, solenoid valve, tank level sensor runs flawlessly
- Process view updates in real-time synchronized with electrical simulation
- No performance degradation with 500+ electrical components

---

### **Phase D: Export & Advanced Features** (Weeks 7-8)
**Goal**: Professional documentation, BOM generation, and extended component library.

**Deliverables**:
- PDF export (DIN 6771 title blocks, page formatting, multi-page support)
- Bill of Materials (BOM) generation (CSV/Excel)
- Expanded component library (Tier 2 + selected Tier 3: timers, transformers, VFDs, sensors)
- Project templates (pre-made circuits for common topologies)
- Component search + categorization
- Extended solver: disyuntor trip modeling, transformer step-down logic
- Documentation generation from schematic

**Success Criteria**:
- Export any circuit to professional-looking PDF
- BOM lists all components with part numbers, quantities, suppliers
- Educators can browse/search 50+ component types

---

### **Phase E: UI Polish & Localization** (Weeks 9)
**Goal**: Professional UX, multi-platform testing, accessibility, multi-language support.

**Deliverables**:
- Dark/Light theme refinement
- Keyboard shortcut customization
- Accessibility audit (WCAG 2.1 AA compliance)
- Multi-language support (Spanish, English, Portuguese, French)
- Cross-platform testing (Windows/macOS/Linux/Web)
- Tauri packaging for all platforms
- User documentation + video tutorials
- Performance optimization (profiling & tuning)

**Success Criteria**:
- App launches in <2 seconds on modest hardware
- All UI text translated to 4 languages
- Keyboard-only workflow possible (no mouse required)
- Visual regression test suite passes

---

### **Phase F: Release & Community** (Weeks 10-11)
**Goal**: Public release, installation packages, community building, support infrastructure.

**Deliverables**:
- GitHub release (open-source, MIT license)
- Installers for Windows/macOS/Linux (codesigning)
- Web deployment (Vite SPA + optional Electron/Tauri desktop)
- Project website with docs, gallery, download links
- Community examples + contributed templates
- CI/CD pipeline (GitHub Actions)
- Bug tracking + feature request system
- Release notes + migration guide (for CADe SIMU users)

**Success Criteria**:
- 1000+ downloads in first month
- <5 critical bugs reported by community
- Active GitHub discussions community
- Educational institutions adopt it

---

## CONTEXT & DECISIONS ALREADY MADE

### Project Constraints (Non-Negotiable)
- **100% offline-first**: No cloud, no authentication. Works in classrooms without internet.
- **Performance target**: 500+ components at 60 FPS rendering, 50Hz simulation tick.
- **User base**: Electrical engineers, educators, students. UX must feel professional on first use.
- **MVP scope**: Electrical schematics + basic PLC + pneumatics + 2D simulation (Phases A-C).
- **Quality mandate**: Every phase must pass professional code review, comprehensive testing, and user acceptance.

### Architectural Decisions (Locked In)
1. **TypeScript solver, not Rust/Wasm** (yet). Typical circuits: 50–200 components. V8 engine handles topological graph solving in <1ms. Rust/Wasm deferred to post-release if needed.
2. **Tauri 2.0 + React 19 + Konva.js** (stable, proven for industrial CAD-like apps).
3. **Zustand** for state management (already integrated, works great for decoupled stores).
4. **SVG-based component symbols** (not Konva shapes). Ensures scalability, precision, and maintainability.
5. **Offline-first `.cadesimu.json` file format** (open, human-readable, version-controllable).
6. **Command pattern for undo/redo** (immutable, serializable, reversible).

### Component Priorization

**Tier 1 (Phase A - Imprescindible):**
- Power sources: 3-phase AC (L1, L2, L3, N, PE), DC (+24V, 0V)
- Contactors: 3P/4P with coil (A1-A2) and main contacts
- Auxiliary contacts: NO and NC blocks
- Protection: Magnetothermal circuit breaker (3P) and thermal overload relay
- Manual controls: Push buttons (NO, NC), emergency stop with latching
- Loads: 3-phase motor (3-wire and 6-wire for Y-Δ), signal lamps

**Tier 2 (Phase D - Importantes):**
- Timers: TON (on-delay), TOF (off-delay) with timed contacts
- Control relays (KA)
- Position switches (limit switches)
- Transformers (step-down AC or AC-to-DC rectifier)

**Tier 3 (Phase D - Nice-to-have):**
- VFD, inductive sensors, capacitive sensors

**Pneumatic (Phase B):**
- Single/double-acting cylinders
- Directional control valves (3/2, 5/2, 5/3)
- Solenoid actuation
- Pressure switches, position sensors

### Canonical Test Circuits (Must Model Perfectly)
1. **DOL (Direct-On-Line) with Self-Hold**: Power circuit (breaker → contactor → thermal → motor). Control circuit (24V: start button → KM1 coil + KM1 aux parallel to start button → stop button series).
2. **Forward-Reverse with Electrical Interlock**: Two contactors (KM1 fwd, KM2 rev) with NO cross-blocking on each other's coil circuits to prevent short.
3. **Auto Y-Δ Starter**: 3 contactors (line, star, delta) + timer-driven switchover. Requires exact sequencing to avoid short circuit during transition.

---

## YOUR MISSION (TECH LEAD AGENT)

You are architecting the **complete execution plan for CADe-Simu Next**, from now through production release.

Your deliverable is a **comprehensive project roadmap** that defines:

1. **All 6 Phases** with clear objectives, deliverables, dependencies
2. **Specialist agent roles** for each phase (not all phases need the same agents)
3. **Hierarchical task breakdown** within each phase (by discipline/role)
4. **Critical path analysis** (what takes longest, what blocks everything else)
5. **Integration architecture** (how phases depend on each other, version control strategy)
6. **Quality gates** at the end of each phase (go/no-go criteria)
7. **Resource planning** (estimated effort, parallel vs. sequential work)
8. **Risk mitigation** (top 5-10 risks across all phases, mitigation plans)
9. **Success metrics** (by phase and overall project)

---

## DESIGN PRINCIPLES FOR YOUR ROADMAP

1. **Maximize parallelization within phases** but respect hard dependencies between phases
2. **Role specialization**: Each agent is an expert in one domain (SVG design, routing algorithms, testing, UX, etc.). Avoid generalists.
3. **Fail fast on fundamentals**: Phase A's success is critical. Better to spend an extra week perfecting Phase A than to have all later phases built on shaky ground.
4. **Quality as non-negotiable**: Every phase must have comprehensive testing (unit + integration + user acceptance). No "we'll fix it in Phase D" compromises.
5. **Documentation is code**: Specifications, API contracts, and architectural decisions must be documented as first-class artifacts, not afterthoughts.
6. **Iterative refinement**: The roadmap should account for mid-course corrections. If Phase A surfaces architectural issues, the roadmap should be flexible.

---

## ROADMAP STRUCTURE (EXPECTED OUTPUT)

When you complete this mission, your roadmap must contain:

### 1. Project Timeline & Critical Path (1 page)
- Gantt-style visualization or ASCII timeline showing all 6 phases
- Critical path highlighted (longest dependency chain)
- Parallel work streams identified
- Key milestones marked

### 2. Phase-by-Phase Breakdown (12-15 pages, ~2.5 pages per phase)

For **each phase (A–F)**, specify:

#### Phase [X] Execution Plan
**Duration**: [Weeks] | **Effort**: [Person-weeks] | **Critical Path**: [Yes/No]

**Objectives** (2-3 sentences)

**Deliverables**
- List of concrete outputs (code, docs, tests, components)

**Specialist Agents Required**
- Agent Role 1: [Name], Expertise: [X], Owns: [Y], Produces: [Z]
- Agent Role 2: [Name], Expertise: [X], Owns: [Y], Produces: [Z]
- (etc.)

**Task Breakdown by Role**
```
## Role: SVG Symbol Architect
- Week 1, Day 1-2: Design symbol metadata schema
- Week 1, Day 3-5: Implement 10 base symbols
- (etc.)

## Role: Routing Engineer
- Week 1, Day 1-3: Algorithm design & prototyping
- (etc.)
```

**Inter-Phase Dependencies**
- What must be done in this phase before Phase [X+1] can start
- What from Phase [X-1] is a hard blocker

**Integration Points**
- Interfaces between agents' code
- Data contracts and API signatures
- Testing strategy at boundaries

**Success Criteria & Validation Gate**
- Go/no-go criteria at end of phase
- Test coverage requirements
- Code review checklist
- User acceptance criteria (if applicable)

**Risks & Mitigation**
- 2-3 top risks specific to this phase
- Mitigation strategy for each
- Escalation path

### 3. Agent Roles Across All Phases (3-4 pages)

A matrix showing which agents are needed in which phases:

```
| Role                    | Phase A | B | C | D | E | F |
|-------------------------|---------|---|---|---|---|---|
| SVG Symbol Architect    | Lead    | - | - | C | - | - |
| Routing Engineer        | Lead    | - | - | - | - | - |
| State Management Arch.  | Lead    | C | - | - | - | - |
| PLC/Automation Expert   | -       | L | C | - | - | - |
| Physics/Animation Eng.  | -       | - | L | - | - | - |
| (etc.)                  |         |   |   |   |   |   |
```

For each role, define:
- **Expertise required**: Deep knowledge in [domain]
- **Phases owned**: Lead role in [phases], Contributor in [phases]
- **Key deliverables**: Across all phases
- **Growth/handoff**: When do they onboard/offboard the project

### 4. Parallel Work Strategy (2 pages)

Identify which agents can work in **true parallel** vs. **sequential**:

- **Parallel Stream A** (Phase A): SVG Architect, Routing Engineer, State Architect (can all start day 1)
- **Parallel Stream B** (Phase B): PLC Expert, Pneumatic Component Designer (can start once Phase A is stable)
- etc.

Show how this parallelization reduces total project duration.

### 5. Quality & Testing Strategy (2-3 pages)

How quality is maintained across all phases:
- Unit test coverage targets (% by phase)
- Integration test strategy (what scenarios must work)
- User acceptance testing (who tests, when)
- Performance benchmarks (FPS, solver tick time, memory usage)
- Code review process (approval gates, who reviews)
- Regression test suite (how to catch regressions between phases)

### 6. Risk Register & Mitigation (2 pages)

Top 10 risks across the entire project:

```
## Risk 1: SVG symbol precision loss at extreme zoom levels
**Probability**: Medium | **Impact**: High | **Phase**: A
**Mitigation**: 
- Implement pixel-perfect rendering tests
- Use vector math (not canvas rasterization) for transforms
- Gate Phase A on zoom stress tests (10x - 0.1x)
**Owner**: SVG Architect
**Escalation**: If zoom artifacts appear, escalate to Tech Lead immediately
```

(etc. for top 10)

### 7. Success Metrics (1 page)

How we measure success:

- **Phase A Success**: 3 canonical circuits render/simulate perfectly, 0 bugs in 1-week dogfooding
- **Phase B Success**: Example PLC program (traffic light logic) runs correctly; pneumatic coupling works
- **Phase C Success**: Bottle-filling simulator runs at 60 FPS with 500 electrical components
- **Phase D Success**: PDF export looks professional; BOM is accurate
- **Phase E Success**: App launches in <2 seconds; WCAG audit passes
- **Phase F Success**: 1000+ downloads in month 1; <5 critical bugs from community

### 8. Agent Launch Instructions (1-2 pages)

How to invoke agents in the right sequence:

```
## Phase A Launch Sequence
Day 1, Morning:
- Launch Agent: SVG Symbol Architect (prompt + context)
- Launch Agent: Routing Engineer (prompt + context)
- Launch Agent: State Management Architect (prompt + context)
- All three work in parallel, sync daily at EOD

Day 6, Morning:
- Phase A partial review
- Launch Agent: ERC Validator (depends on symbol registry + wiring being stable)

Day 10:
- Phase A gate review
- If GO: begin Phase B onboarding
- If NO-GO: escalate to Tech Lead for decision
```

### 9. Version Control & Branching Strategy (1 page)

How to manage code changes across multiple agents:
- Feature branches per agent? Trunk-based? GitFlow?
- How do we prevent merge conflicts?
- How do we integrate Phase A's code into main before Phase B starts?
- Tagging strategy for releases

### 10. Technical Appendix (Optional but Recommended)

If needed, include:
- SVG symbol metadata schema (JSON)
- Undo/redo command pattern pseudo-code
- Auto-routing algorithm outline (pseudocode)
- PLC instruction set reference
- 2D physics simplification model
- Performance budgets (FPS targets, memory limits)

---

## KEY QUESTIONS YOUR ROADMAP MUST ANSWER

1. **How many distinct agent roles are needed across all 6 phases?**
2. **What's the true critical path (longest dependency chain)? How long is it?**
3. **Where can we achieve massive parallelization? Which parts are truly sequential?**
4. **When is the earliest we can launch Phase B? Phase C?** (Depends on gates at end of Phase A)
5. **How do we maintain code quality with multiple agents working in parallel?** (Review strategy, testing gates)
6. **What's the biggest risk to the timeline? How do we mitigate it?**
7. **How much effort (person-weeks) is the full roadmap? Is 9-11 weeks realistic?**
8. **What can we cut if we're running behind schedule? What's non-negotiable?**

---

## QUALITY STANDARDS FOR YOUR ROADMAP

Your roadmap must be:

- **Specific**: No vague "do Phase A" statements. Every task has a start date, duration, owner, and deliverable.
- **Realistic**: Estimates based on typical engineering velocity. Account for learning curves, integrations, testing.
- **Actionable**: Someone should be able to read the roadmap and immediately start working.
- **Resilient**: Account for risks, rework, and mid-course corrections.
- **Hierarchical**: Clear parent-child relationships. You can zoom in or out and see structure at any level.

---

## FINAL DELIVERABLES

Produce **one comprehensive markdown document**: `COMPLETE_PROJECT_ROADMAP.md`

This document is the **source of truth** for all agents involved in all 6 phases. It is:
- Detailed enough to unblock any agent
- High-level enough to show the full picture
- Update-able (new risks, schedule changes, etc. can be tracked)
- Appendix-able (more details can be added without cluttering the main flow)

Once Zuzo approves the roadmap, agents will be launched phase-by-phase based on your design.

---

## IMPORTANT NOTES TO TECH LEAD AGENT

1. **Think like an engineering director**: You're not building Phase A in isolation—you're designing a complete delivery machine that will ship 6 phases over 9-11 weeks. Every decision should optimize for the full delivery.

2. **Agent expertise is key**: Instead of defining generic "developers," define specialists (SVG Designer, PLC Programmer, Physics Simulation Engineer, etc.). This clarity reduces handoff friction.

3. **Phases are not waterfall**: A well-designed roadmap has gates (end of Phase A must succeed before Phase B starts), but also parallelization (Phase B prototype work can start mid-Phase A if low-risk).

4. **Quality gates are non-negotiable**: Do not let a phase "pass" unless it meets its success criteria. Better to extend a phase by a week than to ship a broken foundation.

5. **Documentation is part of every phase**: Not a separate "Phase F docs" activity. Each phase agent documents as they go.

6. **Risk management**: Identify top risks early. The roadmap should have contingency time for the biggest risks.

7. **Communication cadence**: Define how agents sync, escalate, and keep Tech Lead informed. Asynchronous updates are OK, but sync points (e.g., end-of-day standups) should be specified.

---

## TIMELINE REALISM CHECK

You have **9-11 weeks** to go from "working prototype" to "professional, released app."

- **Phase A (2 weeks)**: Achievable if agents work in parallel on independent streams
- **Phase B (2 weeks)**: Achievable if Phase A is solid (can reuse solver infrastructure)
- **Phase C (2 weeks)**: Achievable if good architecture for 2D coupling is in place
- **Phase D (2 weeks)**: Achievable but need to be ruthless about scope (focus on PDF + BOM, defer nice-to-haves)
- **Phase E (1 week)**: UI polish + localization is time-consuming; might extend to 1.5 weeks
- **Phase F (1-2 weeks)**: Release, packaging, CI/CD setup, community launch

**Total**: 10-12 weeks. Slightly over 9-11 weeks estimate, but realistic.

If you find the roadmap can't fit in 9-11 weeks, **your job is to identify what can be deferred to V1.1** and still ship a complete, professional app as V1.0 in 9-11 weeks.

---

**End of Tech Lead Brief**

Now design the complete roadmap. Produce `COMPLETE_PROJECT_ROADMAP.md` with all sections above. Make it detailed, specific, actionable, and professional.

Once Zuzo reviews and approves, we execute phase-by-phase, with each phase having its own set of specialized agents working in parallel.
