/**
 * Small persisted bookkeeping — recent files list + last-manual-save
 * timestamp — that needs to survive an app restart (CORE, Phase A Week 2).
 * Separate from the `.zcade` project file itself: this is *editor* state,
 * not *circuit* content.
 *
 * Tauri: a small JSON file in the app-data directory (`BaseDirectory.AppData`,
 * same directory as the autosave file — see `src/io/autosave.ts`).
 * Browser fallback: `localStorage`, so the recent-files list still works
 * across page reloads in `npm run dev`, even though there's no real autosave
 * to recover there (see autosave.ts's own doc comment).
 */
import { isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

export interface PersistedAppState {
  recentFiles: string[]
  lastFilePath: string | null
  lastManualSaveMs: number | null
}

const APP_STATE_FILENAME = 'app-state.json'
const LOCAL_STORAGE_KEY = 'zcade.appState.v1'

const DEFAULT_STATE: PersistedAppState = {
  recentFiles: [],
  lastFilePath: null,
  lastManualSaveMs: null,
}

function coerce(raw: unknown): PersistedAppState {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_STATE }
  const value = raw as Partial<PersistedAppState>
  return {
    recentFiles: Array.isArray(value.recentFiles)
      ? value.recentFiles.filter((p) => typeof p === 'string')
      : [],
    lastFilePath: typeof value.lastFilePath === 'string' ? value.lastFilePath : null,
    lastManualSaveMs: typeof value.lastManualSaveMs === 'number' ? value.lastManualSaveMs : null,
  }
}

export async function readAppState(): Promise<PersistedAppState> {
  if (isTauri()) {
    try {
      const has = await exists(APP_STATE_FILENAME, { baseDir: BaseDirectory.AppData })
      if (!has) return { ...DEFAULT_STATE }
      const text = await readTextFile(APP_STATE_FILENAME, { baseDir: BaseDirectory.AppData })
      return coerce(JSON.parse(text))
    } catch {
      // Corrupt/unreadable app-state file must never block the app from
      // starting — fall back to a clean slate, same "fail gracefully"
      // principle as `.zcade` load validation.
      return { ...DEFAULT_STATE }
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? coerce(JSON.parse(raw)) : { ...DEFAULT_STATE }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function writeAppState(state: PersistedAppState): Promise<void> {
  if (isTauri()) {
    try {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
    } catch {
      // Already exists — mkdir with recursive:true shouldn't throw for
      // that, but guard anyway rather than let a benign race fail the save.
    }
    await writeTextFile(APP_STATE_FILENAME, JSON.stringify(state, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
    return
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded / private-browsing storage lockout — recent files
    // list just won't persist across reloads; not fatal.
  }
}
