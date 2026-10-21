import { describe, it, expect } from 'vitest'
import { Autofocus } from '../src/camera/autofocus'

const base = { lensSpeed: 0.35, centerDistM: 12, eyeDistM: null as number | null, minFocusM: 1, maxFocusM: 200 }

function run(af: Autofocus, focus: number, input: Parameters<Autofocus['update']>[2], seconds: number): number {
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) focus = af.update(dt, focus, input)
  return focus
}

describe('Autofocus', () => {
  it('manual tier never moves focus', () => {
    const af = new Autofocus()
    expect(run(af, 5, { ...base, tier: 0, halfPressed: true }, 2)).toBe(5)
    expect(af.state).toBe('idle')
  })
  it('single-point locks on the distance sampled at press time', () => {
    const af = new Autofocus()
    let f = 5
    const input = { ...base, tier: 1 as const, halfPressed: true }
    f = run(af, f, input, 0.1)
    expect(af.state).toBe('seeking')
    f = run(af, f, { ...input, centerDistM: 30 }, 3)   // 目標改變但單點不重取
    expect(f).toBeCloseTo(12, 1)
    expect(af.state).toBe('locked')
  })
  it('continuous re-acquires the target every frame', () => {
    const af = new Autofocus()
    let f = run(af, 5, { ...base, tier: 2, halfPressed: true }, 3)
    expect(f).toBeCloseTo(12, 1)
    f = run(af, f, { ...base, tier: 2, halfPressed: true, centerDistM: 20 }, 3)
    expect(f).toBeCloseTo(20, 1)
    expect(af.tracking).toBe(true)
  })
  it('eye tier prefers the eye over the centre', () => {
    const af = new Autofocus()
    const f = run(af, 5, { ...base, tier: 3, halfPressed: true, centerDistM: 30, eyeDistM: 9 }, 3)
    expect(f).toBeCloseTo(9, 1)
  })
  it('a slow lens takes longer to lock', () => {
    const fast = new Autofocus(), slow = new Autofocus()
    const ff = run(fast, 2, { ...base, tier: 1, halfPressed: true, lensSpeed: 0.2 }, 0.4)
    const fs = run(slow, 2, { ...base, tier: 1, halfPressed: true, lensSpeed: 0.9 }, 0.4)
    expect(ff - 2).toBeGreaterThan(fs - 2)
  })
  it('hunts back and forth when nothing is under the point', () => {
    const af = new Autofocus()
    const f = run(af, 10, { ...base, tier: 1, halfPressed: true, centerDistM: null }, 1)
    expect(af.state).toBe('hunting')
    expect(f).not.toBe(10)
  })
  it('releasing resets to idle and keeps the focus distance', () => {
    const af = new Autofocus()
    let f = run(af, 5, { ...base, tier: 1, halfPressed: true }, 3)
    f = run(af, f, { ...base, tier: 1, halfPressed: false }, 1)
    expect(af.state).toBe('idle')
    expect(f).toBeCloseTo(12, 1)
  })
  it('reports the frame it locks', () => {
    const af = new Autofocus()
    let f = 11.9, locked = 0
    for (let i = 0; i < 60; i++) { f = af.update(1 / 60, f, { ...base, tier: 1, halfPressed: true }); if (af.justLocked) locked++ }
    expect(locked).toBe(1)
  })
})
