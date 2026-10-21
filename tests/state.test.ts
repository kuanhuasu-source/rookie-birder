import { describe, it, expect } from 'vitest'
import { CameraState } from '../src/camera/state'
import { ShakeModel, effectiveSigma } from '../src/camera/shake'

describe('CameraState', () => {
  it('starts at the long end wide open', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    expect(c.settings.focalMm).toBe(250)
    expect(c.settings.fNumber).toBeCloseTo(5.6)
  })
  it('aperture cannot open past the lens limit at the current focal length', () => {
    const c = new CameraState('L3', 'B3', 'S0')
    c.settings.focalMm = 500
    c.stepAperture(-1)
    c.stepAperture(-1)
    expect(c.settings.fNumber).toBeCloseTo(7.1)
    c.stepAperture(1)
    expect(c.settings.fNumber).toBe(8)
  })
  it('zooming in on a variable aperture zoom closes the aperture if needed', () => {
    const c = new CameraState('L3', 'B3', 'S0')
    c.settings.focalMm = 100
    c.settings.fNumber = 4.5
    c.zoom(100)
    expect(c.settings.focalMm).toBe(500)
    expect(c.settings.fNumber).toBeCloseTo(7.1)
  })
  it('ISO is capped by the body', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    for (let i = 0; i < 40; i++) c.stepIso(1)
    expect(c.settings.iso).toBe(12800)
  })
  it('focus ring stays within lens range', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    c.focusBy(-10)
    expect(c.settings.focusM).toBeCloseTo(1.0)
    c.focusBy(10)
    expect(c.settings.focusM).toBeCloseTo(200)
  })
})

describe('shake', () => {
  it('5 stops of IS cuts sigma by 32x', () => {
    expect(effectiveSigma(1, 5)).toBeCloseTo(0.03 / 32)
  })
  it('handheld angular velocity has roughly the configured standard deviation', () => {
    const m = new ShakeModel()
    m.sigma = 0.03
    let sum = 0, sum2 = 0, n = 0
    for (let i = 0; i < 20000; i++) { m.update(1 / 60); sum += m.omegaYaw; sum2 += m.omegaYaw ** 2; n++ }
    const sd = Math.sqrt(sum2 / n - (sum / n) ** 2)
    expect(sd).toBeGreaterThan(0.018)
    expect(sd).toBeLessThan(0.045)
  })
  it('does not drift away', () => {
    const m = new ShakeModel()
    for (let i = 0; i < 60000; i++) m.update(1 / 60)
    expect(Math.abs(m.yaw)).toBeLessThan(0.1)
  })
})

describe('accessories', () => {
  it('a 2x teleconverter doubles focal length and costs two stops', () => {
    const c = new CameraState('L4', 'B3', 'S4')
    c.setAccessories(['A4'])
    expect(c.optics.focalMm).toBe(1000)
    expect(c.optics.fNumber).toBeCloseTo(8, 1)
    expect(c.optics.afSpeed).toBeGreaterThan(c.lens.afSpeed)
  })
  it('camouflage and hide multiply alert and interval', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    c.setAccessories(['A1', 'A2'])
    expect(c.mods.alertMul).toBeCloseTo(0.125)
    expect(c.mods.intervalMul).toBeCloseTo(0.7)
    expect(c.optics.focalMm).toBe(250)
  })
})
