import { describe, expect, it } from 'vitest'
import type { ComponentInstance } from '@/types/circuit'
import { routeAStarPath } from '@/engine/routing/router'

/**
 * Perf smoke test (Week 1 scope): a single route across a moderately
 * obstacle-dense grid should stay well within a "no user-visible lag"
 * budget. The full Section 10.3 budget (500 components / 1000 wires full
 * re-route < 16ms) is explicitly Week 2 scope (incremental re-route +
 * dedicated perf harness handed to QA) — this test exists so the current
 * single-route cost is measured and reported now, not left unknown.
 */
describe('routeAStarPath — perf smoke test', () => {
  it('routes across a scattered field of ~30 components in well under a visible-lag budget', () => {
    const components: Record<string, ComponentInstance> = {}
    const types = ['contactor_3p', 'lamp', 'circuit_breaker_3p', 'motor_3p', 'push_button_no'] as const
    let n = 0
    // Scatter ~30 components in a loose grid across a 1200x800 canvas, leaving
    // gaps so a path always exists but the router has real obstacle-avoidance
    // work to do (not a trivially empty grid).
    for (let col = 0; col < 6; col++) {
      for (let row = 0; row < 5; row++) {
        const id = `c${n}`
        components[id] = {
          id,
          type: types[n % types.length],
          label: '',
          x: col * 200 + 20,
          y: row * 150 + 20,
          rotation: 0,
          properties: {},
        }
        n++
      }
    }

    // A handful of already-routed wires (straight segments) for the router's
    // soft crossing-penalty / bus-alignment cost hook to evaluate against.
    const existingWirePaths = [
      [{ x: 0, y: 75 }, { x: 1180, y: 75 }],
      [{ x: 110, y: 0 }, { x: 110, y: 770 }],
      [{ x: 620, y: 300 }, { x: 620, y: 470 }],
    ]

    const from = { x: 0, y: 0 }
    const to = { x: 1180, y: 770 }

    const start = performance.now()
    const result = routeAStarPath(from, to, components, [], existingWirePaths, { marginCells: 20 })
    const elapsedMs = performance.now() - start

    console.log(`[routing perf] single route over ${n} components, ${result?.expanded ?? 'n/a'} nodes expanded: ${elapsedMs.toFixed(2)}ms`)

    expect(result).not.toBeNull()
    expect(elapsedMs).toBeLessThan(250)
  })
})
