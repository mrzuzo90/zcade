import type { ComponentInstance, Crossing, Junction, Point, Wire } from '@/types/circuit'
import { findCrossings, findJunctions, getWirePath } from '@/engine/wiring'

interface PathEntry {
  path: Point[] | null
  fromRef: ComponentInstance | undefined
  toRef: ComponentInstance | undefined
  pointsRef: Point[] | undefined
}

function junctionKey(point: Point): string {
  return `${Math.round(point.x)}:${Math.round(point.y)}`
}

function mergeJunctions(retained: Junction[], fresh: Junction[]): Junction[] {
  const map = new Map<string, Junction>()
  for (const j of [...retained, ...fresh]) {
    const key = junctionKey(j.point)
    const existing = map.get(key)
    if (existing) {
      for (const id of j.wireIds) if (!existing.wireIds.includes(id)) existing.wireIds.push(id)
    } else {
      map.set(key, { point: j.point, wireIds: [...j.wireIds] })
    }
  }
  return [...map.values()]
}

/**
 * Incremental geometry cache for the wire rendering pipeline (WireLayer):
 * per-wire path resolution, T-junction dots, and crossing "hops".
 *
 * Why this exists (Phase A W2 ROUTE perf budget, CLAUDE.md Section 10.3: a
 * full 500-component/1000-wire re-route must stay under 16ms, AND dragging a
 * single component must not redo O(wires²) work every mousemove frame):
 *
 * - `canvas.ts`'s `moveComponent` / `wires.ts`'s `setWirePoints` only ever
 *   replace the ONE ComponentInstance/Wire object that actually changed —
 *   every other component/wire keeps its exact prior object reference (see
 *   the `{ ...state.components, [id]: {...existing, x, y} }` pattern used
 *   throughout both stores). That makes "did this wire's rendered path
 *   possibly change?" an O(1) reference-identity check per wire, so
 *   `getPaths` only recomputes `getWirePath` for wires actually touching the
 *   moved component instead of resolving all of them from scratch.
 * - `findJunctions`/`findCrossings`'s pairwise checks are the O(wires²) part.
 *   Their `onlyInvolving` parameter restricts a call to pairs where at least
 *   one wire id is in a given set; here that set is exactly the wires whose
 *   path just changed. Anything NOT touching a changed wire is provably
 *   unaffected (neither side of that relationship moved) and is carried over
 *   from the previous result untouched — see `update()`.
 *
 * A single instance is meant to be held across renders (e.g. in a `useRef`)
 * and fed the current `wires`/`components` on every call to `update()`; a
 * fresh instance (or `.clear()`) has no memory and behaves as a full
 * recompute, identical to calling the plain functions directly.
 */
export class WireGeometryCache {
  private pathEntries = new Map<string, PathEntry>()
  private lastJunctions: Junction[] = []
  private lastCrossings: Crossing[] = []

  private updatePaths(
    wires: Wire[],
    components: Record<string, ComponentInstance>,
  ): { paths: Record<string, Point[] | null>; changed: Set<string> } {
    const paths: Record<string, Point[] | null> = {}
    const changed = new Set<string>()
    const seen = new Set<string>()

    for (const wire of wires) {
      seen.add(wire.id)
      const fromRef = components[wire.from.componentId]
      const toRef = components[wire.to.componentId]
      const cached = this.pathEntries.get(wire.id)
      if (cached && cached.fromRef === fromRef && cached.toRef === toRef && cached.pointsRef === wire.points) {
        paths[wire.id] = cached.path
        continue
      }
      const path = getWirePath(wire, components)
      this.pathEntries.set(wire.id, { path, fromRef, toRef, pointsRef: wire.points })
      paths[wire.id] = path
      changed.add(wire.id)
    }

    for (const id of [...this.pathEntries.keys()]) {
      if (!seen.has(id)) {
        this.pathEntries.delete(id)
        changed.add(id)
      }
    }

    return { paths, changed }
  }

  /**
   * Resolves this tick's wire paths, junction dots, and crossing hops.
   * `changed` (also returned) is the set of wire ids whose path differs from
   * the previous call — empty on a render where nothing moved, in which case
   * junctions/crossings are reused verbatim with no recompute at all.
   */
  update(
    wires: Wire[],
    components: Record<string, ComponentInstance>,
  ): { paths: Record<string, Point[] | null>; junctions: Junction[]; crossings: Crossing[]; changed: Set<string> } {
    const { paths, changed } = this.updatePaths(wires, components)

    if (changed.size > 0) {
      const freshJunctions = findJunctions(wires, components, changed)
      const retainedJunctions = this.lastJunctions.filter((j) => !j.wireIds.some((id) => changed.has(id)))
      this.lastJunctions = mergeJunctions(retainedJunctions, freshJunctions)

      const freshCrossings = findCrossings(wires, components, changed)
      const retainedCrossings = this.lastCrossings.filter((c) => !c.wireIds.some((id) => changed.has(id)))
      this.lastCrossings = [...retainedCrossings, ...freshCrossings]
    }

    return { paths, junctions: this.lastJunctions, crossings: this.lastCrossings, changed }
  }

  /** Drops all memoized state (e.g. on `.zcade` file load / new project). */
  clear() {
    this.pathEntries.clear()
    this.lastJunctions = []
    this.lastCrossings = []
  }
}
