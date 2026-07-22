import type { SymbolDefinition } from '@/components/symbols/schema'
import { parseSymbolSvg } from '@/components/symbols/svgParser'

/**
 * Eagerly loads every `.svg` under `/assets/symbols/` as raw text and parses
 * it once at module init (not per-render, not per-instance — the 8 Tier 1
 * symbols today, and every symbol LIB/PNEU add later, are static assets so
 * there is nothing to re-parse at runtime). `import.meta.glob` with an
 * absolute `/assets/...` pattern means dropping a new file in that directory
 * is immediately picked up with zero registry edits — the self-serve
 * authoring path the roadmap calls for (SYM's authoring guide, `schema.md`,
 * is the handoff artifact for that).
 */
const rawModules = import.meta.glob('/assets/symbols/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const registry = new Map<string, SymbolDefinition>()

for (const [path, raw] of Object.entries(rawModules)) {
  const id = path.replace(/^.*\//, '').replace(/\.svg$/, '')
  registry.set(id, parseSymbolSvg(id, raw))
}

/** Returns the parsed symbol asset for a component type, or `undefined` if none has been authored yet (callers fall back to a generic placeholder — see ComponentSymbol.tsx). */
export function getSymbolDefinition(type: string): SymbolDefinition | undefined {
  return registry.get(type)
}

/** For tests/tooling: every symbol type currently registered. */
export function listSymbolTypes(): string[] {
  return [...registry.keys()]
}
