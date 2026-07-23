import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock every I/O boundary the project store delegates to, so this test
// exercises only the store's own orchestration logic (recent-files
// bookkeeping, save/open success & error handling, recovery flow) without
// touching real dialogs, the filesystem, or localStorage.
const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  openProjectDialog: vi.fn(),
  saveProjectDialogAs: vi.fn(),
  writeProjectFile: vi.fn(),
  startAutosave: vi.fn(),
  stopAutosave: vi.fn(),
  getAutosaveMtimeMs: vi.fn(async () => null as number | null),
  readAutosaveText: vi.fn(async () => null as string | null),
  clearAutosave: vi.fn(async () => {}),
  readAppState: vi.fn(async () => ({
    recentFiles: [] as string[],
    lastFilePath: null as string | null,
    lastManualSaveMs: null as number | null,
  })),
  writeAppState: vi.fn(async () => {}),
}))

vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }))
vi.mock('@/io/fileSystem', () => ({
  openProjectDialog: mocks.openProjectDialog,
  saveProjectDialogAs: mocks.saveProjectDialogAs,
  writeProjectFile: mocks.writeProjectFile,
  isTauri: mocks.isTauri,
}))
vi.mock('@/io/autosave', () => ({
  startAutosave: mocks.startAutosave,
  stopAutosave: mocks.stopAutosave,
  getAutosaveMtimeMs: mocks.getAutosaveMtimeMs,
  readAutosaveText: mocks.readAutosaveText,
  clearAutosave: mocks.clearAutosave,
  AUTOSAVE_INTERVAL_MS: 30_000,
}))
vi.mock('@/io/appState', () => ({
  readAppState: mocks.readAppState,
  writeAppState: mocks.writeAppState,
}))

const { useProjectStore } = await import('@/store/project')
const { useCanvasStore } = await import('@/store/canvas')
const { resetEditorStores } = await import('../helpers/circuits')

function resetProjectStore() {
  useProjectStore.setState({
    currentFilePath: null,
    recentFiles: [],
    lastManualSaveMs: null,
    pendingRecovery: null,
    initialized: false,
  })
}

