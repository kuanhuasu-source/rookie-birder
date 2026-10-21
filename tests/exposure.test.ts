import { describe, it, expect } from 'vitest'
import { evCamera, overStops, exposureMultiplier, noiseSigma, shutterForCorrectExposure, nearestIndex, SHUTTER_STEPS, formatShutter } from '../src/camera/exposure'

describe('exposure', () => {
  it('sunny 16: f/16 1/125 ISO 100 ≈ EV 15', () => {
    expect(evCamera(16, 1 / 125, 100)).toBeCloseTo(15, 0)
  })
  it('raising ISO one stop lowers the EV100 by one', () => {
    expect(evCamera(8, 1 / 500, 200)).toBeCloseTo(evCamera(8, 1 / 500, 100) - 1, 5)
  })
  it('overStops is positive when the camera lets in too much light', () => {
    expect(overStops(15, 4, 1 / 125, 100)).toBeGreaterThan(0)
    expect(exposureMultiplier(15, 16, 1 / 125, 100)).toBeCloseTo(1, 0)
  })
  it('shutterForCorrectExposure inverts evCamera', () => {
    const t = shutterForCorrectExposure(12, 5.6, 800)
    expect(evCamera(5.6, t, 800)).toBeCloseTo(12, 5)
  })
})

describe('noise', () => {
  it('entry body at ISO 6400 is noisy, full frame is clean', () => {
    expect(noiseSigma(1.6, 6400)).toBeCloseTo(0.0512, 3)
    expect(noiseSigma(0.6, 6400)).toBeCloseTo(0.0192, 3)
  })
})

describe('steps', () => {
  it('nearestIndex finds 1/500', () => {
    expect(SHUTTER_STEPS[nearestIndex(SHUTTER_STEPS, 1 / 500)]).toBe(1 / 500)
  })
  it('formatShutter', () => {
    expect(formatShutter(1 / 500)).toBe('1/500')
    expect(formatShutter(2)).toBe('2"')
    expect(formatShutter(0.5)).toBe('1/2')
  })
})
