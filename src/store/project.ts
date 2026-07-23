/**
 * Project/file orchestration store (CORE, Phase A Week 2) — the thin layer
 * a "File" menu UI hangs off of. Delegates the actual work to the `src/io/*`
 * modules (`persistence.ts` for serialize/validate/apply, `fileSystem.ts`
 * for native-dialog-vs-browser I/O, `autosave.ts` for the 30s timer,
 * `appState.ts` for the recent-files/last-save bookkeeping that survives a
 * restart) and just tracks the resulting UI-facing state: which file (if
 * any) is open, the recent-files list, and a pending-recovery prompt.
 */
import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import {
  openProjectDialog,
  readProjectFile,
  saveProjectDialogAs,
  writeProjectFile,
} from '@/io/fileSystem'
import {
  loadProject,
  parseZcadeJSON,
  serializeProjectToJSON,
  emptyZcadeFile,
  type ZcadeMeta,
} from '@/io/persistence'
import { readAppState, writeAppState } from '@/io/appState'
import {
  clearAutosave,
  getAutosaveMtimeMs,
  readAutosaveText,
  startAutosave,
  stopAutosave,
} from '@/io/autosave'

export const MAX_RECENT_FILES = 10

export interface OperationResult {
  ok: boolean
  error?: string
}

export interface PendingRecovery {
  /** Autosave file's last-modified time, epoch ms — shown to the user as "autosave from <time>". */
  mtimeMs: number
}

interface ProjectStore {
  /** Path of the currently open file, or `null` for an unsaved/new project. */
  currentFilePath: string | null
  recentFiles: string[]
  lastManualSaveMs: number | null
  pendingRecovery: PendingRecovery | null
  initialized: boolean

  /** Loads persisted app state, checks for a recoverable autosave, and starts the autosave timer. Call once on app startup. Safe to call more than once (no-ops after the first). */
  init: () => Promise<void>
  newProject: () => void
  openProject: () => Promise<OperationResult>
  /** Re-opens an entry from `recentFiles` directly by path (Tauri only — see `fileSystem.ts`'s `readProjectFile`). */
  openRecentFile: (path: string) => Promise<OperationResult>
  /** Plain "Save": overwrites `currentFilePath` if known, else behaves like `saveProjectAs`. */
  saveProject: (metaOverrides?: Partial<ZcadeMeta>) => Promise<OperationResult>
  saveProjectAs: (metaOverrides?: Partial<ZcadeMeta>) => Promise<OperationResult>
  /** Loads the pending autosave into the editor and clears the prompt. */
  recoverAutosave: () => Promise<OperationResult>
  /** Discards the pending autosave without loading it. */
  dismissRecovery: () => Promise<void>
}

function pushRecent(list: string[], path: string): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, MAX_RECENT_FILES)
}

async function persistAppState(get: () => ProjectStore): Promise<void> {
  const { recentFiles, currentFilePath, lastManualSaveMs } = get()
  await writeAppState({ recentFiles, lastFilePath: currentFilePath, lastManualSaveMs })
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentFilePath: null,
  recentFiles: [],
  lastManualSaveMs: null,
  pendingRecovery: null,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })

    const appState = await readAppState()
    set({
      recentFiles: appState.recentFiles,
      currentFilePath: appState.lastFilePath,
      lastManualSaveMs: appState.lastManualSaveMs,
    })

    if (isTauri()) {
      const autosaveMtime = await getAutosaveMtimeMs()
      const lastSave = appState.lastManualSaveMs
      if (autosaveMtime !== null && (lastSave === null || autosaveMtime > lastSave)) {
        set({ pendingRecovery: { mtimeMs: autosaveMtime } })
      }
      startAutosave()
    }
  },

  newProject: () => {
    loadProject(emptyZcadeFile())
    set({ currentFilePath: null })
  },

  openProject: async () => {
    let opened
    try {
      opened = await openProjectDialog()
    } catch (error) {
      return { ok: false, error: `Could not open file: ${(error as Error).message}` }
    }
    if (!opened) return { ok: false } // user cancelled — not an error

    const parsed = parseZcadeJSON(opened.text)
    if (!parsed.ok) return { ok: false, error: parsed.error }

    loadProject(parsed.file)
    const recentFiles = pushRecent(get().recentFiles, opened.path)
    set({ currentFilePath: opened.path, recentFiles })
    await persistAppState(get)
    return { ok: true }
  },

  openRecentFile: async (path) => {
    let text: string
    try {
      text = await readProjectFile(path)
    } catch (error) {
      return { ok: false, error: `Could not reopen "${path}": ${(error as Error).message}` }
    }
    const parsed = parseZcadeJSON(text)
    if (!parsed.ok) return { ok: false, error: parsed.error }

    loadProject(parsed.file)
    const recentFiles = pushRecent(get().recentFiles, path)
    set({ currentFilePath: path, recentFiles })
    await persistAppState(get)
    return { ok: true }
  },

  saveProject: async (metaOverrides) => {
    const { currentFilePath } = get()
    const json = serializeProjectToJSON(metaOverrides)

    if (currentFilePath) {
      try {
        await writeProjectFile(currentFilePath, json)
        const recentFiles = pushRecent(get().recentFiles, currentFilePath)
        set({ recentFiles, lastManualSaveMs: Date.now() })
        await persistAppState(get)
        return { ok: true }
      } catch {
        // Path known but no longer writable (e.g. fresh launch — Tauri's
        // per-path fs scope from a prior session doesn't persist, see
        // fileSystem.ts's doc comment on writeProjectFile). Fall through to
        // a fresh Save As, which re-establishes scope via the dialog.
      }
    }
    return get().saveProjectAs(metaOverrides)
  },

  saveProjectAs: async (metaOverrides) => {
    const json = serializeProjectToJSON(metaOverrides)
    let path: string | null
    try {
      path = await saveProjectDialogAs(json)
    } catch (error) {
      return { ok: false, error: `Could not save file: ${(error as Error).message}` }
    }
    if (!path) return { ok: false } // user cancelled

    const recentFiles = pushRecent(get().recentFiles, path)
    set({ currentFilePath: path, recentFiles, lastManualSaveMs: Date.now() })
    await persistAppState(get)
    return { ok: true }
  },

  recoverAutosave: async () => {
    const text = await readAutosaveText()
    if (text === null) {
      set({ pendingRecovery: null })
      return { ok: false, error: 'Autosave file is no longer available' }
    }
    const parsed = parseZcadeJSON(text)
    if (!parsed.ok) {
      set({ pendingRecovery: null })
      return { ok: false, error: parsed.error }
    }
    loadProject(parsed.file)
    // The recovered content hasn't been saved to any path yet — surface it
    // as an unsaved project rather than silently attributing it to whatever
    // file was last open.
    set({ currentFilePath: null, pendingRecovery: null })
    return { ok: true }
  },

  dismissRecovery: async () => {
    await clearAutosave()
    set({ pendingRecovery: null })
  },
}))

// Re-exported so a top-level app shutdown hook can stop the interval
// (e.g. in a future `beforeunload`/Tauri close-request handler) without
// importing `src/io/autosave.ts` directly.
export { stopAutosave }
