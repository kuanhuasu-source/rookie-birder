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

describe('swapGear keeps the player settings', () => {
  it('keeps shutter, ISO and focus; clamps focal, aperture, ISO and focus to the new gear', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    c.settings.shutterS = 1 / 2000; c.settings.iso = 6400; c.settings.focusM = 2.5; c.settings.focalMm = 180; c.settings.fNumber = 8
    c.swapGear('L4', 'B3', 'S4')   // 500mm f/4 定焦，最近 4 m
    expect(c.settings.shutterS).toBe(1 / 2000)
    expect(c.settings.iso).toBe(6400)
    expect(c.settings.focalMm).toBe(500)
    expect(c.settings.fNumber).toBe(8)          // 比 f/4 小的光圈可以保留
    expect(c.settings.focusM).toBe(4)           // 夾到最近對焦
    expect(c.isPrime).toBe(true)
    c.settings.fNumber = 4
    c.swapGear('L3', 'B2', 'S1')   // 100-500 f/4.5-7.1；B2 ISO 上限 25600
    expect(c.settings.focalMm).toBe(500)
    expect(c.settings.fNumber).toBeCloseTo(7.1)  // 500mm 端最大光圈 7.1
    expect(c.settings.iso).toBe(6400)
    c.settings.iso = 51200
    c.swapGear('L3', 'B2', 'S1')
    expect(c.settings.iso).toBe(25600)
    c.settings.focalMm = 500
    c.swapGear('L1', 'B1', 'S0')   // 55-250：焦距夾到 250
    expect(c.settings.focalMm).toBe(250)
  })
  it('equivalent focal length reflects the crop factor and teleconverter', () => {
    const c = new CameraState('L1', 'B1', 'S0')
    expect(Math.round(c.equivalentFocalMm)).toBe(Math.round(250 * 36 / 22.3))
    c.swapGear('L5', 'B3', 'S4')
    c.setAccessories(['A3'])
    expect(c.equivalentFocalMm).toBeCloseTo(840)
  })
  it('gear specs describe every item', async () => {
    const { gearSpec, gear } = await import('../src/data/gear')
    for (const l of gear.lenses) expect(gearSpec('lens', l.id)).toContain('最近')
    for (const b of gear.bodies) expect(gearSpec('body', b.id)).toContain('ISO 上限')
    for (const s of gear.supports) expect(gearSpec('support', s.id)).toContain('手震')
    for (const a of gear.accessories) expect(gearSpec('accessory', a.id).length).toBeGreaterThan(3)
    expect(gearSpec('lens', 'L4')).toContain('定焦')
  })
})
