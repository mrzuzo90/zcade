# COMPLETE PROJECT ROADMAP
## zCADe — From Working Prototype to Production Release (V1.0)

**zCADe: The next-generation industrial schematics & simulation suite.**

**Document Version:** 1.0  
**Date:** 2026-07-23  
**Author:** Tech Lead Agent (Claude)  
**Status:** DRAFT — pending Zuzo approval  
**Source Brief:** `PHASE_A_TECH_LEAD_BRIEF.md`

This document is the **source of truth** for all agents across all 6 phases (A–F). Every agent launched into this project receives (1) this roadmap, (2) `CLAUDE.md`, and (3) a role-specific launch prompt (Section 8). When reality diverges from this plan, the plan is updated here (see Change Log at the end) — agents never silently deviate.

---

## How to Read This Document

| You are… | Read… |
|---|---|
| Zuzo (approval / status check) | Section 0 (answers), Section 1 (timeline), Section 7 (metrics), Section 6 (risks) |
| Tech Lead (orchestration) | Everything; Sections 4, 8, 9 daily |
| A specialist agent starting work | Your phase in Section 2, your role in Section 3, Section 9 (branching), relevant Appendix entries |
| QA at a phase gate | Section 5 + your phase's "Success Criteria & Validation Gate" in Section 2 |

**Starting point (already built, commits `68d7383` → `9f714b2`):** infinite canvas with grid/zoom/pan, 6 Konva-drawn component types, click-to-click orthogonal wiring, union-find topological graph, 50 Hz fixed-point electrical solver with seal-in support, operate-mode UI, 41 passing tests. This is the "working prototype" the brief refers to. Phases A–F build on it; nothing is thrown away, but Konva-shape symbols are replaced by SVG-sourced symbols in Phase A.

---

# Section 0 — Executive Answers (The 8 Key Questions)

**Q1. How many distinct agent roles are needed across all 6 phases?**
**13 specialist roles + 1 Tech Lead** (Section 3). Peak concurrency is 6 agents (Phase A, weeks 1–2). No role is a generalist; each owns specific directories and deliverables.

**Q2. What is the true critical path, and how long is it?**
`Phase A (2w) → Phase B (2w) → Phase C (2w) → Phase E (1.5w) → Phase F (2w)` = **9.5 weeks of work**, plus 1.5 weeks of distributed buffer = **11 weeks elapsed**. Phase D is **off the critical path**: PDF export, BOM, and the Tier 2 component library depend only on Phase A's data model, so Phase D runs in parallel with Phase C (weeks 5–7).

**Q3. Where can we achieve massive parallelization? What is truly sequential?**
- **Massive parallelism inside Phase A**: SVG symbols, A* routing, undo/redo+persistence, and solver extensions touch disjoint code and can all start Day 1 (they share only type contracts, frozen on Day 2).
- **Phase C ∥ Phase D**: fully parallel streams (weeks 5–7).
- **Truly sequential**: A→B (PLC I/O needs stable pin/solver contracts), B→C (2D scene consumes PLC outputs), C→E (can't polish/profile what doesn't exist), E→F (can't package what isn't polished).

**Q4. Earliest launch of Phase B? Phase C?**
- **Phase B**: Day 11 (start of week 3) if Gate G-A passes. A low-risk *prototype spike* (LOGO! instruction-set design doc, no code integration) may start Day 8 of Phase A.
- **Phase C**: Day 21 (start of week 5) if Gate G-B passes. The coupling-bus *architecture spec* is written during Phase B week 4 so Phase C codes from day one.

**Q5. How do we maintain code quality with multiple parallel agents?**
Directory ownership (no two agents edit the same directory, Section 9), frozen type contracts at each phase's Day 2, trunk-based development with short-lived branches, CI gates on every merge (type-check + lint + full test suite), Tech Lead reviews every PR, and a permanent QA agent who owns the regression suite across all phases (Section 5).

**Q6. Biggest risk to the timeline, and mitigation?**
**R3 — solver correctness for the canonical circuits** (cross-instance linked contacts, TON timer, Y-Δ sequencing) — it gates everything downstream and is the hardest to parallelize. Mitigation: it starts Day 1 of Phase A with a dedicated Solver Engineer, test-first against the three canonical circuits, and Gate G-A cannot pass without them green. Second biggest: **R8 — code-signing certificate lead time** (Apple notarization, Windows cert) — mitigated by *procuring certificates in week 1*, not week 10.

**Q7. Total effort? Is 9–11 weeks realistic?**
**≈ 48 person-weeks** (A:10.5, B:8, C:7, D:7, E:5.5, F:5, Tech Lead:5.5). Sequentially impossible in 11 weeks; with the parallel agent model (peak 6 concurrent) the elapsed schedule is **11 weeks with 1.5 weeks of buffer** — realistic, provided Gate G-A is not compromised.

**Q8. What can we cut if behind schedule? What is non-negotiable?**

| Cut first (defer to V1.1) | Non-negotiable for V1.0 |
|---|---|
| French + Portuguese locales (keep ES/EN) | 3 canonical circuits perfect (draw + simulate) |
| Tier 3 components (VFD, inductive/capacitive sensors) | Undo/redo + `.zcade` save/load |
| Keyboard shortcut *customization* (keep fixed shortcuts) | PDF export + BOM |
| Video tutorials (keep written docs) | LOGO! + ladder editor + pneumatics (Phase B core) |
| 5/3 valves (keep 3/2, 5/2) | 2D process view with bottle-filling example |
| Documentation generation from schematic | ES + EN localization |
| Web deployment (ship desktop first, web 2 weeks later) | Signed installers for Windows/macOS/Linux |
| Full WCAG 2.1 AA audit (do keyboard-nav + contrast subset) | CI/CD + GitHub release |
| Elevator/press process elements (keep conveyor, tank, motor-load) | Regression suite green |

---

# Section 1 — Project Timeline & Critical Path

## 1.1 Calendar

Week 1 begins **Monday 2026-07-27**. Target release: **Friday 2026-10-09** (end of week 11). Hard limit with all buffer consumed: 2026-10-16.

```
            Jul27  Aug3   Aug10  Aug17  Aug24  Aug31  Sep7   Sep14  Sep21  Sep28  Oct5
Week:         1      2      3      4      5      6      7      8      9     10     11
            ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
Phase A     ██████████████G
  (Editor)                ▲G-A (Aug 7)
Phase B                   ██████████████G
  (PLC/Pneu)                            ▲G-B (Aug 21)
Phase C                                 ██████████████G
  (2D Sim)                                            ▲G-C (Sep 4)
Phase D                                 ░░░███████████████G          ← OFF critical path,
  (Export/Lib)                                            ▲G-D (Sep 9)  parallel with C
Buffer #1                                                 ▓▓▓ (0.5w, Sep 7–9)
Phase E                                                      █████████G
  (Polish/i18n)                                                       ▲G-E (Sep 18→22)
Phase F                                                               ██████████████R
  (Release)                                                                         ▲v1.0.0
Buffer #2                                                                     ▓▓▓▓▓ (1w, inside F window)

Legend: █ full-speed work   ░ ramp-up/spike   ▓ buffer   G gate review   R release
```

## 1.2 Critical Path (highlighted)

```
A: Solver extensions + SVG symbols + Undo/Redo     (weeks 1–2)   ← hardest, most parallel
   │  Gate G-A: 3 canonical circuits perfect
   ▼
B: LOGO! runtime + Ladder editor + Pneumatics      (weeks 3–4)
   │  Gate G-B: button→PLC→coil chain works
   ▼
C: 2D scene + coupling bus                         (weeks 5–6)
   │  Gate G-C: bottle-filling demo at 60 FPS
   ▼
E: Polish + i18n + accessibility + perf            (weeks 8–9)   ← D merged before E starts
   │  Gate G-E: <2s launch, 4 locales, keyboard-only
   ▼
F: Packaging + signing + website + release         (weeks 10–11)
   ▼
   v1.0.0 public release (Oct 9, 2026)
```

**Parallel streams off the critical path:**
- **Phase D** (weeks 5–7): Export Engineer + Component Library Engineer work against Phase A's frozen data model. Gate G-D lands Sep 9, before Phase E begins.
- **CI/CD** starts week 1 (not Phase F) — a part-time DevOps slice inside Phase A.
- **Certificate procurement** (Apple Developer account, Windows code-signing cert) is a week-1 action item for Zuzo — lead times can exceed 4 weeks.
- **i18n scaffolding** lands in Phase A (all UI strings through the i18n layer from week 1) so Phase E is translation work, not a retrofit.

## 1.3 Key Milestones

| Date | Milestone | Tag |
|---|---|---|
| 2026-07-27 | Phase A launch; certs ordered; CI live by Day 2 | — |
| 2026-08-07 | **Gate G-A**: 3 canonical circuits draw + simulate perfectly | `v0.4.0-phaseA` |
| 2026-08-21 | **Gate G-B**: PLC chain demo + pneumatic cylinder demo | `v0.5.0-phaseB` |
| 2026-09-04 | **Gate G-C**: bottle-filling sim @ 60 FPS / 500 components | `v0.6.0-phaseC` |
| 2026-09-09 | **Gate G-D**: PDF + BOM professional-grade; 50+ components | `v0.7.0-phaseD` |
| 2026-09-22 | **Gate G-E**: 4 locales, <2 s launch, keyboard-only workflow | `v0.9.0-rc1` |
| 2026-10-09 | **v1.0.0 public release** (GitHub + website + installers) | `v1.0.0` |

---

# Section 2 — Phase-by-Phase Breakdown

---

## Phase A — Editor Profesional

**Duration**: Weeks 1–2 (10 working days) | **Effort**: ~10.5 person-weeks | **Critical Path**: YES

### Objectives
Transform the working prototype into a professional-grade editor: IEC 60617 SVG symbols, A*-based smart routing, command-pattern undo/redo, file persistence, baseline ERC — validated by the three canonical circuits drawing and simulating perfectly. Everything downstream is built on this foundation; this phase gets the "fail fast on fundamentals" priority and consumes buffer before any later phase does.

