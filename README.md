# CADe-Simu Next (OpenCADe)

Modern, open-source, cross-platform industrial schematics and simulation
application inspired by CADe SIMU and PC SIMU. See `CLAUDE.md` for full
project context, architecture, and roadmap.

## Stack

Tauri 2.0 · React 19 · TypeScript · Tailwind CSS · Konva.js · Zustand · Vite

## Commands

```bash
npm run dev          # Vite dev server (web) on http://localhost:1420
npm run tauri dev    # Tauri dev window (desktop)
npm run build         # Type-check + production web build
npm run tauri build  # Desktop executable

npm run test          # Run Vitest unit tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI runner
npm run type-check    # TypeScript check

npm run lint           # ESLint check
npm run format         # Prettier format
```

## Status

**Phase 1 — Foundation & Canvas Infrastructure**: infinite grid canvas with
zoom/pan/snap-to-grid, draggable component symbols with rotation and pin
anchors, starter component library (contactor, push buttons, motor, circuit
breaker, lamp).
