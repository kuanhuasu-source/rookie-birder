import { describe, it, expect } from 'vitest'
import { scorePhoto, acesCurve, acesInverse, expectedSubjectMean, coinsFor } from '../src/photo/score'
import type { PhotoMetrics } from '../src/photo/types'

const ctx = { imageW: 1920, imageH: 1280 }

function good(over: Partial<PhotoMetrics> = {}): PhotoMetrics {
  const albedo = 0.44
  return {
    birdInFrame: true, distM: 10, cocPx: 0.3, motionPx: 0.2, shakePx: 0.3, softPx: 0.2, totalBlurPx: 0.5,
    overStops: 0, noiseSigma: 0.008, eyeX: 0.66, eyeY: 0.62, birdHeightFrac: 0.35,
    birdState: 'S4', viewAngleDeg: 90, species: 'spotted-dove', albedo, facing: -1, lightAngleDeg: 30, pitchDeg: 2,
    stats: { occlusion: 0, subjectMean: expectedSubjectMean(albedo), clippedFrac: 0, crushedFrac: 0, bgVariance: 0.005, bgSep: 1 },
    ...over,
  }
}

describe('scorePhoto', () => {
  it('a well-executed take-off shot is five stars', () => {
    const s = scorePhoto(good(), ctx)
    expect(s.total).toBeGreaterThanOrEqual(85)
    expect(s.stars).toBe(5)
    expect(s.advice).toContain('圖鑑')
  })
  it('no bird scores zero', () => {
    const s = scorePhoto(good({ birdInFrame: false }), ctx)
    expect(s.total).toBe(0)
    expect(s.stars).toBe(0)
  })
  it('a badly defocused eye is capped at two stars and the advice talks about focus', () => {
    const s = scorePhoto(good({ cocPx: 16, totalBlurPx: 16 }), ctx)
    expect(s.stars).toBeLessThanOrEqual(2)
    expect(s.focus).toBeLessThan(5)
    expect(s.advice).toContain('對焦')
  })
  it('motion blur advice mentions shutter', () => {
    const s = scorePhoto(good({ motionPx: 9, totalBlurPx: 9 }), ctx)
    expect(s.advice).toContain('快門')
    expect(s.focus).toBeLessThan(15)
  })
  it('acesInverse inverts acesCurve', () => {
    for (const x of [0.05, 0.2, 0.5, 1.0, 2.0]) expect(acesInverse(acesCurve(x))).toBeCloseTo(x, 2)
  })
  it('two stops over exposure loses most exposure points', () => {
    const m = good()
    m.stats!.subjectMean = acesCurve(acesInverse(m.stats!.subjectMean) * 4)
    const s = scorePhoto(m, ctx)
    expect(s.exposure).toBeLessThan(5)
    expect(s.advice).toContain('過曝')
  })
  it('falls back to overStops when no image stats are available', () => {
    const s = scorePhoto(good({ stats: undefined, overStops: -1.2 }), ctx)
    expect(s.exposure).toBeLessThan(13)
    expect(s.advice).toContain('欠曝')
  })
  it('heavy occlusion caps at one star', () => {
    const m = good()
    m.stats!.occlusion = 0.7
    const s = scorePhoto(m, ctx)
    expect(s.stars).toBe(1)
    expect(s.caps).toContain('鳥被遮住超過一半')
  })
  it('a static bird scores lower on moment than a take-off', () => {
    const a = scorePhoto(good({ birdState: 'S1' }), ctx)
    const b = scorePhoto(good({ birdState: 'S4' }), ctx)
    expect(a.moment).toBeLessThan(b.moment)
    expect(a.advice).toContain('等牠')
  })
  it('backlight loses the catchlight bonus', () => {
    const a = scorePhoto(good({ lightAngleDeg: 160 }), ctx)
    const b = scorePhoto(good({ lightAngleDeg: 20 }), ctx)
    expect(a.moment).toBeLessThan(b.moment)
  })
  it('a tiny bird loses detail and composition', () => {
    const s = scorePhoto(good({ birdHeightFrac: 0.06 }), ctx)
    expect(s.focus).toBeLessThan(23)
    expect(s.advice).toContain('太小')
  })
  it('coins per star', () => {
    expect(coinsFor(5)).toBe(20)
    expect(coinsFor(1)).toBe(0)
  })
})
