import { describe, it, expect } from 'vitest'
import { Shooting } from '../src/camera/body'
import { bodyById } from '../src/data/gear'

function run(s: Shooting, seconds: number, down: boolean): number {
  let shots = 0
  const dt = 1 / 120
  for (let t = 0; t < seconds; t += dt) shots += s.update(dt, down)
  return shots
}

describe('Shooting', () => {
  it('entry body shoots at 5 fps until the buffer fills, then at card speed', () => {
    const s = new Shooting(bodyById('B1'), 60)
    // 8 張緩衝：前 1.6 秒內拍 8 張左右，之後降到 1.5 fps
    const first = run(s, 1.0, true)
    expect(first).toBeGreaterThanOrEqual(5)
    expect(first).toBeLessThanOrEqual(6)
    const later = run(s, 4.0, true)
    // 緩衝區滿後約 1.5 fps 加上清空的部分
    expect(later).toBeLessThan(12)
  })
  it('stops when the card is full', () => {
    const s = new Shooting(bodyById('B4'), 10)
    expect(run(s, 5, true)).toBe(10)
    expect(s.cardLeft).toBe(0)
  })
  it('buffer drains when not shooting', () => {
    const s = new Shooting(bodyById('B1'), 60)
    run(s, 2, true)
    expect(s.buffer).toBeGreaterThan(0)
    run(s, 10, false)
    expect(s.buffer).toBe(0)
  })
  it('single tap shoots exactly once', () => {
    const s = new Shooting(bodyById('B1'), 60)
    expect(s.update(1 / 60, true)).toBe(1)
    expect(s.update(1 / 60, true)).toBe(0)
  })
})