### Deliverables
1. **Symbol system**: JSON symbol metadata schema; SVG→Konva rendering pipeline (crisp at 0.1×–10× zoom); **25+ Tier 1 IEC 60617 symbols**, selected from the full borne-numbered catalog in `docs/component-catalog.md` (3φ/1φ/DC sources, 3P/4P contactors, NO/NC aux blocks, magnetothermal breaker 3P, thermal overload relay, NO/NC push buttons, latching emergency stop, 3-wire and 6-wire 3φ motors, signal lamps ×5 colors, terminals); migration of the 6 existing components. **Two corrections after reconciling against the full catalog (2026-07-23, see Change Log)**: (a) the thermal overload relay is one component with *two* aux contact pairs per `docs/component-catalog.md` §3 — 95-96 (NC, breaks the coil circuit on trip) **and 97-98 (NO, drives a fault-signal lamp)** — Tier 1 must include both, not just 95-96; (b) the "TON timer symbol" is one component bundling the A1-A2 coil pins *and* its timed contact pairs — 55-56 (NO) and 57-58 (NC) per catalog §8 — not a bare coil, since none of the three canonical circuits can consume a timer that has no contact to switch. **Deliberately still deferred to Tier 2/Phase D** (per the catalog but not needed for Gate G-A): a dedicated fusible (fuse) component distinct from the magnetothermal breaker, a control relay (KA) distinct from a contactor, and multiple aux-block terminal-number variants (23-24/33-34/43-44 NO, 31-32/41-42 NC) beyond the single default pair per polarity SOLV already built — these are additive component instances, not new solver mechanisms, so adding them later carries no rework risk.
2. **Routing v2**: grid-based A* with obstacle avoidance and turn penalty; incremental re-route on component move; manual waypoint editing (activates the dormant T-junction feature); arc-hop rendering at unrelated crossings; <16 ms full re-route at 500 components.
3. **Undo/redo**: command pattern (do/undo/coalesce/transaction-group) wrapping every mutation across all three stores; Ctrl+Z / Ctrl+Shift+Z.
4. **Persistence**: `.zcade` save/load per the schema in `CLAUDE.md` (versioned, forward-migratable); Tauri native dialogs + web download fallback; autosave + crash recovery; recent-files list.
5. **Solver extensions** (required by the canonical circuits — see gap analysis below): cross-instance linked contacts (`linkedTo` tag: aux block "KM1" follows contactor KM1's coil), aux contacts on contactor definitions (13-14 NO, 21-22 NC), thermal overload with 95-96 trip contact **+ 97-98 fault contact** + manual trip toggle, latching e-stop, **basic TON timer** (pulled forward from Tier 2 — the Y-Δ canonical circuit is impossible without it) **with its 55-56/57-58 timed contacts, not the coil alone**, 6-wire motor with Y-Δ semantics, L-L short *detection* (flag, not physics — needed to validate interlock circuits).
6. **Baseline ERC**: rule framework + report panel; rules: floating nets, open motor phases, unpowered/unconnected coil, duplicate labels, L-L / L-N short.
7. **i18n scaffolding** (risk R9 mitigation): react-i18next wired, ES as base locale, all new strings keyed from Day 1.
8. **CI** (risk mitigation): GitHub Actions running type-check + lint + tests + build on every PR, required to merge.
9. **Test suite**: unit tests per subsystem + integration tests that build each canonical circuit programmatically and assert full simulation behavior (latch, interlock, timed switchover).

### Gap Analysis (prototype → Phase A scope)
| Canonical circuit | Missing today | Owner |
|---|---|---|
| DOL with self-hold | Aux contact blocks + cross-instance `linkedTo`; thermal overload; e-stop | Solver Engineer |
| Forward-Reverse interlock | NC aux cross-blocking (cross-instance `linkedTo`); short detection to *prove* the interlock works | Solver Engineer |
| Auto Y-Δ | TON timer; 6-wire motor; 3 coordinated contactors; short detection during transition | Solver Engineer |
| All three | SVG symbols, undo/redo, save/load, ERC | SYM / CORE / ERC |

### Specialist Agents Required
- **SVG Symbol Architect (SYM)** — Expertise: IEC 60617 symbology, SVG, Konva rendering. Owns: `src/components/symbols/`, `assets/symbols/`. Produces: metadata schema, rendering pipeline, 25+ symbols.
- **Routing & Geometry Engineer (ROUTE)** — Expertise: pathfinding, computational geometry. Owns: `src/engine/wiring.ts`, `src/engine/routing/`. Produces: A* router, waypoint editing, crossing hops.
- **Core State Engineer (CORE)** — Expertise: state architecture, command pattern, serialization. Owns: `src/store/`, `src/io/`. Produces: undo/redo, persistence, autosave, i18n scaffold.
- **Simulation Solver Engineer (SOLV)** — Expertise: circuit theory, relay logic, discrete simulation. Owns: `src/engine/solver.ts`, `src/engine/graph.ts`, `src/types/circuit.ts` (contract owner). Produces: linked contacts, TON, overload, e-stop, 6-wire motor, short detection.
- **ERC & Validation Engineer (ERC)** — Expertise: electrical rule checking, IEC standards. Owns: `src/engine/erc/`. Onboards Day 5. Produces: rule framework + 5 baseline rules + report UI.
- **QA & Test Engineer (QA)** — Expertise: Vitest, integration testing, CI. Owns: `tests/`, `.github/workflows/`. Produces: CI pipeline, canonical-circuit test suite, undo/redo fuzz tests, gate report.
- **Tech Lead (TL)** — reviews all PRs, freezes contracts Day 2, runs EOD syncs and the gate.

### Task Breakdown by Role

```
## Role: SVG Symbol Architect (SYM)
- W1 D1-2: Symbol metadata schema (JSON: viewBox, pin ids/positions/kinds,
           rotation anchors, state-variant layers e.g. contact open/closed,
           energized highlight). Review with SOLV + TL → FROZEN end of D2.
- W1 D2-3: SVG→Konva pipeline: SVGs parsed at build time into path data,
           rendered as Konva.Path (vector-crisp at any zoom; no rasterization).
- W1 D3-5: First 8 symbols + migrate the 6 existing components (power sources
           3φ/DC, breaker 3P, contactor 3P, push buttons NO/NC, motor 3-wire, lamp).
- W2 D6-8: Remaining 17+: thermal overload (95-96 NC + 97-98 NO fault contact —
           see docs/component-catalog.md §3), e-stop, aux blocks NO/NC, contactor 4P,
           1φ source, 6-wire motor, lamp colors, terminals, TON timer symbol (bundles
           A1-A2 coil + 55-56 NO/57-58 NC timed contacts — one component, not a bare coil).
- W2 D9-10: Zoom stress tests (0.1×–10×), pixel-snapping audit, symbol docs page.

## Role: Routing & Geometry Engineer (ROUTE)
- W1 D1-2: Algorithm spec: grid graph over canvas, obstacles = component bboxes
           (+2-cell clearance), A* with turn penalty, tie-break toward bus alignment.
           Spec reviewed by TL → frozen D2.
- W1 D3-5: Implement router + unit tests; keep Manhattan fallback behind a flag.
- W2 D6-7: Manual waypoint editing (drag wire segment → explicit points override);
           this activates the dormant T-junction feature; junction UX polish.
- W2 D8-9: Arc-hop rendering at unrelated crossings; perf benchmark: full re-route
           500 components / 1000 wires < 16 ms; incremental re-route on move.
- W2 D10: Integration polish with SYM pin positions; hand QA the perf harness.

## Role: Core State Engineer (CORE)
- W1 D1-2: Command pattern design (Appendix 10.2): Command{do,undo}, drag
           coalescing, transaction groups (e.g. delete component + its wires
           = one undo step). Spec frozen D2.
- W1 D3-5: History store; wrap ALL mutations in canvas/wires stores; Ctrl+Z/⇧Z;
           history cap 200 entries.
- W2 D6-7: .zcade serialize/load (versioned "1.0.0"); Tauri file dialogs
           + web fallback; schema validation on load with readable errors.
- W2 D8:   Autosave (30 s, to app-data dir) + crash recovery prompt; recent files.
- W2 D9-10: i18n scaffold (react-i18next, ES base, EN stub); migrate existing
           UI strings; ESLint rule: no bare string literals in JSX.

## Role: Simulation Solver Engineer (SOLV)
- W1 D1-2: Contract work with SYM/TL: extend ContactSegment with linkedTo
           (cross-instance tag), define TimerState. types/circuit.ts frozen D2.
           Implement cross-instance linked contacts + aux blocks (test-first:
           DOL latch test written before code).
- W1 D3-4: Thermal overload (95-96 trip + manual trip toggle in operate mode);
           latching e-stop (stays open until twist-reset click).
- W1 D5 – W2 D6: TON timer: solver-side state machine (ticks accumulate while
           coil energized; timed contacts switch at preset); preset editable
           in properties panel.
- W2 D7-8: 6-wire motor (U1V1W1/U2V2W2, detects Y vs Δ wiring); L-L short
           detection → net flagged, surfaced by ERC + red glow in operate mode.
- W2 D9-10: Pair with QA on the three canonical circuit simulation tests;
           fix everything they surface. THIS IS THE GATE.

## Role: ERC & Validation Engineer (ERC) — onboards W1 D5
- W1 D5-6: Rule framework (Rule → Finding{severity, netIds, componentIds, i18n key});
           report panel UI (click finding → highlight on canvas).
- W2 D7-8: Rules: floating net, open motor phase, unconnected/unpowered coil,
           duplicate labels, L-L/L-N short (consumes SOLV's detection).
- W2 D9-10: Zero false positives/negatives on the 3 canonical circuits +
           5 deliberately-broken variants; ERC docs.

## Role: QA & Test Engineer (QA)
- W1 D1-2: CI pipeline live (type-check, lint, test, build; required checks).
           Test plan doc for Phase A.
- W1 D3-6: Circuit-builder test helpers (buildDOL(), buildFwdRev(), buildYDelta());
           editor integration tests; undo/redo fuzz test (random op sequences,
           assert store state equals replay).
- W2 D7-9: Canonical circuit end-to-end sim tests: DOL (idle/latch/stop/overload
           trip), Fwd-Rev (interlock blocks simultaneous energize), Y-Δ (timed
           sequence, no overlap window); zoom stress; routing perf benchmark in CI.
- W2 D10: Gate G-A report: test matrix, coverage, perf numbers, open bugs.
```

### Inter-Phase Dependencies
- **Blocks Phase B**: stable `types/circuit.ts` contracts (pins, contacts, potentials), working solver with linked contacts (PLC outputs will drive coils through the same mechanism), persistence (PLC programs embed in `.zcade`), symbol pipeline (PLC module needs a symbol).
- **Hard blockers from before**: none — prototype is complete and green.
- **Pulled forward from later phases**: TON timer (from D), i18n scaffold (from E), CI (from F), cert procurement (from F, Zuzo action).

### Integration Points
- **`src/types/circuit.ts` is the shared contract**, owned by SOLV; changes after D2 freeze require TL sign-off and a same-day migration PR.
- SYM ↔ SOLV: pin `kind`/`potential` metadata in symbol schema drives solver role derivation (get it wrong → silent dead component; ERC adds a "component has no role" diagnostic to catch this).
- SYM ↔ ROUTE: pin absolute positions API (`getPinPosition`) is the only geometry interface; ROUTE never reads symbol internals.
- CORE ↔ everyone: all mutations go through commands; agents call command creators, never `set()` directly (ESLint rule enforces).
- Boundary tests: QA owns cross-subsystem tests; each agent owns unit tests for their directory.

### Success Criteria & Validation Gate (G-A, Aug 7)
**GO requires all of:**
1. The 3 canonical circuits can be drawn by hand in the app in <10 min each (Zuzo acceptance test) and simulate correctly: DOL latches and drops on stop/trip; Fwd-Rev interlock provably blocks; Y-Δ switches on timer with no overlap.
2. Same 3 circuits pass automated end-to-end simulation tests in CI.
3. Undo/redo fuzz test green (500-op random sequences, zero state corruption).
4. Save → reload → identical canvas + identical simulation behavior.
5. Symbols visually crisp at 0.1×–10× zoom (screenshot audit).
6. ERC: 0 false positives/negatives on the 8 reference circuits (3 good + 5 broken).
7. `npm run type-check && lint && test && build` green; routing benchmark <16 ms.
8. Code review checklist (Section 5.5) passed on every merged PR.

**NO-GO path**: consume Buffer #1 early (extend ≤1 week); descope arc-hops and autosave before descoping anything gate-listed; escalate to Zuzo if >1 week slip projected.

### Risks & Mitigation (phase-specific)
1. **Cross-instance linked contacts destabilize the fixed-point solver** (oscillation between iterations). *Mitigation*: keep the 8-iteration cap + prior-tick seeding; add an oscillation detector test (state must be stable by iteration 8); test-first on canonical circuits. *Escalation*: if oscillation is structural, TL redesigns evaluation order within 2 days.
2. **SVG pipeline choice wrong** (blurry or slow at scale). *Mitigation*: Day 2–3 spike renders 100 instances of the most complex symbol at 5 zoom levels before mass-producing symbols. *Escalation*: fall back to Konva.Path hand-tracing for the 25 Tier 1 symbols (SVG stays source-of-truth for design).
3. **Undo/redo across three stores corrupts state**. *Mitigation*: single history stack over composite commands (never per-store stacks); fuzz testing from Day 5, not Day 9.

---

## Phase B — PLC & Pneumatic Simulation

**Duration**: Weeks 3–4 | **Effort**: ~8 person-weeks | **Critical Path**: YES

### Objectives
Add automation logic: a LOGO!-style PLC with a visual ladder editor and I/O mapped to schematic pins, plus a pneumatic component library with a discrete fluid solver coupled to the electrical simulation. After this phase, educators can teach sequential control end-to-end.

### Deliverables
1. **LOGO! runtime** (`src/engine/plc/`): instruction set (Appendix 10.4 — AND/OR/NOT/XOR, RS latch, TON/TOF/TP, up/down counter, pulse edge), cyclic scan at 10 ms nested inside the 20 ms solver tick, deterministic scan order.
2. **PLC module component**: `logo_module` symbol (I1–I8 24 V inputs, Q1–Q4 relay outputs as potential-free contacts); inputs sense net energization at their pins; outputs are solver `ContactSegment`s controlled by PLC memory — reusing Phase A's linked-contact mechanism unchanged.
3. **Ladder editor** (`src/components/LadderEditor/`): separate tab; rungs with contacts (NO/NC, mapped to I/Q/M), coils, timer/counter blocks; compile to LOGO! program; stored inline in `.zcade` (`plcPrograms`); live power-flow highlighting while simulating.
4. **Pneumatic library + solver** (`src/engine/pneumatic/`): compressor/source, 3/2 and 5/2 valves (solenoid + spring return; 5/3 only if time allows — on the cut list), single/double-acting cylinders with animated position, reed switches (feed back into electrical/PLC as contacts), pressure switch. Discrete state solver: pressure present/absent per pneumatic net, cylinder motion as timed ramp.
5. **Integration tests**: button → I1 → ladder logic → Q1 → contactor coil → motor; traffic-light sequencer (3 lamps, TON chain); cylinder extend/retract from solenoid valve driven by PLC; reed switch closing a PLC input.
6. **Documentation**: "How to program LOGO! in zCADe" (`docs/plc-guide.md`, ES+EN).

### Specialist Agents Required
- **PLC Runtime Engineer (PLC)** — Expertise: IEC 61131-3, PLC scan semantics, Siemens LOGO!. Owns: `src/engine/plc/`. Produces: runtime, instruction set, I/O binding.
- **Ladder Editor Engineer (LAD)** — Expertise: React/Konva editors, visual programming UX. Owns: `src/components/LadderEditor/`. Produces: ladder editor + compiler.
- **Pneumatics Engineer (PNEU)** — Expertise: pneumatic circuits, ISO 1219 symbols, discrete simulation. Owns: `src/engine/pneumatic/`, pneumatic symbols (using SYM's Phase A pipeline). Produces: library + solver + coupling.
- **QA & Test Engineer (QA)** — continues. Produces: timing/sequencing test suite, gate report.
- **Tech Lead (TL)** — contract freeze Day 12 (PLC memory map + pneumatic net types), reviews, gate.
- *(CORE on-call, ~0.2 weeks: persistence schema extension for `plcPrograms` + pneumatic components.)*

### Task Breakdown by Role

```
## Role: PLC Runtime Engineer (PLC)
- W3 D11-12: Memory map + instruction set spec (Appendix 10.4); scan cycle design
             (read inputs → execute → write outputs, 10 ms); contract frozen D12.
- W3 D13-15: Runtime core + unit tests (every instruction, edge cases: retentive
             RS, TON reset mid-count, counter overflow).
- W4 D16-17: logo_module component + I/O binding: inputs read net potential at
             pins, outputs drive ContactSegments via plc-controlled tag.
- W4 D18-19: Integration with simulation store (PLC scan inside tick());
             persistence of PLC program + memory snapshot semantics on stop().
- W4 D20:    Traffic-light + button→coil reference programs; docs pass with QA.

## Role: Ladder Editor Engineer (LAD)
- W3 D11-12: Ladder UX spec (grid of cells, rung model, element palette);
             review with PLC (compile target) → frozen D12.
- W3 D13-15: Rung canvas editor: place/delete contacts & coils, address picker
             (I/Q/M/T/C), serial/parallel branches.
- W4 D16-17: Timer/counter blocks with parameter dialogs; ladder→program compiler
             + round-trip tests (edit→compile→save→load→edit).
- W4 D18-19: Live power-flow highlighting during simulation; undo/redo integration
             (reuses CORE command pattern).
- W4 D20:    Polish + gate demo circuit.

## Role: Pneumatics Engineer (PNEU)
- W3 D11-12: Pneumatic net model spec (pressure source, nets, consumers);
             symbol set via SYM pipeline (cylinders, 3/2, 5/2, FRL, reed).
- W3 D13-15: Discrete solver: valve state → pressurized paths → cylinder
             target position; motion as timed ramp (Appendix 10.5).
- W4 D16-17: Electrical coupling: solenoid pins = coil-like loads; reed/pressure
             switches = ContactSegments controlled by cylinder position/net pressure.
- W4 D18-19: Cylinder animation on canvas; integration tests with PLC (valve
             driven by Q1, reed feeding I1 → automatic reciprocation demo).
- W4 D20:    Docs + gate demo.

## Role: QA & Test Engineer (QA)
- W3 D11-13: Test plan; timing test harness (virtual clock — no wall-clock
             sleeps in tests; tick() called manually N times).
- W3 D14 – W4 D18: Sequencing suites: TON/TOF accuracy (±1 tick), scan-order
             determinism, PLC↔solver loop (output drives input in 1 tick, no race),
             cylinder reciprocation state machine.
- W4 D19-20: Regression run of ALL Phase A tests + gate G-B report.
```

### Inter-Phase Dependencies
- **Hard blockers from A**: frozen circuit types; linked-contact mechanism (PLC outputs are literally linked contacts); TON solver pattern (PLC timers reuse it); symbol pipeline; persistence.
- **Blocks Phase C**: PLC memory map API (2D sensors write inputs / actuators read outputs); the coupling-bus spec (written W4 by TL+PLC) must exist before C Day 21.

### Integration Points
- PLC memory map (`I`, `Q`, `M`, `T`, `C` areas) is the contract between PLC, LAD, and later Phase C — frozen D12, documented in Appendix 10.4.
- Pneumatic ↔ electrical boundary: exactly two mechanisms — solenoid-as-coil (electrical → pneumatic) and switch-as-contact (pneumatic → electrical). No other cross-calls allowed.
- Ladder editor never touches solver internals; it emits a compiled program consumed by the PLC runtime only.

### Success Criteria & Validation Gate (G-B, Aug 21)
1. Brief's chain demo: physical start button → I1 → ladder logic → Q1 → KM1 coil → motor runs. Built by hand by Zuzo in <15 min following the guide.
2. Traffic-light program runs with correct timing (±1 tick tolerance in tests).
3. Double-acting cylinder reciprocates automatically (valve ← PLC ← reed switches).
4. Ladder programs round-trip through save/load byte-identically.
5. All Phase A tests still green (regression gate); coverage targets met (Section 5.1).
6. `stop()` semantics consistent: PLC memory and pneumatic state fully reset (same "cabinet loses supply" model as Phase A).

**NO-GO path**: descope 5/3 valve + counters; ship TON/TOF + basic logic only; extend ≤3 days from Buffer #1 remainder before escalating.

### Risks & Mitigation
1. **PLC scan ↔ 50 Hz solver interaction races** (output changes contact mid-relaxation). *Mitigation*: PLC scan runs *between* solver ticks, never inside relaxation; outputs latch until next tick; determinism test in CI.
2. **Ladder editor scope creep** (it could absorb the whole phase). *Mitigation*: locked feature list D12 (contacts, coils, TON/TOF, branches — nothing else in V1.0); FBD explicitly out of scope.
3. **Pneumatic realism expectations** (Zuzo's domain expertise vs. discrete model). *Mitigation*: demo the discrete model to Zuzo on D15 for acceptance before building all components; adjust ramp model, not physics.

---

## Phase C — 2D Process Simulation

**Duration**: Weeks 5–6 | **Effort**: ~7 person-weeks | **Critical Path**: YES

### Objectives
Deliver the PC SIMU replacement: an animated 2D industrial process view, in its own workspace tab, coupled bidirectionally to the electrical/PLC simulation through a formal I/O binding bus. Sensors in the scene feed PLC inputs; PLC/electrical outputs actuate scene elements.

### Deliverables
1. **Scene renderer** (`src/components/ProcessView/`, `src/engine/process/`): dedicated Konva stage, scene graph, edit mode (place/configure elements) + run mode (animated), rAF-driven animation decoupled from the 50 Hz tick (same pattern as the Phase 3 motor rotor).
2. **Coupling bus** (`src/engine/process/bindings.ts`): declarative bindings `{sceneElement.signal ↔ target}` where target is a PLC address (I/Q) or a schematic component state (contact tag / coil / motor). Serialized in `.zcade`.
3. **Process element library**: conveyor (speed ← motor state, direction ← motorDirection), tank with level + fill/drain valves, motorized load (visual load on a schematic motor), item spawner (bottles/boxes), photocell & limit-switch sensors, solenoid valve actuator, indicator panel. *Elevator and press: build if on schedule, else cut list (V1.1).*
4. **Simplified physics** (Appendix 10.5): constant-velocity motion, items advance with conveyor, level integrates flow — no Newtonian dynamics, fully deterministic given tick sequence.
5. **Example projects** (`/examples/`): bottle-filling line (3 motors, solenoid valve, tank level sensor — the gate demo), conveyor synchronization; press control if press element built.
6. **Performance**: 500 electrical components + full scene at 60 FPS / 50 Hz (benchmark in CI).

### Specialist Agents Required
- **2D Process Engineer (PROC)** — Expertise: canvas animation, game-loop architecture, ECS-lite design. Owns: `src/engine/process/`, `src/components/ProcessView/`. Produces: renderer, scene model, coupling bus.
- **Process Elements Designer (ELEM)** — Expertise: industrial process visuals, sprite/vector art, UX. Owns: `src/engine/process/elements/`, scene art. Produces: element library + configuration UI.
- **PLC Runtime Engineer (PLC)** — contributor (~0.5 w): binding API on the PLC side, scan-order guarantees for scene I/O.
- **QA & Test Engineer (QA)** — continues: coupling logic tests, determinism tests, perf benchmark.
- **Tech Lead (TL)** — coupling-bus contract freeze D22, reviews, gate.

### Task Breakdown by Role

```
## Role: 2D Process Engineer (PROC)
- W5 D21-22: Scene model + coupling bus spec (from the W4 architecture note);
             binding contract frozen D22 with PLC.
- W5 D23-25: Scene store (Zustand, same command-pattern undo integration),
             renderer with edit/run modes, element lifecycle (spawn/despawn).
- W6 D26-27: Coupling bus implementation: sensors write PLC inputs pre-scan,
             actuators read outputs post-tick; schematic-state bindings
             (motor running/direction, coil energized) read-only from solver.
- W6 D28-29: Bottle-filling example assembled; determinism pass (fixed tick
             sequence → identical scene state, for testability).
- W6 D30:    Perf tuning with QA benchmark; gate demo.

## Role: Process Elements Designer (ELEM)
- W5 D21-22: Element visual spec + config schema (each element: signals in/out,
             parameters, art states). Review with PROC.
- W5 D23-25: Conveyor + item spawner + photocell (the minimum bottle-line trio).
- W6 D26-27: Tank (level, valves) + motorized load + indicator panel + limit switch.
- W6 D28-29: Elevator/press IF on schedule (cut-list candidates); element
             config UI (properties panel per element).
- W6 D30:    Example scene polish, art consistency pass.

## Role: PLC Runtime Engineer (PLC) — contributor
- W5 D21-22: Binding API on PLC side (safe input injection point in scan cycle).
- W6 D26-27: Scan-order guarantee tests (sensor → input visible same scan).

## Role: QA & Test Engineer (QA)
- W5 D21-25: Headless scene testing harness (tick N times, assert positions/levels);
             binding round-trip tests.
- W6 D26-29: Bottle-line end-to-end test (spawn → detect → fill → advance);
             60 FPS / 500-component benchmark automated; Phase A+B regression run.
- W6 D30:    Gate G-C report.
```

### Inter-Phase Dependencies
- **Hard blockers from B**: PLC memory map + safe input-injection API; stable solver `componentStates` shape.
- **Blocks Phase E**: performance profile (E tunes what C measures); blocks nothing in D (parallel).

### Integration Points
- The coupling bus is the **only** interface between scene and simulation — scene code never imports solver internals, and vice versa. Bindings are data, not code.
- Scene animation (rAF, cosmetic) vs. scene *state* (tick-driven, deterministic) are separated exactly like the Phase 3 rotor pattern — QA tests state, never pixels.
- `.zcade` gains a `scene` section (CORE on-call reviews schema change).

### Success Criteria & Validation Gate (G-C, Sep 4)
1. Bottle-filling simulation (3 motors, solenoid valve, tank level sensor) runs flawlessly, driven entirely by a ladder program + schematic — no scripted animation.
2. Real-time sync: scene reacts to electrical state within 1 tick; no drift over 10-minute run.
3. 60 FPS sustained with 500 electrical components + scene (benchmark on reference hardware, recorded numbers).
4. Scene round-trips through save/load; determinism test green.
5. All A+B regression tests green.

**NO-GO path**: cut elevator/press and press-control example; reduce scene element polish; ≤0.5 week extension from Buffer #1 remainder.

### Risks & Mitigation
1. **Coupling architecture wrong → rework across 3 subsystems**. *Mitigation*: architecture note written in Phase B W4 and reviewed by PLC+SOLV+TL *before* C starts; bindings-as-data keeps blast radius small. *Escalation*: 2-day timebox on any redesign.
2. **Perf collapse with scene + schematic both rendering**. *Mitigation*: separate Konva stages per tab (only active tab renders); benchmark from D25, not D30.
3. **Scope explosion in element library** (industrial processes are endless). *Mitigation*: bottle-line trio first — gate depends only on it; everything else is additive.

---

## Phase D — Export & Advanced Features *(parallel with C)*

**Duration**: Weeks 5–7 (staggered start D23, ends Sep 9) | **Effort**: ~7 person-weeks | **Critical Path**: NO

### Objectives
Professional documentation output (DIN 6771 PDF export, BOM) and an expanded component library (Tier 2 + selected Tier 3) with search, categorization, and project templates. Runs as an independent stream against Phase A's frozen data model while Phase C proceeds on the critical path.

### Deliverables
1. **PDF export** (`src/io/pdf/`): vector output (svg2pdf path — Appendix 10.6), DIN 6771 title block (project/author/date/sheet fields editable), A4/A3 landscape, multi-page with sheet references, wire colors + junction dots faithful, print-grade line weights.
2. **BOM generation** (`src/io/bom/`): component roll-up (type, label, quantity, properties like coil voltage), editable part-number/manufacturer fields per component, CSV + XLSX export.
3. **Tier 2 components**: TON *and* TOF timers as placeable components with timed contacts (TON solver logic exists from Phase A; TOF added), control relays (KA), limit switches, transformer (step-down, e.g. 400→24 V tag transform) and AC→DC rectifier block.
4. **Selected Tier 3** *(cut-list candidates)*: simplified VFD, inductive/capacitive sensors.
5. **Extended solver**: breaker trip modeling (manual trip + overcurrent flag from short detection), transformer/rectifier potential-tag transforms.
6. **Palette v2**: categories, search, favorites; 50+ component types browsable.
7. **Project templates**: the 3 canonical circuits + traffic light + bottle line as bundled `.zcade` examples with a "New from template" dialog.
8. *(Cut-list)* Documentation generation from schematic (auto circuit description).

### Specialist Agents Required
- **Export & Documents Engineer (DOC)** — Expertise: PDF generation, vector graphics, DIN/ISO drawing standards. Owns: `src/io/pdf/`, `src/io/bom/`. Produces: PDF export, BOM.
- **Component Library Engineer (LIB)** — Expertise: IEC component behavior, symbol authoring (uses SYM's pipeline), solver extension patterns. Owns: `src/components/symbols/library/` additions, palette. Produces: Tier 2/3 components, search, templates.
- **SVG Symbol Architect (SYM)** — contributor (~0.5 w): reviews all new symbols for IEC fidelity and pipeline conformance.
- **Simulation Solver Engineer (SOLV)** — contributor (~0.5 w): reviews trip/transform solver extensions (LIB implements, SOLV approves).
- **QA & Test Engineer (QA)** — continues: PDF visual regression, BOM accuracy tests.

### Task Breakdown by Role

```
## Role: Export & Documents Engineer (DOC)
- W5 D23-24: PDF spike: render one canonical circuit to vector PDF; pick final
             library path (Appendix 10.6); DIN 6771 title block layout spec.
- W5 D25 – W6 D27: Full export: page setup dialog (size/orientation/scale),
             title block editor, multi-page, wire/junction fidelity.
- W6 D28-29: BOM engine: roll-up rules, per-component part-number fields,
             CSV writer, XLSX writer.
- W7 D31-32: PDF visual regression harness with QA (rasterize → compare);
             export the 5 bundled templates as reference PDFs.
- W7 D33:    Polish, docs, gate demo.

## Role: Component Library Engineer (LIB)
- W5 D23-25: TOF timer solver logic + timer components (TON/TOF) with symbols;
             KA relays; limit switches.
- W6 D26-28: Transformer + rectifier (potential-tag transform in solver —
             SOLV reviews); breaker trip modeling (manual + overcurrent flag).
- W6 D29 – W7 D31: Palette v2: categories, fuzzy search, favorites;
             Tier 3 (VFD, sensors) IF on schedule.
- W7 D32-33: Templates: 5 bundled examples + "New from template" dialog;
             component reference docs (one page per type, auto-listed).
```

### Inter-Phase Dependencies
- **Hard blockers from A**: symbol pipeline, frozen circuit types, persistence (templates are saved files), TON pattern.
- **Soft dependency on B/C**: templates that include PLC/scene content need B/C merged — those two templates are added in W7 after G-C.
- **Blocks Phase E**: all D UI strings must exist before translation; G-D (Sep 9) lands before E's translation pass (W8 D38+). Blocks Phase F: templates + reference PDFs feed the website gallery.

### Integration Points
- PDF export consumes the *same* symbol path data as canvas rendering (single source of truth — no separate print drawings).
- LIB's solver changes go through SOLV review — LIB never merges solver changes without it.
- BOM reads component properties only (no solver coupling).

### Success Criteria & Validation Gate (G-D, Sep 9)
1. Any of the 5 templates exports to a PDF that Zuzo judges "looks like a professional electrical drawing" (acceptance test) — correct title block, line weights, legible at print size.
2. BOM for the Y-Δ template is 100% accurate (every component, correct quantities, merged duplicates).
3. 50+ component types in palette; search returns correct results; every Tier 2 component has a behavior test.
4. Breaker trip + transformer logic covered by solver tests; full regression green.

**NO-GO path**: cut Tier 3 + XLSX (keep CSV) + doc generation; PDF and BOM themselves are non-negotiable.

### Risks & Mitigation
1. **Vector PDF fidelity is fiddly** (fonts, dashes, transforms). *Mitigation*: D23-24 spike de-risks library choice before committing; visual regression harness catches drift. *Escalation*: fall back to high-DPI raster export (600 dpi) for V1.0 — acceptable, not preferred.
2. **Transformer tag-transform breaks solver assumptions** (potentials are currently source-fixed). *Mitigation*: model transformer secondary as a *derived source* (new tags minted per transformer instance), which fits the existing model; SOLV design review before code.
3. **Parallel-phase review bandwidth** (TL reviewing C and D simultaneously). *Mitigation*: staggered start (D begins D23 after C's contract freeze); SYM/SOLV delegate-review LIB's work.

---

## Phase E — UI Polish & Localization

**Duration**: Weeks 8–9 (1.5 weeks: Sep 10 – Sep 22, includes G-E) | **Effort**: ~5.5 person-weeks | **Critical Path**: YES

### Objectives
Make it feel professional on first click: refined dark/light themes, full localization (ES/EN/PT/FR), keyboard-only workflow, accessibility pass, cross-platform verification, and performance tuning to the <2 s launch / 60 FPS / 50 Hz budgets.

### Deliverables
1. **Theming**: light theme built out (dark exists); theme toggle persisted; Konva canvas colors themed (grid, wires, symbols) not just DOM.
2. **Localization**: ES (source), EN, PT, FR complete for all UI strings (scaffolded since Phase A, so this is translation + review, not refactoring); locale switcher; localized number/date formats in title blocks.
3. **Keyboard**: complete keyboard-only workflow (palette navigation, place, wire, select, properties); shortcut reference card (Ctrl+K overlay). *(Customization UI is cut-list.)*
4. **Accessibility**: WCAG 2.1 AA audit on all DOM UI (contrast, focus order, ARIA on panels/dialogs); canvas-specific affordances (zoom-to-fit, high-contrast wire mode). Full AA on canvas internals is V1.1 (documented exception list).
5. **Performance**: profiling pass (launch time, first-paint, tick time, memory at 500 components); fixes to meet budgets (Appendix 10.7); startup <2 s on reference modest hardware.
6. **Cross-platform testing**: Windows 10/11, macOS 13+ (Intel+ARM), Ubuntu 22.04, Chrome/Firefox web build — full manual test protocol executed on each.
7. **Visual regression suite**: Playwright screenshot tests for key screens × 2 themes × 2 locales.
8. **User documentation**: getting-started guide, canonical-circuit tutorials (from templates), PLC guide (B) and process-view guide (C) polished; *video tutorials are cut-list*.

### Specialist Agents Required
- **UX & Theming Engineer (UX)** — Expertise: design systems, Tailwind, Konva styling. Owns: themes, polish backlog, shortcut overlay. Produces: light theme, refinement pass.
- **i18n & Accessibility Engineer (I18N)** — Expertise: react-i18next, WCAG, es/en/pt/fr fluency. Owns: `src/locales/`, a11y fixes. Produces: 4 locales, audit + fixes.
- **Performance Engineer (PERF)** — Expertise: profiling, React/Konva optimization, Tauri startup. Owns: perf backlog. Produces: budget compliance report + fixes.
- **QA & Test Engineer (QA)** — continues: cross-platform protocol, visual regression suite.

### Task Breakdown by Role

```
## Role: UX & Theming Engineer (UX)
- W8 D36-38: Light theme (DOM + canvas token system); theme QA both modes;
             polish backlog triage with Zuzo (top 20 papercuts only).
- W9 D39-41: Papercut fixes; shortcut overlay (Ctrl+K); empty states,
             onboarding hints; final visual pass with I18N (text expansion).

## Role: i18n & Accessibility Engineer (I18N)
- W8 D36-37: String freeze audit (CI check: no unkeyed strings); EN translation
             complete + reviewed.
- W8 D38 – W9 D39: PT + FR translations; layout fixes for text expansion;
             localized formats.
- W9 D40-41: WCAG audit (axe + manual keyboard pass); fix criticals; document
             V1.1 exception list; keyboard-only workflow verified end-to-end.

## Role: Performance Engineer (PERF)
- W8 D36-37: Profile: cold launch, 500-component load, tick time, FPS, memory.
             Ranked bottleneck list vs. budgets (Appendix 10.7).
- W8 D38 – W9 D40: Fixes (typical: palette lazy-loading, symbol path caching,
             layer batching, Tauri window preload, store selector hygiene).
- W9 D41:    Re-measure on reference hardware; publish budget compliance report.

## Role: QA & Test Engineer (QA)
- W8 D36-38: Playwright visual regression suite (screens × themes × locales);
             cross-platform manual protocol authored.
- W9 D39-41: Execute protocol on Win/macOS/Linux/Web; log + triage findings;
             full regression; Gate G-E report.
```

### Inter-Phase Dependencies
- **Hard blockers**: C and D merged (feature-complete UI is what gets polished/translated); string freeze at start of E (any post-freeze string change requires 4-locale update in the same PR).
- **Blocks Phase F**: packaging polish-complete builds; release notes reference final UI.

### Success Criteria & Validation Gate (G-E, Sep 22) → tags `v0.9.0-rc1`
1. Launch <2 s cold on reference modest hardware (2019 i5 / 8 GB, measured).
2. 100% strings translated in 4 locales; no truncation/overflow in any locale (visual regression green).
3. Keyboard-only: build the DOL circuit start-to-finish without a mouse (recorded).
4. WCAG: zero critical/serious axe findings on DOM UI; exception list approved by Zuzo.
5. Cross-platform protocol passed on all 4 targets; platform-specific bugs ≤ minor.
6. Visual regression + full functional regression green.

**NO-GO path**: cut PT/FR (ship ES/EN); cut shortcut overlay; extend ≤3 days from Buffer #2. Launch-time and ES/EN completeness are non-negotiable.

### Risks & Mitigation
1. **Translation quality in PT/FR** (agent fluency ≠ electrotechnical terminology). *Mitigation*: glossary of IEC terms per language built first; Zuzo spot-reviews ES (source) and the glossary. *Escalation*: cut to ES/EN.
2. **Perf fixes destabilize features in the last mile**. *Mitigation*: every perf PR runs full regression; no architectural rewrites allowed in E (only measured, local optimizations).
3. **Cross-platform surprises** (Tauri quirks on Linux, ARM mac). *Mitigation*: CI has built all-platform bundles since Phase A (build errors surface early, not in E); protocol runs early-week, not gate-day.

---

## Phase F — Release & Community

**Duration**: Weeks 10–11 (Sep 23 – Oct 9; Buffer #2 inside window) | **Effort**: ~5 person-weeks | **Critical Path**: YES

### Objectives
Ship v1.0.0: signed installers for three platforms, public GitHub repository with CI/CD, project website with docs and gallery, and the community infrastructure (issues, discussions, contribution guide, CADe SIMU migration guide) to sustain adoption.

### Deliverables
1. **Release pipeline**: GitHub Actions matrix build → signed artifacts (Windows NSIS/MSI + code-signing cert; macOS DMG universal + notarization; Linux AppImage + .deb); auto-update feed (Tauri updater); reproducible release from tag.
2. **Open-source launch**: license decision executed (brief says MIT — confirm with Zuzo; note CADe SIMU trademark considerations in naming), README, CONTRIBUTING, code of conduct, issue/PR templates, architecture overview doc.
3. **Website** (static, GitHub Pages): landing, feature tour with screenshots/GIFs, download links per platform, docs (from `/docs`), gallery of example projects, ES/EN.
4. **Web deployment** *(cut-list — ship ≤2 weeks post-V1.0 if tight)*: Vite SPA build with file download/upload persistence.
5. **Community content**: 5+ polished example projects, template contribution guide, **CADe SIMU migration guide** (concept mapping, feature comparison table, honest gaps list).
6. **Release notes** + versioning policy (semver; V1.1 roadmap seeded from cut list).
7. **Support infrastructure**: GitHub Discussions categories, bug triage labels/SLA, crash log capture instructions (offline-first: local log file, user-initiated share — no telemetry).

### Specialist Agents Required
- **Release & DevOps Engineer (REL)** — Expertise: GitHub Actions, Tauri bundling, codesigning/notarization. Owns: `.github/workflows/release/`, packaging. Produces: signed installers, pipeline, auto-update.
- **Community & Docs Engineer (COMM)** — Expertise: technical writing, docs sites, OSS community practice. Owns: website, `/docs`, community files. Produces: website, migration guide, examples.
- **QA & Test Engineer (QA)** — continues: release-candidate validation on all platforms, installer smoke tests.
- **Tech Lead (TL)** — release captain: go/no-go, tag, publish.

### Task Breakdown by Role

```
## Role: Release & DevOps Engineer (REL)
- W10 D43-44: Release workflow: tag → matrix build → artifacts. Windows signing
              (cert from week 1) + macOS notarization wired and verified.
- W10 D45-46: Installer UX (icons, file association .zcade, shortcuts);
              Tauri auto-updater against a test feed.
- W10 D47:    Full dry run: rc2 tag → all installers → install-test on clean VMs.
- W11 D48-49: Fix dry-run findings; final pipeline freeze.
- W11 D50-52: Release execution: tag v1.0.0, publish artifacts, verify update
              feed, monitor first-48h reports.

## Role: Community & Docs Engineer (COMM)
- W10 D43-45: Website build (landing, features, downloads, docs import);
              screenshots/GIFs from final build; ES/EN.
- W10 D46-47: CADe SIMU migration guide (with Zuzo review — domain accuracy);
              example gallery (5+ projects with thumbnails).
- W11 D48-49: README/CONTRIBUTING/CoC/templates; release notes; V1.1 roadmap
              doc seeded from cut list.
- W11 D50-52: Launch posts (relevant education/automation communities, per
              Zuzo's list); Discussions seeded with FAQ; triage rotation doc.

## Role: QA & Test Engineer (QA)
- W10 D43-46: RC validation: full manual protocol + regression on rc builds
              from the actual release pipeline (not dev builds).
- W10 D47 – W11 D49: Installer matrix: clean install, upgrade-in-place,
              uninstall, file association, offline first-run on each OS.
- W11 D50:    Final sign-off checklist to TL.
```

### Inter-Phase Dependencies
- **Hard blockers**: G-E passed (`v0.9.0-rc1`); certificates valid (ordered week 1); Zuzo's license + naming confirmation (needed by D43).
- **Blocks**: nothing — this is the end. V1.1 planning doc is the handoff.

### Integration Points
- Release builds come from the *same* CI definitions used all project (no bespoke release machine).
- Website docs are generated from `/docs` in-repo (single source; no wiki drift).

### Success Criteria & Validation Gate (Release go/no-go, Oct 8)
1. Signed, notarized installers install and run clean on fresh Win/macOS/Linux VMs, fully offline.
2. Auto-update rc→final verified.
3. Website live; downloads work; docs complete in ES/EN.
4. Zero known critical bugs; ≤5 known majors, all documented in release notes.
5. Zuzo final acceptance: builds each canonical circuit + runs bottle line on their own machine from a downloaded installer.

**Post-release success (30 days)**: 1000+ downloads, <5 community-reported criticals, active Discussions, ≥1 educational institution pilot (Zuzo's network).

### Risks & Mitigation
1. **Signing/notarization failures at the wire** (Apple rejection, cert chain issues). *Mitigation*: certs procured week 1; notarization exercised in CI from Phase E; full dry run D47 — 5 working days of slack before release day.
2. **Launch-day critical bug**. *Mitigation*: RC soak week (rc1 from Sep 22 used internally by all agents + Zuzo daily); hotfix path documented (patch tag → pipeline reruns in <2 h).
3. **Community expectations vs. V1.0 scope** (CADe SIMU users expecting full parity). *Mitigation*: migration guide includes an honest "not yet in V1.0" table tied to the public V1.1 roadmap.

---

# Section 3 — Agent Roles Across All Phases

## 3.1 Role × Phase Matrix

`L` = Lead (owns the phase's deliverables in their domain) · `C` = Contributor (bounded, on-call or review) · `–` = not active

| # | Role | ID | A | B | C | D | E | F |
|---|------|----|---|---|---|---|---|---|
| 1 | SVG Symbol Architect | SYM | **L** | C | – | C | – | – |
| 2 | Routing & Geometry Engineer | ROUTE | **L** | – | – | – | – | – |
| 3 | Core State Engineer | CORE | **L** | C | C | – | – | – |
| 4 | Simulation Solver Engineer | SOLV | **L** | C | – | C | – | – |
| 5 | ERC & Validation Engineer | ERC | **L** | – | – | C | – | – |
| 6 | QA & Test Engineer | QA | **L** | **L** | **L** | **L** | **L** | **L** |
| 7 | PLC Runtime Engineer | PLC | – | **L** | C | – | – | – |
| 8 | Ladder Editor Engineer | LAD | – | **L** | – | – | – | – |
| 9 | Pneumatics Engineer | PNEU | – | **L** | – | – | – | – |
| 10 | 2D Process Engineer | PROC | – | – | **L** | – | – | – |
| 11 | Process Elements Designer | ELEM | – | – | **L** | – | – | – |
| 12 | Export & Documents Engineer | DOC | – | – | – | **L** | – | – |
| 13 | Component Library Engineer | LIB | – | – | – | **L** | – | – |
| 14 | UX & Theming Engineer | UX | – | – | – | – | **L** | – |
| 15 | i18n & Accessibility Engineer | I18N | – | – | – | – | **L** | – |
| 16 | Performance Engineer | PERF | – | – | – | – | **L** | – |
| 17 | Release & DevOps Engineer | REL | C* | – | – | – | C | **L** |
| 18 | Community & Docs Engineer | COMM | – | – | – | – | – | **L** |
| — | Tech Lead | TL | **L** | **L** | **L** | **L** | **L** | **L** |

\* REL's Phase A slice = CI pipeline setup with QA (0.3 w) + certificate procurement checklist for Zuzo.

**Distinct roles: 13 core specialists** (some agents can be re-instantiated per phase; UX/I18N/PERF/COMM are single-phase roles, giving 18 role-slots total) **+ QA (permanent) + Tech Lead (permanent)**.

## 3.2 Role Definitions

**SYM — SVG Symbol Architect**
- *Expertise*: IEC 60617 symbology, SVG authoring, vector rendering in Konva.
- *Phases*: Lead A; Contributor B (pneumatic symbol pipeline support), D (symbol review for LIB).
- *Key deliverables*: symbol metadata schema (project-lifetime contract), rendering pipeline, Tier 1 set, symbol authoring guide (enables LIB/PNEU to self-serve).
- *Onboard/offboard*: Day 1; offboards after G-D review duties (Sep 9). The authoring guide is the handoff artifact.

**ROUTE — Routing & Geometry Engineer**
- *Expertise*: A*/Dijkstra pathfinding, computational geometry, spatial indexing.
- *Phases*: Lead A only.
- *Key deliverables*: A* router, incremental re-route, waypoint editing, perf harness.
- *Onboard/offboard*: Day 1 → G-A. Router is stable infrastructure afterward; bugs route to TL.

**CORE — Core State Engineer**
- *Expertise*: Zustand architecture, command pattern, serialization/versioned schemas.
- *Phases*: Lead A; on-call B/C (schema extensions for plcPrograms/scene: reviews, ~0.2 w each).
- *Key deliverables*: undo/redo, persistence, autosave, i18n scaffold, schema governance.
- *Onboard/offboard*: Day 1; on-call through C. Owns `.zcade` schema versioning for project lifetime.

**SOLV — Simulation Solver Engineer**
- *Expertise*: circuit theory, relay/ladder logic, fixed-point/discrete simulation.
- *Phases*: Lead A; Contributor B (PLC-contact integration review), D (transformer/trip review).
- *Key deliverables*: canonical-circuit-complete solver, `types/circuit.ts` contract ownership.
- *Onboard/offboard*: Day 1; review-only after G-B.

**ERC — ERC & Validation Engineer**
- *Expertise*: electrical rule checking, IEC 60364 basics, static analysis UX.
- *Phases*: Lead A (from D5); Contributor D (rules for new component types).
- *Onboard/offboard*: Day 5 → G-A; brief return in D week 7.

**QA — QA & Test Engineer** *(permanent)*
- *Expertise*: Vitest, Playwright, CI, test architecture, benchmark harnesses.
- *Phases*: Lead in all six.
- *Key deliverables*: CI, regression suite (grows every phase, never shrinks), gate reports, perf benchmarks, cross-platform protocol, RC validation.
- *Onboard/offboard*: Day 1 → release. **The single thread of continuity across all phases besides TL.**

**PLC — PLC Runtime Engineer**
- *Expertise*: IEC 61131-3, Siemens LOGO! semantics, scan-cycle determinism.
- *Phases*: Lead B; Contributor C (binding API, ~0.5 w).
- *Onboard*: D8 of Phase A (low-risk design spike: instruction-set doc only); full-time D11.

**LAD — Ladder Editor Engineer** — *Expertise*: visual-programming editors, React/Konva. Lead B only (D11 → G-B).

**PNEU — Pneumatics Engineer** — *Expertise*: pneumatic circuit design, ISO 1219, discrete solvers. Lead B only (D11 → G-B).

**PROC — 2D Process Engineer** — *Expertise*: canvas game-loops, deterministic simulation, ECS-lite. Lead C only (D21 → G-C; coupling spec read during B W4).

**ELEM — Process Elements Designer** — *Expertise*: industrial-process visualization, 2D art, config UX. Lead C only.

**DOC — Export & Documents Engineer** — *Expertise*: vector PDF generation, DIN 6771/technical drawing standards, spreadsheet formats. Lead D only (D23 → G-D).

**LIB — Component Library Engineer** — *Expertise*: component behavior modeling, symbol authoring (per SYM's guide), palette UX. Lead D only.

**UX / I18N / PERF** — single-phase E leads as defined in Phase E. Onboard D36 with a walkthrough from QA + TL; offboard at G-E.

**REL — Release & DevOps Engineer** — *Expertise*: GitHub Actions, Tauri bundling, signing/notarization. Contributor A (CI, 0.3 w) + E (release-build dry runs, 0.3 w); Lead F.

**COMM — Community & Docs Engineer** — *Expertise*: technical writing, OSS community ops, ES/EN. Lead F only (D43 → post-release).

**TL — Tech Lead** *(permanent, ~0.5 w/week)* — contract freezes, PR review (or delegated review), EOD syncs, gate decisions, this document's upkeep, escalation endpoint, release captain.

---

# Section 4 — Parallel Work Strategy

## 4.1 Parallelism Map

```
PHASE A (weeks 1-2) — 6 concurrent agents, near-total parallelism
  Stream A1: SYM   ── symbols ──────────────┐
  Stream A2: ROUTE ── routing ──────────────┤   join: canonical-circuit
  Stream A3: CORE  ── undo/persist/i18n ────┼──▶ integration (W2 D9-10)
  Stream A4: SOLV  ── solver extensions ────┤   run by QA + TL
  Stream A5: ERC   ── (from D5) rules ──────┤
  Stream A6: QA    ── CI + tests (continuous)┘
  Coupling device: types/circuit.ts + symbol schema FROZEN end of Day 2.
  After the freeze, streams touch disjoint directories (Section 9.3).

PHASE B (weeks 3-4) — 4 concurrent
  B1: PLC runtime ──┐ (PLC↔LAD share the compiled-program contract, frozen D12)
  B2: LAD editor  ──┤
  B3: PNEU        ──┘ (independent until W4 coupling tests)
  B4: QA (continuous)

PHASES C ∥ D (weeks 5-7) — 5-6 concurrent across two phases
  Critical path:   C: PROC + ELEM + PLC(c) + QA
  Parallel stream: D: DOC + LIB (+ SYM/SOLV reviews)
  No shared files: C owns engine/process + ProcessView; D owns io/pdf,
  io/bom, symbol library additions. Merge order: C first (gate), D follows.

PHASE E (weeks 8-9) — 4 concurrent
  UX ∥ I18N ∥ PERF ∥ QA — coupled only by the string freeze and the rule
  that perf PRs run full regression.

PHASE F (weeks 10-11) — 3 concurrent
  REL (pipeline) ∥ COMM (website/docs) ∥ QA (RC validation) — fully parallel
  until the release-day join.
```

## 4.2 What Parallelization Buys

| Phase | Sequential effort | Elapsed with parallelism |
|---|---|---|
| A | 10.5 pw | 2 weeks |
| B | 8 pw | 2 weeks |
| C + D | 14 pw | 2.5 weeks (overlapped) |
| E | 5.5 pw | 1.5 weeks |
| F | 5 pw | 2 weeks (incl. buffer) |
| **Total** | **≈48 pw ≈ 10-11 months solo** | **11 weeks** |

The single biggest scheduling win is **C ∥ D** (saves 2 full weeks vs. waterfall). The single biggest *risk-reduction* win is Phase A's Day-2 contract freeze — it converts 4 interdependent workstreams into 4 independent ones for 8 of 10 days.

## 4.3 Rules That Make Parallelism Safe

1. **Contract freeze before fan-out**: every phase spends its first 1–2 days agreeing interfaces (types, schemas, memory maps), then freezes them. Post-freeze changes need TL sign-off + same-day migration.
2. **Directory ownership** (Section 9.3): no two agents write the same directory in the same phase.
3. **Daily merge to main**: no branch lives >2 days; integration pain is paid in small daily installments.
4. **QA is never parallel-blind**: the regression suite runs on every PR from every stream, so stream A4 finds out immediately if stream A2 broke it.
5. **Stagger onboarding when review bandwidth binds**: ERC (D5), PLC spike (D8), DOC/LIB (D23) start after the adjacent streams' contracts settle.

---

# Section 5 — Quality & Testing Strategy

## 5.1 Coverage Targets by Phase

| Phase | Unit coverage (engine) | Unit (UI/stores) | Integration scenarios | New tests added |
|---|---|---|---|---|
| A | ≥90% solver/routing/graph | ≥75% stores | 3 canonical circuits e2e + undo fuzz + save/load round-trip | ~80 |
| B | ≥90% PLC/pneumatic | ≥70% ladder editor | PLC chain, traffic light, cylinder reciprocation | ~60 |
| C | ≥85% process engine | – | bottle line e2e, determinism, coupling | ~35 |
| D | ≥85% pdf/bom/new components | ≥70% palette | PDF visual regression, BOM accuracy | ~40 |
| E | maintain | maintain | visual regression (screens×themes×locales), cross-platform protocol | ~30 |
| F | maintain | maintain | installer matrix, update path | ~15 |

Coverage is measured in CI; a PR that drops coverage below target for its area fails.

## 5.2 The Regression Suite (anti-regression between phases)

- The suite is **append-only**: every phase's gate tests join the permanent suite. Phase C cannot pass its gate with any Phase A/B test red.
- The three canonical circuits are the project's **golden tests** — they run on every PR forever. Any change that alters their simulation output fails CI and requires explicit TL review of the diff.
- Deterministic simulation testing: all engine tests drive `tick()` manually with a virtual clock — no wall-clock timing, no flaky sleeps.
- Perf benchmarks (routing <16 ms, tick <5 ms, FPS) run nightly in CI with recorded trends; a >20% regression opens an automatic finding.

## 5.3 Integration Testing at Boundaries

Each inter-agent boundary gets a dedicated contract test owned by QA:
- symbol schema ↔ solver role derivation ("every library component acquires a role or is explicitly roleless")
- router output ↔ graph builder (routed wires produce identical nets to straight-line wires)
- PLC scan ↔ solver tick (determinism, 1-tick latency guarantee)
- scene bindings ↔ PLC memory (sensor visible same-scan)
- canvas render path ↔ PDF export path (same geometry source)

## 5.4 User Acceptance Testing

- **Who**: Zuzo (Product Owner, domain expert) — the only human in the loop, so UAT is scheduled, not ad-hoc.
- **When**: last day of every phase gate + a standing mid-phase checkpoint (30–60 min): D5, D15, D25/D28, D38, D47.
- **What**: scripted acceptance tasks defined in each gate (e.g., "draw DOL from blank canvas in <10 min", "PDF looks professional", "build the chain demo following the guide").
- **Dogfooding**: from `v0.9.0-rc1`, Zuzo uses the app for real drawing work daily; findings triaged next morning.

## 5.5 Code Review Process

- **Every PR** reviewed before merge: TL by default; delegated to domain leads where defined (SYM reviews LIB symbols, SOLV reviews solver-touching PRs regardless of author).
- **Checklist** (applies to all PRs): types complete (no `any`), tests included for behavior changes, no unkeyed UI strings (post-A), no cross-directory writes outside ownership, CLAUDE.md/roadmap updated if a decision changed, perf-sensitive paths benchmarked.
- **Approval gates**: CI green is necessary but not sufficient — human (TL/delegate) approval required on: `types/circuit.ts`, solver, persistence schema, PLC memory map, release pipeline.

## 5.6 Performance Benchmarks (tracked from Phase A)

See Appendix 10.7 for budgets. Measured: cold launch, 500-component file open, full re-route, solver tick p95, PLC scan p95, FPS (canvas + scene), heap at 500 components. Reference hardware: 2019-class i5 / 8 GB (Zuzo defines the exact reference machine week 1).

---

# Section 6 — Risk Register & Mitigation (Top 10)

## Risk 1: Solver correctness for canonical circuits (cross-instance contacts, Y-Δ sequencing)
**Probability**: Medium | **Impact**: Critical | **Phase**: A
**Mitigation**: dedicated SOLV agent from Day 1; test-first against all three circuits; oscillation-stability test for the fixed-point loop; gate G-A hard-blocks on them.
**Owner**: SOLV | **Escalation**: any circuit not green by D8 → TL redesigns evaluation order immediately; Buffer #1 available.

## Risk 2: Undo/redo state corruption across three stores
**Probability**: Medium | **Impact**: High | **Phase**: A
**Mitigation**: single history stack of composite commands; fuzz testing from D5; ESLint ban on direct `set()` outside commands.
**Owner**: CORE | **Escalation**: corruption reproducible after D8 → freeze feature surface, TL + CORE pair until fixed.

## Risk 3: SVG symbol precision/performance at extreme zoom
**Probability**: Medium | **Impact**: High | **Phase**: A
**Mitigation**: D2-3 rendering spike before mass symbol production; vector path rendering (no rasterization); zoom stress tests (0.1×–10×) in the gate.
**Owner**: SYM | **Escalation**: artifacts persist → hand-traced Konva.Path fallback for Tier 1; decision by D4.

## Risk 4: Code-signing certificate lead time (Windows cert, Apple notarization)
**Probability**: Medium | **Impact**: High (blocks release) | **Phase**: F (action in A)
**Mitigation**: Zuzo orders certs + Apple Developer account in **week 1**; notarization exercised in CI during Phase E; dry run D47.
**Owner**: REL (checklist), Zuzo (procurement) | **Escalation**: cert not in hand by week 8 → plan unsigned Linux/portable-zip Windows release with signed follow-up.

## Risk 5: i18n retrofit cost
**Probability**: High if unmitigated | **Impact**: Medium | **Phase**: E (action in A)
**Mitigation**: i18n scaffold + no-bare-strings lint rule from Phase A → E is translation, not refactoring.
**Owner**: CORE (scaffold), I18N (delivery) | **Escalation**: cut PT/FR (Section 0, Q8).

## Risk 6: 2D coupling architecture wrong → cross-subsystem rework
**Probability**: Medium | **Impact**: High | **Phase**: C
**Mitigation**: coupling spec written in Phase B W4, reviewed by PLC+SOLV+TL before C starts; bindings-as-data; 2-day timebox on redesigns.
**Owner**: PROC | **Escalation**: timebox exceeded → TL decides between simplified one-way coupling for V1.0 or buffer spend.

## Risk 7: Multi-agent merge conflicts / integration drift
**Probability**: Medium | **Impact**: Medium (chronic time loss) | **Phase**: all
**Mitigation**: directory ownership, Day-2 contract freezes, daily merges, branches <2 days old, CI on every PR.
**Owner**: TL | **Escalation**: same-file conflict twice in a phase → ownership map revised same day.

## Risk 8: PDF vector fidelity (fonts, dashes, transforms, DIN compliance)
**Probability**: Medium | **Impact**: Medium | **Phase**: D
**Mitigation**: D23-24 library spike; visual regression harness; Zuzo mid-phase acceptance D28.
**Owner**: DOC | **Escalation**: 600-dpi raster fallback for V1.0.

## Risk 9: Performance collapse at 500 components (render or solver)
**Probability**: Low-Medium | **Impact**: High | **Phase**: C/E
**Mitigation**: benchmarks in CI from Phase A (not discovered in E); separate stages per tab; PERF role dedicated in E; budgets in Appendix 10.7.
**Owner**: QA (detection), PERF (fix) | **Escalation**: budget miss after E tuning → descope visual niceties (glow effects, shadows) before touching features.

## Risk 10: Timeline slip accumulation (many small overruns)
**Probability**: Medium | **Impact**: High | **Phase**: all
**Mitigation**: two explicit buffers (0.5 w after C/D, 1 w inside F); gates refuse to pass broken work (slip early, not late); ranked cut list pre-agreed (Section 0 Q8) so descoping is a decision, not a debate.
**Owner**: TL | **Escalation**: projected release slip >1 week past Oct 9 → Zuzo decides between date (cut deeper) and scope (move date, cap Oct 16).

---

# Section 7 — Success Metrics

## Per-Phase (gate-enforced)

| Phase | Success = |
|---|---|
| **A** | 3 canonical circuits draw + simulate perfectly (automated + Zuzo hand-built); undo/redo fuzz clean; save/load round-trip; symbols crisp 0.1×–10×; ERC 0 false ±; CI green |
| **B** | Button→PLC→coil chain built by Zuzo in <15 min from the guide; traffic light timing exact; cylinder auto-reciprocation; ladder round-trips; A regression green |
| **C** | Bottle-filling sim runs flawlessly at 60 FPS with 500 electrical components; 1-tick sync; deterministic; A+B regression green |
| **D** | PDF judged professional by Zuzo; BOM 100% accurate on Y-Δ template; 50+ searchable components; regression green |
| **E** | <2 s cold launch (measured, reference HW); 4 locales complete, no overflow; keyboard-only DOL build; axe zero critical/serious; 4-platform protocol passed |
| **F** | Signed installers on 3 OS, clean offline install; website live; auto-update verified; zero known criticals at tag |

## Overall Project (30/90 days post-release)

- **Adoption**: 1000+ downloads month 1; ≥1 educational institution pilot (Zuzo's network) by day 90.
- **Quality**: <5 critical community bugs month 1; crash-free sessions >99%.
- **Community**: active GitHub Discussions (≥20 threads month 1); ≥3 community-contributed templates by day 90.
- **Mission**: a CADe SIMU user can migrate using the guide and rebuild their teaching circuits — measured by migration-guide feedback thread.

## Leading Indicators (weekly, TL dashboard)

Tests passing/added, coverage by area, benchmark trends, open findings by severity, gate-criteria burndown per phase, buffer remaining.

---

# Section 8 — Agent Launch Instructions

**General protocol for every launch**: agent receives (1) this roadmap, (2) `CLAUDE.md`, (3) role-specific prompt containing: role ID + expertise framing, owned directories, phase task list (from Section 2), frozen contracts to respect, definition of done (gate criteria slice), branching rules (Section 9). Every agent ends each working day with: PR(s) merged or up for review + a 5-line EOD note (done / next / blockers) for the TL sync.

```
## Phase A Launch Sequence (Week 1)
Day 1, Morning:
- Launch SYM, ROUTE, CORE, SOLV, QA (5 agents, parallel).
- QA's first deliverable is CI (required checks live by Day 2).
- Zuzo action item issued: order Windows code-signing cert + Apple Developer
  account TODAY (Risk 4). REL provides the checklist (0.1 w slice).
- TL: schedule contract-freeze review for Day 2 EOD.
Day 2, EOD:
- CONTRACT FREEZE: types/circuit.ts extensions + symbol metadata schema +
  command-pattern interface. All five agents sign off. After this, interface
  changes require TL approval + same-day migration PR.
Day 5, Morning:
- Launch ERC (rule framework; consumes symbol registry + graph, now stable).
- Mid-phase Zuzo checkpoint #1 (30 min): symbol look & feel, routing feel.
Day 8:
- Launch PLC in SPIKE mode (design doc only: LOGO! instruction set,
  Appendix 10.4 draft). No code merged to main.
- TL checkpoint: canonical circuit status vs. gate. If any circuit is red,
  invoke Risk 1 escalation now, not on Day 10.
Day 10 (Aug 7):
- GATE G-A review (TL + QA + Zuzo): walk the 8 GO criteria with evidence.
- GO → tag v0.4.0-phaseA; offboard ROUTE; Phase B launch next morning.
- NO-GO → apply Phase A no-go path; re-gate within ≤5 working days.

## Phase B Launch Sequence (Week 3)
Day 11, Morning:
- Launch LAD, PNEU; PLC converts from spike to full-time.
- QA continues (test plan for B due Day 13).
Day 12, EOD:
- CONTRACT FREEZE: PLC memory map + compiled-program format + pneumatic
  net types. CORE on-call reviews persistence schema extension.
Day 15:
- Zuzo checkpoint #2: pneumatic discrete-model acceptance demo (Risk:
  domain realism) + ladder editor UX preview.
Day 18-19:
- TL + PROC (pre-onboarding, read-only): coupling-bus architecture note
  written and reviewed (unblocks Phase C Day 21 cold start).
Day 20 (Aug 21):
- GATE G-B. GO → tag v0.5.0-phaseB; offboard LAD, PNEU (PLC drops to
  contributor); launch C next morning.

## Phase C ∥ D Launch Sequence (Week 5)
Day 21, Morning:
- Launch PROC, ELEM (Phase C, critical path).
Day 22, EOD:
- CONTRACT FREEZE: scene model + binding contract (PROC + PLC + TL).
Day 23, Morning:
- Launch DOC, LIB (Phase D, parallel stream — staggered 2 days so TL
  review bandwidth covers both freezes).
Day 25:
- Zuzo checkpoint #3a: scene edit/run UX preview.
Day 28:
- Zuzo checkpoint #3b: first PDF export acceptance look (Risk 8).
Day 30 (Sep 4):
- GATE G-C (critical path). GO → tag v0.6.0-phaseC; offboard PROC/ELEM.
Day 31-33:
- D continues through its own gate. Buffer #1 absorbs C/D integration.
Day 33 (Sep 9):
- GATE G-D → tag v0.7.0-phaseD; offboard DOC/LIB; SYM/ERC fully offboard.

## Phase E Launch Sequence (Week 8)
Day 36, Morning:
- Launch UX, I18N, PERF (QA continues). Onboarding walkthrough by TL + QA.
- STRING FREEZE declared: post-freeze string changes must ship all 4 locales.
Day 38:
- Zuzo checkpoint #4: light theme + polish backlog triage (pick top 20).
Day 41/42 (Sep 22):
- GATE G-E → tag v0.9.0-rc1. Zuzo daily dogfooding begins. Offboard UX/I18N/PERF.

## Phase F Launch Sequence (Week 10)
Day 43, Morning:
- Launch REL (full-time), COMM. Prereq check: certificates in hand (Risk 4),
  license/naming confirmed by Zuzo.
Day 47:
- Full release dry run (rc2): tag → build → sign → notarize → install on
  clean VMs (all 3 OS).
Day 49:
- Release go/no-go review (TL + QA + Zuzo) against the 5 release criteria.
Day 50-52 (target Oct 9):
- Tag v1.0.0 → pipeline → publish artifacts + website + announcements.
- 48-hour monitored window: QA + REL on triage; hotfix path armed.
- Post-release: COMM seeds Discussions; TL writes V1.1 kickoff from cut list.
```

**Communication cadence (all phases)**: async EOD notes from every agent → TL; TL posts a daily digest; mid-phase Zuzo checkpoints as scheduled above; gates are synchronous reviews with evidence. Escalations: any agent blocked >4 working hours pings TL immediately (never waits for EOD).

---

# Section 9 — Version Control & Branching Strategy

## 9.1 Model: Trunk-Based with Short-Lived Feature Branches

- `main` is always green (CI-enforced) and always releasable at the current phase's maturity.
- Branch naming: `phase<X>/<role>-<topic>` (e.g. `phaseA/route-astar`, `phaseB/lad-compiler`).
- **Branches live ≤2 days.** Large features merge behind flags (e.g. A* router shipped dark behind a flag on day 3, enabled day 5) rather than living long in a branch.
- No GitFlow, no long-lived develop branch: with 4–6 parallel agents, integration debt compounds daily — we pay it daily instead.

## 9.2 Merge & Review Rules

1. PR → CI (type-check, lint, full test suite, build, coverage floor) → human review (TL or domain delegate per Section 5.5) → squash-merge to `main`.
2. Rebase on `main` before merge; the PR author resolves conflicts (rare by design — see ownership).
3. Protected paths requiring named-owner approval regardless of author: `src/types/circuit.ts` (SOLV), persistence schema (CORE), PLC memory map (PLC), `.github/workflows/` (REL/QA), this file + `CLAUDE.md` (TL).
4. Conventional commit messages (`feat(routing): …`, `fix(solver): …`) — release notes are generated from them in Phase F.

## 9.3 Conflict Prevention: Directory Ownership Map

| Path | Owner (writes) | Others |
|---|---|---|
| `src/engine/solver.ts`, `graph.ts`, `src/types/circuit.ts` | SOLV | read-only; PRs need SOLV review |
| `src/engine/routing/`, `wiring.ts` | ROUTE | read-only |
| `src/engine/erc/` | ERC | read-only |
| `src/engine/plc/` | PLC | read-only |
| `src/engine/pneumatic/` | PNEU | read-only |
| `src/engine/process/` | PROC (elements/: ELEM) | read-only |
| `src/store/`, `src/io/` (persistence) | CORE | read-only |
| `src/io/pdf/`, `src/io/bom/` | DOC | read-only |
| `src/components/symbols/` | SYM (Phase D additions: LIB w/ SYM review) | read-only |
| `src/components/Canvas/` | shared UI — TL assigns per-PR in EOD sync | coordinate |
| `src/components/LadderEditor/` | LAD | read-only |
| `src/components/ProcessView/` | PROC/ELEM | read-only |
| `src/locales/` | I18N (CORE scaffolds in A) | string PRs only |
| `tests/` | QA owns structure; each agent writes tests for their area | additive |
| `.github/workflows/` | QA (CI) / REL (release) | read-only |

Shared-file hotspots (`CanvasStage.tsx`, `Toolbar.tsx`) are the known conflict zone: TL sequences changes to them explicitly in the daily digest (max one open PR touching each at a time).

## 9.4 Phase Integration & Tagging

- A phase is "integrated" when its gate passes **on `main`** — gates are never reviewed on branches. There is no big-bang merge at phase end because merging happened daily.
- Tags: `v0.4.0-phaseA`, `v0.5.0-phaseB`, `v0.6.0-phaseC`, `v0.7.0-phaseD`, `v0.9.0-rc1` (G-E), `v1.0.0` (release). Patch tags (`v1.0.1`) for hotfixes via the same pipeline.
- Rollback story: any gate tag is a known-good restore point; feature flags allow disabling a misbehaving subsystem without reverting history.
- Post-release: `main` continues toward V1.1; hotfixes cherry-pick to a `release/1.0` branch cut at `v1.0.0`.

---

# Section 10 — Technical Appendix

## 10.1 SVG Symbol Metadata Schema (draft — SYM finalizes Day 2)

```json
{
  "id": "contactor_3p",
  "standard": "IEC 60617",
  "label_prefix": "KM",
  "viewBox": [0, 0, 60, 100],
  "svg": "symbols/contactor_3p.svg",
  "pins": [
    { "id": "1", "x": 10, "y": 0,   "kind": "power" },
    { "id": "2", "x": 10, "y": 100, "kind": "power" },
    { "id": "A1", "x": 50, "y": 0,  "kind": "coil" },
    { "id": "A2", "x": 50, "y": 100,"kind": "coil" }
  ],
  "contacts": [
    { "segment": ["1","2"], "behavior": "no", "control": "coil" },
    { "segment": ["13","14"], "behavior": "no", "control": "coil" }
  ],
  "stateLayers": {
    "energized": "layer:coil-highlight",
    "contact_closed": "layer:bridge-closed"
  },
  "linkable": { "tagPrefix": "KM", "acceptsRemoteContacts": true }
}
```
Notes: pin coordinates in symbol-local px on the same 10 px grid; `kind` drives solver role derivation (see CLAUDE.md Phase 3) — the schema review with SOLV on Day 2 exists precisely because a wrong `kind` silently produces a dead component; `stateLayers` lets one SVG carry open/closed/energized variants as toggleable layers instead of separate files.

## 10.2 Undo/Redo Command Pattern (pseudo-code)

```typescript
interface Command {
  readonly label: string;              // i18n key, shown in Edit menu
  do(stores: StoreBundle): void;
  undo(stores: StoreBundle): void;
  coalesceWith?(next: Command): Command | null;  // drag merging
}

class Transaction implements Command {   // e.g. delete component + its wires
  constructor(private children: Command[]) {}
  do(s)   { this.children.forEach(c => c.do(s)); }
  undo(s) { [...this.children].reverse().forEach(c => c.undo(s)); }
}

// History: single stack pair over ALL stores. No per-store histories.
class History {
  private undoStack: Command[] = [];    // cap 200
  private redoStack: Command[] = [];
  execute(c: Command) { c.do(stores); this.pushCoalesced(c); this.redoStack = []; }
  undo() { const c = this.undoStack.pop(); if (c) { c.undo(stores); this.redoStack.push(c); } }
  redo() { const c = this.redoStack.pop(); if (c) { c.do(stores); this.undoStack.push(c); } }
}
// Rule (ESLint-enforced): UI never calls store.set* directly; it builds a
// Command and calls history.execute(). Simulation state is NOT in history
// (operate-mode actions are not undoable).
```

## 10.3 Auto-Routing Algorithm Outline

```
Input:  pinA, pinB (world px), obstacles = component bboxes + 2-cell clearance
Grid:   10 px cells over the bounding region of A,B inflated by margin
Search: A* where
        cost = steps + TURN_PENALTY * direction_changes
               + CROSS_PENALTY * existing_wire_crossings (soft)
        neighbors = 4-connected; cells inside obstacles are blocked,
        except each pin's own cell + its escape stub direction
Tie-break: prefer continuing current direction (fewer bends);
        prefer alignment with existing net segments (bus aesthetics)
Post:   collapse collinear runs → polyline; simplify staircase artifacts
Incremental: on component move, re-route only wires attached to it or
        whose path intersects the moved bbox (spatial hash lookup)
Fallback: if A* fails (fully blocked), Manhattan elbow (current behavior)
Budget: 500 components / 1000 wires full re-route < 16 ms
```

## 10.4 LOGO!-Style PLC Instruction Set (V1.0 scope)

```
Memory areas: I1..I8 (bool, from schematic nets), Q1..Q4 (bool, drive
ContactSegments), M1..M16 (flags), T1..T8 (timers), C1..C4 (counters)

Boolean:  AND, OR, NOT, XOR, NAND, NOR
Latch:    RS (reset-priority), SR (set-priority)
Edge:     R_TRIG, F_TRIG (one-scan pulse)
Timers:   TON (on-delay), TOF (off-delay), TP (pulse)  — preset in ms,
          resolution = scan (10 ms)
Counters: CTU, CTD (preset, reset input)

Scan cycle (every 10 ms, i.e. 2 scans per 20 ms solver tick):
  1. Snapshot inputs (I) from net energization at module pins
  2. Execute program top-to-bottom (ladder rung order)
  3. Latch outputs (Q) → visible to solver at next tick boundary
Determinism rule: outputs never change mid-solver-relaxation.
Out of scope V1.0: FBD editor, analog I/O, S7 instruction set, retentivity
across stop() (stop = cabinet power loss, consistent with Phase 3 semantics).
```

## 10.5 2D Process Simplified Physics Model

```
Principle: deterministic kinematics, no forces, no collisions solver.
- Conveyor: items advance x += beltSpeed * dt while motorRunning;
  direction from motorDirection; items stop instantly with motor.
- Tank: level += (Σ inflow_open * rate - Σ outflow_open * rate) * dt,
  clamped [0, capacity]; level sensors = threshold comparators.
- Cylinder (pneumatic): position ramps toward target at strokeTime rate.
- Sensors (photocell/limit): axis-aligned zone tests against item positions,
  evaluated at tick boundaries → PLC inputs (never mid-scan).
- Elevator/press (if built): scripted keyframe motion gated by signals.
State advances ONLY in tick() (testable, deterministic); rendering
interpolates between ticks at rAF for smoothness (cosmetic, untested).
```

## 10.6 PDF Export Approach (DOC validates in D23-24 spike)

```
Preferred: shared geometry layer → SVG document per sheet → svg2pdf.js
           (true vector; same path data as canvas render)
Title block: DIN 6771 form as an SVG template with field slots
           (project, drawing no., author, date, sheet x/y, revision)
Pagination: user-defined sheet frames on canvas OR auto-tile by bbox
Fallback (Risk 8): render sheet to offscreen canvas @600 dpi → raster PDF
Fonts: embed a metric-stable open font (e.g. osifont — DIN-style, libre)
```

## 10.7 Performance Budgets (enforced from Phase A, verified in E)

| Metric | Budget | Measured in |
|---|---|---|
| Cold launch → interactive | < 2000 ms | E (nightly from A) |
| Open 500-component file | < 1500 ms | CI benchmark |
| Solver tick p95 (500 comps) | < 5 ms | CI benchmark |
| PLC scan p95 | < 1 ms | CI benchmark |
| Full wire re-route (500/1000) | < 16 ms | CI benchmark |
| Canvas FPS while simulating | ≥ 60 (edit), ≥ 60 (scene tab) | E protocol |
| Heap @ 500 components + scene | < 400 MB | E protocol |
| Installer size | < 30 MB (Tauri) | F |

---

## Change Log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-07-23 | 1.0 | Initial roadmap from `PHASE_A_TECH_LEAD_BRIEF.md` | Tech Lead Agent |
| 2026-07-23 | 1.1 | Zuzo provided the full CADe SIMU v4.2 component catalog (`docs/component-catalog.md`, 15 categories, borne-numbered) as the source of truth for all component pin/label conventions going forward. Reconciled against Phase A's Tier 1 symbol list and against SOLV's already-merged Week 1 solver work: thermal overload relay must carry both its 95-96 (NC) trip contact *and* the 97-98 (NO) fault-signal contact (SOLV's Week 1 placeholder only has 95-96 — add 97-98 when SYM builds the real symbol in Week 2); the TON timer is one component bundling its A1-A2 coil with 55-56 (NO)/57-58 (NC) timed contacts, not a bare coil (relevant to SOLV's still-unstarted Week 2 TON task). Fuse/fusible (distinct from the magnetothermal breaker), control relay (KA, distinct from a contactor), and the additional aux-block terminal-number variants (23-24/33-34/43-44 NO, 31-32/41-42 NC) are confirmed still Tier 2/Phase D — additive components, no solver-mechanism changes, so deferring them carries no rework risk. No change to Phase A's 2-week schedule, Gate G-A criteria, or the 25+ symbol count target. | Tech Lead (Claude) |

**Decisions delegated to Zuzo (needed by the dates shown):**
1. Approve this roadmap (blocks Phase A launch, target Jul 27).
2. Order Windows code-signing certificate + Apple Developer account (week 1 — Risk 4).
3. Confirm license (brief says MIT) and final product name re: CADe SIMU trademark (needed by Day 43, ideally earlier for the website).
4. Define the reference "modest hardware" machine for perf budgets (week 1).
5. Provide the community-launch channel list for Phase F announcements (by week 10).