describe('project store', () => {
  beforeEach(() => {
    resetEditorStores()
    resetProjectStore()
    vi.clearAllMocks()
    mocks.isTauri.mockReturnValue(false)
    mocks.readAppState.mockResolvedValue({
      recentFiles: [],
      lastFilePath: null,
      lastManualSaveMs: null,
    })
  })

  it('init() loads persisted app state exactly once', async () => {
    mocks.readAppState.mockResolvedValue({
      recentFiles: ['a.zcade'],
      lastFilePath: 'a.zcade',
      lastManualSaveMs: 123,
    })
    await useProjectStore.getState().init()
    expect(useProjectStore.getState().recentFiles).toEqual(['a.zcade'])
    expect(useProjectStore.getState().currentFilePath).toBe('a.zcade')

    await useProjectStore.getState().init()
    expect(mocks.readAppState).toHaveBeenCalledTimes(1)
  })

  it('init() does not start autosave or flag recovery in the web fallback', async () => {
    mocks.isTauri.mockReturnValue(false)
    await useProjectStore.getState().init()
    expect(mocks.startAutosave).not.toHaveBeenCalled()
    expect(useProjectStore.getState().pendingRecovery).toBeNull()
  })

  it('init() flags a pending recovery when an autosave is newer than the last manual save (Tauri)', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.readAppState.mockResolvedValue({
      recentFiles: [],
      lastFilePath: null,
      lastManualSaveMs: 1000,
    })
    mocks.getAutosaveMtimeMs.mockResolvedValue(2000)

    await useProjectStore.getState().init()

    expect(useProjectStore.getState().pendingRecovery).toEqual({ mtimeMs: 2000 })
    expect(mocks.startAutosave).toHaveBeenCalledTimes(1)
  })

  it('init() does not flag recovery when the autosave is older than the last manual save', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.readAppState.mockResolvedValue({
      recentFiles: [],
      lastFilePath: null,
      lastManualSaveMs: 5000,
    })
    mocks.getAutosaveMtimeMs.mockResolvedValue(1000)

    await useProjectStore.getState().init()

    expect(useProjectStore.getState().pendingRecovery).toBeNull()
  })

  it('newProject() clears the canvas and forgets the current file path', () => {
    useCanvasStore.getState().addComponent('lamp', 0, 0)
    useProjectStore.setState({ currentFilePath: 'was-open.zcade' })

    useProjectStore.getState().newProject()

    expect(useCanvasStore.getState().components).toEqual({})
    expect(useProjectStore.getState().currentFilePath).toBeNull()
  })

  it('openProject() loads a valid file and records it as the current + most-recent file', async () => {
    const json = JSON.stringify({
      version: '1.0.0',
      meta: {
        title: 't',
        author: '',
        date: '2026-01-01',
        sheetSize: 'A4',
        orientation: 'landscape',
        gridSize: 10,
      },
      components: [],
      wires: [],
      plcPrograms: {},
    })
    mocks.openProjectDialog.mockResolvedValue({ path: '/tmp/foo.zcade', text: json })

    const result = await useProjectStore.getState().openProject()

    expect(result.ok).toBe(true)
    expect(useProjectStore.getState().currentFilePath).toBe('/tmp/foo.zcade')
    expect(useProjectStore.getState().recentFiles).toEqual(['/tmp/foo.zcade'])
    expect(mocks.writeAppState).toHaveBeenCalled()
  })

  it('openProject() returns ok:false without an error when the user cancels', async () => {
    mocks.openProjectDialog.mockResolvedValue(null)
    const result = await useProjectStore.getState().openProject()
    expect(result).toEqual({ ok: false })
    expect(useProjectStore.getState().currentFilePath).toBeNull()
  })

  it('openProject() surfaces a validation error for a malformed file and does not change state', async () => {
    mocks.openProjectDialog.mockResolvedValue({ path: '/tmp/bad.zcade', text: '{ not valid json' })
    const result = await useProjectStore.getState().openProject()
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(useProjectStore.getState().currentFilePath).toBeNull()
  })

  it('saveProject() with no current path delegates to Save As', async () => {
    mocks.saveProjectDialogAs.mockResolvedValue('/tmp/new.zcade')
    const result = await useProjectStore.getState().saveProject()
    expect(result.ok).toBe(true)
    expect(mocks.saveProjectDialogAs).toHaveBeenCalledTimes(1)
    expect(useProjectStore.getState().currentFilePath).toBe('/tmp/new.zcade')
    expect(useProjectStore.getState().lastManualSaveMs).not.toBeNull()
  })

  it('saveProject() with a known path overwrites it directly without prompting', async () => {
    useProjectStore.setState({ currentFilePath: '/tmp/existing.zcade' })
    mocks.writeProjectFile.mockResolvedValue(undefined)

    const result = await useProjectStore.getState().saveProject()

    expect(result.ok).toBe(true)
    expect(mocks.writeProjectFile).toHaveBeenCalledWith('/tmp/existing.zcade', expect.any(String))
    expect(mocks.saveProjectDialogAs).not.toHaveBeenCalled()
  })

  it('saveProject() falls back to Save As when the direct write is rejected (stale fs scope)', async () => {
    useProjectStore.setState({ currentFilePath: '/tmp/stale.zcade' })
    mocks.writeProjectFile.mockRejectedValue(new Error('permission denied'))
    mocks.saveProjectDialogAs.mockResolvedValue('/tmp/reprompted.zcade')

    const result = await useProjectStore.getState().saveProject()

    expect(result.ok).toBe(true)
    expect(mocks.saveProjectDialogAs).toHaveBeenCalledTimes(1)
    expect(useProjectStore.getState().currentFilePath).toBe('/tmp/reprompted.zcade')
  })

  it('saveProjectAs() cancel leaves state untouched', async () => {
    mocks.saveProjectDialogAs.mockResolvedValue(null)
    const result = await useProjectStore.getState().saveProjectAs()
    expect(result).toEqual({ ok: false })
    expect(useProjectStore.getState().currentFilePath).toBeNull()
  })

  it('recentFiles caps at MAX_RECENT_FILES and de-duplicates, most-recent first', async () => {
    for (let i = 0; i < 12; i++) {
      mocks.saveProjectDialogAs.mockResolvedValueOnce(`/tmp/file-${i}.zcade`)
      await useProjectStore.getState().saveProjectAs()
    }
    // Re-save an earlier path — it should move to the front, not duplicate.
    mocks.saveProjectDialogAs.mockResolvedValueOnce('/tmp/file-5.zcade')
    await useProjectStore.getState().saveProjectAs()

    const recent = useProjectStore.getState().recentFiles
    expect(recent.length).toBeLessThanOrEqual(10)
    expect(recent[0]).toBe('/tmp/file-5.zcade')
    expect(new Set(recent).size).toBe(recent.length)
  })

  it('recoverAutosave() loads the autosave content and clears the recovery flag', async () => {
    const json = JSON.stringify({
      version: '1.0.0',
      meta: {
        title: 't',
        author: '',
        date: '2026-01-01',
        sheetSize: 'A4',
        orientation: 'landscape',
        gridSize: 10,
      },
      components: [
        { id: 'c1', type: 'lamp', label: 'H1', x: 0, y: 0, rotation: 0, properties: {} },
      ],
      wires: [],
      plcPrograms: {},
    })
    mocks.readAutosaveText.mockResolvedValue(json)
    useProjectStore.setState({ pendingRecovery: { mtimeMs: 999 } })

    const result = await useProjectStore.getState().recoverAutosave()

    expect(result.ok).toBe(true)
    expect(useProjectStore.getState().pendingRecovery).toBeNull()
    expect(useProjectStore.getState().currentFilePath).toBeNull()
    expect(useCanvasStore.getState().components['c1']).toBeDefined()
  })

  it('dismissRecovery() clears the autosave file and the recovery flag without touching the canvas', async () => {
    useCanvasStore.getState().addComponent('lamp', 0, 0)
    const before = useCanvasStore.getState().components
    useProjectStore.setState({ pendingRecovery: { mtimeMs: 999 } })

    await useProjectStore.getState().dismissRecovery()

    expect(mocks.clearAutosave).toHaveBeenCalledTimes(1)
    expect(useProjectStore.getState().pendingRecovery).toBeNull()
    expect(useCanvasStore.getState().components).toEqual(before)
  })
})
