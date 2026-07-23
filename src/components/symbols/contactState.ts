import type { ContactSegment } from '@/types/circuit'
import type { ComponentRuntimeState } from '@/engine/solver'

/**
 * Mirrors `isSegmentClosed` in `engine/solver.ts` (SOLV-owned — not imported,
 * since it isn't exported and this file must not edit that module). This is
 * purely a rendering decision (which symbol layer variant to show), not a
 * simulation input: the solver already applied the real version of this
 * logic when it computed `runtimeState`, so a mismatch here can only ever
 * make the drawing look wrong, never change circuit behavior.
 *
 * Must cover every `ContactSegment.control` value the solver understands
 * ('pressed'/'coil'/'tripped'/'latched'/'timed') — a control kind missing
 * here silently falls through to the `coilEnergized` default below, which
 * for a component with no coil pins (thermal_overload_relay, emergency_stop,
 * and timer_ton's timed contacts all have none) is always `undefined`/false,
 * so the symbol would always render "open" regardless of actual state. Bug
 * found and fixed during this phase (Week 2 SYM): only 'pressed' was
 * special-cased, everything else fell back to 'coil' semantics. Kept in its
 * own module (rather than inline in ComponentSymbol.tsx, where it lived
 * originally) purely so it's importable by unit tests without pulling in
 * react-konva.
 */
export function isContactClosed(
  segment: ContactSegment,
  state: ComponentRuntimeState | undefined,
): boolean {
  if (segment.behavior === 'always_closed') return true
  let active: boolean
  switch (segment.control) {
    case 'pressed':
      active = state?.pressed ?? false
      break
    case 'tripped':
      active = state?.tripped ?? false
      break
    case 'latched':
      active = state?.latched ?? false
      break
    case 'timed':
      active = state?.timedActive ?? false
      break
    case 'coil':
    default:
      active = state?.coilEnergized ?? false
      break
  }
  return segment.behavior === 'no' ? active : !active
}
