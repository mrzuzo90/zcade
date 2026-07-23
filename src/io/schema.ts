/**
 * `.zcade` file schema (CORE, Phase A Week 2) — the versioned JSON shape
 * documented in CLAUDE.md's "File Format: `.zcade`" section, plus a
 * hand-rolled validator (no schema-validation library dependency — the
 * shape is small and stable enough that a plain function reads clearer than
 * a JSON-Schema/zod indirection, and keeps this worktree's dependency
 * footprint unchanged).
 *
 * Field-level shapes for `components`/`wires` intentionally reuse the real
 * `ComponentInstance`/`Wire` types from `src/types/circuit.ts` verbatim
 * (pin references as `{ componentId, pinId }` objects, not the doc's
 * illustrative `"comp_km1:1"` concatenated-string shorthand) — CLAUDE.md's
 * own design-decision bullet for the doc's example already establishes the
 * *principle* ("reference component pins by id, not direct coordinates");
 * the concatenated-string rendering in that doc is illustrative, and the
 * codebase's own `WireEndpoint` object shape already satisfies the
 * principle without a lossy string round-trip through `componentId:pinId`
 * parsing/formatting on every save/load.
 */
import type { ComponentInstance, Rotation, Wire, WireEndpoint, WireType } from '@/types/circuit'
import { COMPONENT_LIBRARY } from '@/components/symbols/library'

/** Only the major version is checked for compatibility (see `validateZcadeFile`) — minor/patch bumps within 1.x must stay load-compatible. */
export const ZCADE_VERSION = '1.0.0'
const ZCADE_SUPPORTED_MAJOR = 1

export interface ZcadeMeta {
  title: string
  author: string
  date: string
  sheetSize: string
  orientation: 'portrait' | 'landscape'
  gridSize: number
}

export interface ZcadeFile {
  version: string
  meta: ZcadeMeta
  components: ComponentInstance[]
  wires: Wire[]
  /** Embedded PLC programs, keyed by id — schema placeholder only; PLC runtime is Phase 4 scope. Always `{}` today. */
  plcPrograms: Record<string, unknown>
}

export type ValidationResult = { ok: true; file: ZcadeFile } | { ok: false; error: string }

const VALID_ROTATIONS: Rotation[] = [0, 90, 180, 270]
const VALID_WIRE_TYPES: WireType[] = ['L1', 'L2', 'L3', 'N', 'PE', 'DC_POS', 'DC_0', 'signal']
const VALID_ORIENTATIONS = ['portrait', 'landscape']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(error: string): ValidationResult {
  return { ok: false, error }
}

function validateMeta(value: unknown): string | null {
  if (!isPlainObject(value)) return 'meta must be an object'
  if (typeof value.title !== 'string') return 'meta.title must be a string'
  if (typeof value.author !== 'string') return 'meta.author must be a string'
  if (typeof value.date !== 'string') return 'meta.date must be a string'
  if (typeof value.sheetSize !== 'string') return 'meta.sheetSize must be a string'
  if (typeof value.orientation !== 'string' || !VALID_ORIENTATIONS.includes(value.orientation)) {
    return `meta.orientation must be one of ${VALID_ORIENTATIONS.join('/')}`
  }
  if (
    typeof value.gridSize !== 'number' ||
    !Number.isFinite(value.gridSize) ||
    value.gridSize <= 0
  ) {
    return 'meta.gridSize must be a positive number'
  }
  return null
}

function validateComponent(value: unknown, index: number): string | null {
  if (!isPlainObject(value)) return `components[${index}] must be an object`
  const { id, type, label, x, y, rotation, properties } = value
  if (typeof id !== 'string' || id.length === 0)
    return `components[${index}].id must be a non-empty string`
  if (typeof type !== 'string' || type.length === 0)
    return `components[${index}].type must be a non-empty string`
  if (!COMPONENT_LIBRARY[type])
    return `components[${index}] ("${id}") has unknown component type "${type}"`
  if (typeof label !== 'string') return `components[${index}] ("${id}").label must be a string`
  if (typeof x !== 'number' || !Number.isFinite(x))
    return `components[${index}] ("${id}").x must be a number`
  if (typeof y !== 'number' || !Number.isFinite(y))
    return `components[${index}] ("${id}").y must be a number`
  if (typeof rotation !== 'number' || !VALID_ROTATIONS.includes(rotation as Rotation)) {
    return `components[${index}] ("${id}").rotation must be one of 0/90/180/270`
  }
  if (!isPlainObject(properties))
    return `components[${index}] ("${id}").properties must be an object`
  return null
}

