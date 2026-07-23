import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/store/canvas'
import { useWireStore } from '@/store/wires'
import { useSimulationStore } from '@/store/simulation'
import { useHistoryStore } from '@/store/history'
import {
  loadProject,
  parseZcadeJSON,
  serializeProject,
  serializeProjectToJSON,
} from '@/io/persistence'
import { buildDOL, resetEditorStores } from '../helpers/circuits'

/**
 * Save -> reload round-trip — Gate G-A criterion #4 ("Save → reload →
 * identical canvas + identical simulation behavior"). Implements the
 * assertion plan this test used to carry as a doc comment (see git history)
 * now that `.zcade` persistence exists (`src/io/persistence.ts`,
 * `src/io/schema.ts`).
 *
 * Ids are preserved verbatim across save/load (see `loadComponents`/
 * `loadWires` in canvas.ts/wires.ts) — no id-remapping to account for, so
 * this compares the reloaded state directly rather than structurally.
 */
describe('.zcade save/load round-trip', () => {
  beforeEach(() => {
    resetEditorStores()
    useSimulationStore.getState().stop()
    useHistoryStore.getState().clear()
  })

  afterEach(() => {
    useSimulationStore.getState().stop()
  })

  it('reloads a saved DOL circuit to an identical canvas and identical simulation behavior', () => {
    const circuit = buildDOL()

    const preSaveComponents = useCanvasStore.getState().components
    const preSaveWires = useWireStore.getState().wires

    // Round-trip through JSON.stringify/parse (the actual save/load path),
    // not just the in-memory ZcadeFile object, to catch anything that
    // doesn't survive text serialization.
    const json = serializeProjectToJSON({ title: 'DOL test circuit' })
    const parsed = parseZcadeJSON(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    // Fully reset both stores to simulate a fresh app launch.
    resetEditorStores()
    useHistoryStore.getState().clear()
    expect(useCanvasStore.getState().components).toEqual({})
    expect(useWireStore.getState().wires).toEqual({})

    loadProject(parsed.file)

    const postLoadComponents = useCanvasStore.getState().components
    const postLoadWires = useWireStore.getState().wires

    expect(postLoadComponents).toEqual(preSaveComponents)
    expect(postLoadWires).toEqual(preSaveWires)

    // Loading a file must not leave stray undo history behind.
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)

    // Run the same setPressed sequence against the (now reloaded) circuit
    // and record its componentStates trajectory tick-by-tick — "identical
    // simulation behavior", not just identical static data. `loadProject`
    // wholesale-replaces the store's components (see `loadComponents`), so
    // the "expected" trajectory has to come from re-running the *same*
    // ids/circuit before the reset rather than a second, separately-built
    // circuit coexisting in the same singleton store.
    const sequence: Array<{ start?: boolean; stop?: boolean }> = [
      {},
      { start: true },
      { start: true },
      { start: false },
      {},
      { stop: true },
      { stop: false },
      {},
    ]

    function runSequence(
      target: typeof circuit,
    ): Array<{ coilEnergized: boolean | undefined; lit: boolean | undefined }> {
      useSimulationStore.getState().stop()
      const trace: Array<{ coilEnergized: boolean | undefined; lit: boolean | undefined }> = []
      for (const step of sequence) {
        if (step.start !== undefined)
          useSimulationStore.getState().setPressed(target.startId, step.start)
        if (step.stop !== undefined)
          useSimulationStore.getState().setPressed(target.stopId, step.stop)
        useSimulationStore.getState().tick()
        const states = useSimulationStore.getState().componentStates
        trace.push({
          coilEnergized: states[target.kmId]?.coilEnergized,
          lit: states[target.lampId]?.lit,
        })
      }
      return trace
    }

    // Expected trajectory: rebuild the same DOL circuit fresh (pre-save
    // shape) and drive it.
    resetEditorStores()
    useHistoryStore.getState().clear()
    const expectedCircuit = buildDOL()
    const expectedTrace = runSequence(expectedCircuit)

    // Actual trajectory: reload the saved file and drive the reloaded
    // circuit (same ids as the original `circuit`, preserved verbatim).
    resetEditorStores()
    useHistoryStore.getState().clear()
    loadProject(parsed.file)
    const actualTrace = runSequence(circuit)

    expect(actualTrace).toEqual(expectedTrace)

    // Sanity: the latch actually happened at some point in that sequence
    // (otherwise the equality check above would trivially pass on two
    // circuits that both never energize).
    expect(actualTrace.some((step) => step.coilEnergized === true)).toBe(true)
  })

  it('preserves an optional wire.points override across the round-trip (ROUTE waypoint field)', () => {
    const canvas = useCanvasStore.getState()
    const srcId = canvas.addComponent('power_source_dc', 0, 0)
    const lampId = canvas.addComponent('lamp', 100, 0)

    useWireStore.getState().startWire({ componentId: srcId, pinId: '+24V' })
    const wireId = useWireStore.getState().completeWire({ componentId: lampId, pinId: '1' })
    expect(wireId).not.toBeNull()

    // Simulate a manual waypoint edit (ROUTE's feature) by patching `points`
    // directly, same as that feature will eventually do via the store.
    useWireStore.setState((state) => ({
      wires: {
        ...state.wires,
        [wireId!]: {
          ...state.wires[wireId!],
          points: [
            { x: 20, y: 20 },
            { x: 80, y: 40 },
          ],
        },
      },
    }))

    const json = serializeProjectToJSON()
    const parsed = parseZcadeJSON(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    resetEditorStores()
    loadProject(parsed.file)

    const reloadedWire = useWireStore.getState().wires[wireId!]
    expect(reloadedWire.points).toEqual([
      { x: 20, y: 20 },
      { x: 80, y: 40 },
    ])
  })

  it('rejects a malformed/foreign JSON file without crashing or mutating store state', () => {
    buildDOL()
    const before = useCanvasStore.getState().components

    const notJson = parseZcadeJSON('{not valid json')
    expect(notJson.ok).toBe(false)

    const wrongShape = parseZcadeJSON(JSON.stringify({ hello: 'world' }))
    expect(wrongShape.ok).toBe(false)

    const wrongVersion = parseZcadeJSON(JSON.stringify({ ...serializeProject(), version: '9.0.0' }))
    expect(wrongVersion.ok).toBe(false)

    const unknownType = parseZcadeJSON(
      JSON.stringify({
        ...serializeProject(),
        components: [
          { id: 'x', type: 'not_a_real_type', label: 'X', x: 0, y: 0, rotation: 0, properties: {} },
        ],
      }),
    )
    expect(unknownType.ok).toBe(false)

    // None of the rejected parses should have touched the live store.
    expect(useCanvasStore.getState().components).toEqual(before)
  })
})
