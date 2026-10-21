import { describe, it, expect } from 'vitest'
import { verticalFovDeg, cocMm, cocPx, hyperfocalM, depthOfField, motionBlurPx, shakeBlurPx, lensSoftPx, totalBlurPx } from '../src/camera/optics'
import { gear, maxApertureAt, lensById } from '../src/data/gear'

const FF = gear.sensors.FF
const APSC = gear.sensors.APSC

describe('verticalFovDeg', () => {
  it('50mm on full frame is about 27 degrees vertical', () => {
    expect(verticalFovDeg(50, FF)).toBeCloseTo(26.99, 1)
  })
  it('APS-C narrows the view for the same focal length', () => {
    expect(verticalFovDeg(250, APSC)).toBeLessThan(verticalFovDeg(250, FF))
  })
})

describe('coc', () => {
  it('500mm f/7.1 focused at 10m, subject at 10.3m, FF 6000px wide ≈ 18px', () => {
    const px = cocPx(500, 7.1, 10, 10.3, FF, 6000)
    expect(px).toBeGreaterThan(16)
    expect(px).toBeLessThan(20)
  })
  it('is zero on the focus plane', () => {
    expect(cocMm(500, 7.1, 10, 10)).toBe(0)
  })
  it('grows when the aperture opens up', () => {
    expect(cocMm(500, 4, 10, 10.3)).toBeGreaterThan(cocMm(500, 8, 10, 10.3))
  })
})

describe('depth of field', () => {
  it('500mm f/7.1 at 10m on FF has about 17cm total depth of field', () => {
    const { nearM, farM } = depthOfField(500, 7.1, 10, FF)
    const total = farM - nearM
    expect(total).toBeGreaterThan(0.14)
    expect(total).toBeLessThan(0.20)
  })
  it('focusing beyond hyperfocal gives infinite far limit', () => {
    const H = hyperfocalM(50, 8, FF)
    expect(depthOfField(50, 8, H * 1.1, FF).farM).toBe(Infinity)
  })
})

describe('motion and shake blur', () => {
  it('kingfisher at 5 m/s, 10m, 500mm, 1/500 on FF 6000px ≈ 83px', () => {
    const px = motionBlurPx(500, 5, 10, 1 / 500, FF, 6000)
    expect(px).toBeGreaterThan(78)
    expect(px).toBeLessThan(88)
  })
  it('1/f rule: handheld sigma 0.03 rad/s at shutter 1/f gives ~0.03mm blur', () => {
    const px = shakeBlurPx(500, 0.03, 1 / 500, FF, 6000)
    // 0.03mm on 36mm / 6000px = 5px
    expect(px).toBeCloseTo(5, 0)
  })
})

describe('lens soft and total blur', () => {
  it('wide open gives full softness, two stops down gives none', () => {
    expect(lensSoftPx(1.6, 5.6, 5.6)).toBeCloseTo(1.6)
    expect(lensSoftPx(1.6, 11.2, 5.6)).toBeCloseTo(0)
    expect(lensSoftPx(1.6, 8, 5.6)).toBeCloseTo(0.8, 1)
  })
  it('combines in quadrature', () => {
    expect(totalBlurPx({ coc: 3, motion: 4, shake: 0, soft: 0 })).toBeCloseTo(5)
  })
})

describe('maxApertureAt', () => {
  it('interpolates a variable aperture zoom', () => {
    const l = lensById('L3')
    expect(maxApertureAt(l, 100)).toBeCloseTo(4.5)
    expect(maxApertureAt(l, 500)).toBeCloseTo(7.1)
    const mid = maxApertureAt(l, 300)
    expect(mid).toBeGreaterThan(4.5)
    expect(mid).toBeLessThan(7.1)
  })
  it('prime lens is constant', () => {
    expect(maxApertureAt(lensById('L4'), 500)).toBe(4)
  })
})
