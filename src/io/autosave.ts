/**
 * Autosave to the Tauri app-data directory, every 30s (CORE, Phase A Week 2,
 * roadmap Section 2 W2 D6-8 deliverable #3). No-ops gracefully everywhere a
 * Tauri runtime isn't present — `npm run dev` in Chrome has no durable
 * per-app storage to autosave into, so every function here is a deliberate
 * silent no-op (never a thrown error) under `isTauri() === false`, exactly
 * as CLAUDE.md's Offline-First section treats "no native shell" as a
 * supported, not degraded-with-errors, mode.
 */
import { isTauri } from '@tauri-apps/api/core'
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  stat,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { serializeProjectToJSON } from '@/io/persistence'

export const AUTOSAVE_INTERVAL_MS = 30_000
const AUTOSAVE_FILENAME = 'autosave.zcade.json'

let autosaveTimer: ReturnType<typeof setInterval> | null = null

/** Starts the 30s autosave interval. Idempotent (calling twice doesn't double the interval). No-op in the web fallback. */
export function startAutosave(): void {
  if (autosaveTimer !== null) return
  if (!isTauri()) return
  autosaveTimer = setInterval(() => {
    void writeAutosave()
  }, AUTOSAVE_INTERVAL_MS)
}

export function stopAutosave(): void {
  if (autosaveTimer !== null) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
}

async function ensureAppDataDir(): Promise<void> {
  try {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
  } catch {
    // Directory already existing is the overwhelmingly common case here.
  }
}

/** Writes an autosave snapshot right now, outside the timer (e.g. call once on app close). No-op in the web fallback. */
export async function writeAutosave(): Promise<void> {
  if (!isTauri()) return
  await ensureAppDataDir()
  const json = serializeProjectToJSON()
  await writeTextFile(AUTOSAVE_FILENAME, json, { baseDir: BaseDirectory.AppData })
}

/** Raw autosave JSON text, or `null` if none exists (or in the web fallback). */
export async function readAutosaveText(): Promise<string | null> {
  if (!isTauri()) return null
  const has = await exists(AUTOSAVE_FILENAME, { baseDir: BaseDirectory.AppData }).catch(() => false)
  if (!has) return null
  return readTextFile(AUTOSAVE_FILENAME, { baseDir: BaseDirectory.AppData })
}

/** The autosave file's last-modified time in epoch ms, or `null` if it doesn't exist / isn't available (or in the web fallback). */
export async function getAutosaveMtimeMs(): Promise<number | null> {
  if (!isTauri()) return null
  const has = await exists(AUTOSAVE_FILENAME, { baseDir: BaseDirectory.AppData }).catch(() => false)
  if (!has) return null
  const info = await stat(AUTOSAVE_FILENAME, { baseDir: BaseDirectory.AppData })
  return info.mtime ? info.mtime.getTime() : null
}

/** Deletes the autosave file (e.g. after the user accepts/declines a recovery prompt). No-op in the web fallback. */
export async function clearAutosave(): Promise<void> {
  if (!isTauri()) return
  try {
    await remove(AUTOSAVE_FILENAME, { baseDir: BaseDirectory.AppData })
  } catch {
    // Already gone — fine.
  }
}