function validateEndpoint(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`
  if (typeof value.componentId !== 'string' || value.componentId.length === 0)
    return `${path}.componentId must be a non-empty string`
  if (typeof value.pinId !== 'string' || value.pinId.length === 0)
    return `${path}.pinId must be a non-empty string`
  return null
}

function validateWire(value: unknown, index: number, componentIds: Set<string>): string | null {
  if (!isPlainObject(value)) return `wires[${index}] must be an object`
  const { id, from, to, points, wireType } = value
  if (typeof id !== 'string' || id.length === 0)
    return `wires[${index}].id must be a non-empty string`

  const fromError = validateEndpoint(from, `wires[${index}] ("${id}").from`)
  if (fromError) return fromError
  const toError = validateEndpoint(to, `wires[${index}] ("${id}").to`)
  if (toError) return toError

  const fromEndpoint = from as WireEndpoint
  const toEndpoint = to as WireEndpoint
  if (!componentIds.has(fromEndpoint.componentId)) {
    return `wires[${index}] ("${id}") references unknown component "${fromEndpoint.componentId}" in "from"`
  }
  if (!componentIds.has(toEndpoint.componentId)) {
    return `wires[${index}] ("${id}") references unknown component "${toEndpoint.componentId}" in "to"`
  }

  if (points !== undefined) {
    if (!Array.isArray(points))
      return `wires[${index}] ("${id}").points must be an array when present`
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      if (!isPlainObject(p) || typeof p.x !== 'number' || typeof p.y !== 'number') {
        return `wires[${index}] ("${id}").points[${i}] must be a {x, y} number pair`
      }
    }
  }

  if (wireType !== undefined && !VALID_WIRE_TYPES.includes(wireType as WireType)) {
    return `wires[${index}] ("${id}").wireType must be one of ${VALID_WIRE_TYPES.join('/')} when present`
  }

  return null
}

/**
 * Validates an arbitrary parsed JSON value as a `.zcade` file. Never throws —
 * a malformed or foreign JSON document (wrong shape, wrong version, unknown
 * component types, dangling wire references, ...) always comes back as
 * `{ ok: false, error }` with a human-readable message, so a caller (file
 * load UI) can surface it instead of crashing or silently loading a broken
 * circuit.
 */
export function validateZcadeFile(data: unknown): ValidationResult {
  if (!isPlainObject(data)) return fail('File is not a JSON object')

  if (typeof data.version !== 'string') return fail('Missing or invalid "version" field')
  const major = Number.parseInt(data.version.split('.')[0] ?? '', 10)
  if (!Number.isFinite(major) || major !== ZCADE_SUPPORTED_MAJOR) {
    return fail(
      `Unsupported .zcade version "${data.version}" (this build supports ${ZCADE_SUPPORTED_MAJOR}.x)`,
    )
  }

  const metaError = validateMeta(data.meta)
  if (metaError) return fail(metaError)

  if (!Array.isArray(data.components)) return fail('"components" must be an array')
  for (let i = 0; i < data.components.length; i++) {
    const error = validateComponent(data.components[i], i)
    if (error) return fail(error)
  }
  const componentIds = new Set((data.components as ComponentInstance[]).map((c) => c.id))
  const seen = new Set<string>()
  for (const c of data.components as ComponentInstance[]) {
    if (seen.has(c.id)) return fail(`Duplicate component id "${c.id}"`)
    seen.add(c.id)
  }

  if (!Array.isArray(data.wires)) return fail('"wires" must be an array')
  const seenWireIds = new Set<string>()
  for (let i = 0; i < data.wires.length; i++) {
    const error = validateWire(data.wires[i], i, componentIds)
    if (error) return fail(error)
    const wireId = (data.wires[i] as Wire).id
    if (seenWireIds.has(wireId)) return fail(`Duplicate wire id "${wireId}"`)
    seenWireIds.add(wireId)
  }

  if (data.plcPrograms !== undefined && !isPlainObject(data.plcPrograms)) {
    return fail('"plcPrograms" must be an object when present')
  }

  return {
    ok: true,
    file: {
      version: data.version,
      meta: data.meta as ZcadeMeta,
      components: data.components as ComponentInstance[],
      wires: data.wires as Wire[],
      plcPrograms: (data.plcPrograms as Record<string, unknown> | undefined) ?? {},
    },
  }
}

export function defaultZcadeMeta(overrides: Partial<ZcadeMeta> = {}): ZcadeMeta {
  return {
    title: overrides.title ?? 'Untitled Project',
    author: overrides.author ?? '',
    date: overrides.date ?? new Date().toISOString().slice(0, 10),
    sheetSize: overrides.sheetSize ?? 'A4',
    orientation: overrides.orientation ?? 'landscape',
    gridSize: overrides.gridSize ?? 10,
  }
}

export function emptyZcadeFile(metaOverrides: Partial<ZcadeMeta> = {}): ZcadeFile {
  return {
    version: ZCADE_VERSION,
    meta: defaultZcadeMeta(metaOverrides),
    components: [],
    wires: [],
    plcPrograms: {},
  }
}
