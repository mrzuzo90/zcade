/**
 * `.zcade` save/load (CORE, Phase A Week 2, roadmap Section 2 W2 D6-8).
 *
 * Pure serialize/validate/apply logic lives here, decoupled from *how* the
 * JSON text reaches disk (native Tauri dialog+fs vs. browser
 * input/Blob-download — see `src/io/fileSystem.ts`) and from autosave
 * scheduling (`src/io/autosave.ts`). This module is what the persistence
 * round-trip test (`tests/integration/persistence-roundtrip.test.ts`)
 * exercises directly, without touching either.
 */
import { GRID_SIZE, useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useHistoryStore } from '@/store/history'
import { useSimulationStore } from '@/store/simulation'
import {
  defaultZcadeMeta,
  validateZcadeFile,
  ZCADE_VERSION,
  type ValidationResult,
  type ZcadeFile,
  type ZcadeMeta,
} from '@/io/schema'

export { ZCADE_VERSION, validateZcadeFile, emptyZcadeFile, defaultZcadeMeta } from '@/io/schema'
export type { ValidationResult, ZcadeFile, ZcadeMeta } from '@/io/schema'

/** Snapshots the current canvas + wire store state into a `.zcade` file object (in-memory — no JSON text yet). */
export function serializeProject(metaOverrides: Partial<ZcadeMeta> = {}): ZcadeFile {
  const canvas = useCanvasStore.getState()
  const wireStore = useWireStore.getState()

  const components = canvas.order.map((id) => canvas.components[id]).filter((c) => c !== undefined)
  const wires = wireStore.order.map((id) => wireStore.wires[id]).filter((w) => w !== undefined)

  return {
    version: ZCADE_VERSION,
    meta: defaultZcadeMeta({ gridSize: GRID_SIZE, ...metaOverrides }),
    components,
    wires,
    plcPrograms: {},
  }
}

/** `serializeProject()` rendered as pretty-printed JSON text, ready to hand to a file-write call. */
export function serializeProjectToJSON(metaOverrides: Partial<ZcadeMeta> = {}): string {
  return JSON.stringify(serializeProject(metaOverrides), null, 2)
}

/** Parses + validates raw JSON text as a `.zcade` file. Never throws — see `validateZcadeFile`. */
export function parseZcadeJSON(text: string): ValidationResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return { ok: false, error: `File is not valid JSON (${(error as Error).message})` }
  }
  return validateZcadeFile(data)
}

/**
 * Applies an already-validated `.zcade` file to the live editor: replaces
 * canvas/wire store content wholesale (via `loadComponents`/`loadWires`,
 * bypassing command history — see their doc comments), drops all undo
 * history (a loaded file is a fresh baseline, not something to undo back
 * out of), and stops any running simulation first (mirrors
 * `useSimulationStore.stop()`'s existing "cabinet losing supply" semantics —
 * loading a different circuit out from under a live simulation makes no
 * sense).
 *
 * Deliberately does NOT touch view state (`scale`/`position`/`showGrid`/
 * `snapEnabled`) — those aren't part of the `.zcade` schema and resetting
 * the user's current pan/zoom on every load would be surprising.
 */
export function loadProject(file: ZcadeFile): void {
  useSimulationStore.getState().stop()
  useCanvasStore.getState().loadComponents(file.components)
  useWireStore.getState().loadWires(file.wires)
  useHistoryStore.getState().clear()
}
