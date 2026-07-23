/**
 * Native (Tauri) file open/save + a browser fallback so `npm run dev` in
 * Chrome keeps working without a Tauri runtime (CORE, Phase A Week 2).
 *
 * `isTauri()` (re-exported from `@tauri-apps/api/core`) is the officially
 * supported runtime-detection check — it reads a global Tauri stamps onto
 * `window`/`globalThis` at startup, not a hand-rolled `'__TAURI__' in
 * window` sniff. Every exported function here branches on it so the same
 * call site works in both `npm run tauri dev` and plain `npm run dev`.
 */
import { isTauri } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

export { isTauri }

const ZCADE_DIALOG_FILTERS = [{ name: 'zCADe Project', extensions: ['zcade', 'json'] }]
const DEFAULT_FILE_NAME = 'project.zcade'

export interface OpenedFile {
  /** Absolute path (Tauri) or just the chosen file's name (browser — no real path is exposed to web content). */
  path: string
  text: string
}

/**
 * Prompts the user to pick a `.zcade` file and reads it. Returns `null` if
 * the user cancels. Read failures (permissions, file vanished between pick
 * and read, ...) propagate as a rejected promise — callers should catch and
 * surface them, same as any other I/O.
 */
export async function openProjectDialog(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const path = await openDialog({ multiple: false, filters: ZCADE_DIALOG_FILTERS })
    if (!path || Array.isArray(path)) return null
    const text = await readTextFile(path)
    return { path, text }
  }
  return openProjectDialogWeb()
}

function openProjectDialogWeb(): Promise<OpenedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zcade,.json,application/json'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve({ path: file.name, text: String(reader.result ?? '') })
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.readAsText(file)
    })
    // Some browsers only fire `change` for a real user gesture; cancel isn't
    // observable at all in most browsers, so a dialog the user dismisses
    // without choosing a file just never resolves/rejects here — acceptable
    // for a fire-and-forget "Open" action (no hung promise leaks anything,
    // it just never settles, same as the underlying native `<input>`).
    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Prompts for a destination and writes `contents` there. Returns the chosen
 * path on success (Tauri: an absolute path the caller can remember for a
 * later plain "Save"; browser: just `suggestedName`, since there is no real
 * path to remember), or `null` if the user cancels.
 */
export async function saveProjectDialogAs(
  contents: string,
  suggestedName = DEFAULT_FILE_NAME,
): Promise<string | null> {
  if (isTauri()) {
    const path = await saveDialog({ filters: ZCADE_DIALOG_FILTERS, defaultPath: suggestedName })
    if (!path) return null
    await writeTextFile(path, contents)
    return path
  }
  return saveProjectDialogWeb(contents, suggestedName)
}

function saveProjectDialogWeb(contents: string, suggestedName: string): string {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = suggestedName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
  return suggestedName
}

/**
 * Reads a project file directly by its known path, with no dialog — used to
 * re-open an entry from the recent-files list. Tauri only: without a fresh
 * dialog pick, there is no guaranteed fs scope for an arbitrary path from a
 * prior session (see `writeProjectFile`'s doc comment for the same
 * constraint on the write side), so this can legitimately reject with a
 * permission error; callers should catch that and prompt the user to use
 * "Open..." instead. Always rejects in the browser fallback — there is no
 * such thing as a re-readable path there.
 */
export async function readProjectFile(path: string): Promise<string> {
  if (!isTauri()) {
    throw new Error(
      'Reopening a file by path is only available in the desktop app — use "Open..." instead.',
    )
  }
  return readTextFile(path)
}

/**
 * Overwrites an already-known path directly (no dialog re-prompt) — the
 * plain "Save" gesture once a file has been opened/saved once this session.
 * Tauri only grants filesystem scope for a path the *dialog itself* just
 * returned (see the plugin-dialog docs: "the selected path is added to the
 * filesystem ... scope"); a path restored from a previous session (recent
 * files list) or app-state on a fresh launch has no such grant yet, so this
 * can legitimately fail with a permission error even though the path is
 * "known" — callers must catch that and fall back to
 * `saveProjectDialogAs()` (re-prompting re-establishes the scope). This is
 * a real, not theoretical, constraint of Tauri's per-path fs scoping model,
 * not an oversight — flagged in the CLAUDE.md write-up for this session as
 * unverified end-to-end (no native Tauri window was exercised in this
 * sandbox).
 */
export async function writeProjectFile(path: string, contents: string): Promise<void> {
  if (isTauri()) {
    await writeTextFile(path, contents)
    return
  }
  // Browser: there is no direct-overwrite concept (no persistent handle to
  // the previously-downloaded file), so "Save" degrades to "Save As" with
  // the same suggested name.
  saveProjectDialogWeb(contents, path)
}
