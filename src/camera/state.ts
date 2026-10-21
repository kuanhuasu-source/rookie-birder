import { APERTURE_STEPS, ISO_STEPS, SHUTTER_STEPS, nearestIndex } from './exposure'
import { gear, lensById, bodyById, supportById, accessoryById, maxApertureAt, type LensDef, type BodyDef, type SupportDef, type SensorDef, type AccessoryDef } from '../data/gear'

export interface CameraSettings {
  focalMm: number
  fNumber: number
  shutterS: number
  iso: number
  focusM: number
}

export const FOCUS_INFINITY_M = 200

export class CameraState {
  lens: LensDef
  body: BodyDef
  support: SupportDef
  accessories: AccessoryDef[] = []
  settings: CameraSettings

  constructor(lensId: string, bodyId: string, supportId: string) {
    this.lens = lensById(lensId)
    this.body = bodyById(bodyId)
    this.support = supportById(supportId)
    this.settings = {
      focalMm: this.lens.focalMax,
      fNumber: maxApertureAt(this.lens, this.lens.focalMax),
      shutterS: 1 / 500,
      iso: 400,
      focusM: 10,
    }
    this.clampAperture()
  }

  setAccessories(ids: string[]): void {
    this.accessories = ids.map((id) => accessoryById(id))
  }

  /** 配件效果的乘積：焦距倍率、光圈損失格數、對焦速度倍率、柔化、警戒倍率、出現間隔倍率。 */
  get mods(): { focalMul: number; apertureStops: number; afSpeedMul: number; softPx: number; alertMul: number; intervalMul: number } {
    let focalMul = 1, apertureStops = 0, afSpeedMul = 1, softPx = 0, alertMul = 1, intervalMul = 1
    for (const a of this.accessories) {
      focalMul *= a.focalMul ?? 1
      apertureStops += a.apertureStops ?? 0
      afSpeedMul *= a.afSpeedMul ?? 1
      softPx += a.softPx ?? 0
      alertMul *= a.alertMul ?? 1
      intervalMul *= a.intervalMul ?? 1
    }
    return { focalMul, apertureStops, afSpeedMul, softPx, alertMul, intervalMul }
  }

  /** 實際成像用的焦距與光圈（含增距鏡）。 */
  get optics(): { focalMm: number; fNumber: number; softPx: number; afSpeed: number } {
    const m = this.mods
    return {
      focalMm: this.settings.focalMm * m.focalMul,
      fNumber: this.settings.fNumber * Math.pow(Math.SQRT2, m.apertureStops),
      softPx: this.lens.softWideOpenPx + m.softPx,
      afSpeed: (this.lens.afSpeed || 0.9) * m.afSpeedMul,
    }
  }

  get sensor(): SensorDef {
    return gear.sensors[this.body.sensor]
  }

  get maxAperture(): number {
    return maxApertureAt(this.lens, this.settings.focalMm)
  }

  /** 讓光圈不小於鏡頭在此焦距的最大光圈值。 */
  clampAperture(): void {
    const maxAp = this.maxAperture
    if (this.settings.fNumber < maxAp) this.settings.fNumber = maxAp
  }

  /** 變焦：以對數比例改變焦距。 */
  zoom(steps: number): void {
    const s = this.settings
    const ratio = Math.pow(1.04, steps)
    s.focalMm = Math.min(this.lens.focalMax, Math.max(this.lens.focalMin, s.focalMm * ratio))
    this.clampAperture()
  }

  stepAperture(dir: number): void {
    const s = this.settings
    const idx = nearestIndex(APERTURE_STEPS, s.fNumber)
    let next = Math.min(APERTURE_STEPS.length - 1, Math.max(0, idx + dir))
    // 往大光圈走時不能超過鏡頭上限；若目前已是非標準值（鏡頭上限）則往小光圈走要先跳到比它小的標準值
    if (dir < 0 && APERTURE_STEPS[next] < this.maxAperture) { s.fNumber = this.maxAperture; return }
    if (dir > 0 && APERTURE_STEPS[next] <= s.fNumber) next = Math.min(APERTURE_STEPS.length - 1, next + 1)
    s.fNumber = Math.max(this.maxAperture, APERTURE_STEPS[next])
  }

  stepShutter(dir: number): void {
    const s = this.settings
    const idx = nearestIndex(SHUTTER_STEPS, s.shutterS)
    // 列表由慢到快，dir > 0 代表更快
    s.shutterS = SHUTTER_STEPS[Math.min(SHUTTER_STEPS.length - 1, Math.max(0, idx + dir))]
  }

  stepIso(dir: number): void {
    const s = this.settings
    const idx = nearestIndex(ISO_STEPS, s.iso)
    const next = ISO_STEPS[Math.min(ISO_STEPS.length - 1, Math.max(0, idx + dir))]
    s.iso = Math.min(this.body.isoMax, next)
  }

  /** 對焦環：以對數比例在最近對焦距離與無限遠之間移動。 */
  focusBy(delta: number): void {
    const s = this.settings
    const lo = Math.log(this.lens.minFocusM)
    const hi = Math.log(FOCUS_INFINITY_M)
    let t = (Math.log(s.focusM) - lo) / (hi - lo)
    t = Math.min(1, Math.max(0, t + delta))
    s.focusM = Math.exp(lo + (hi - lo) * t)
  }

  /** 直接以刻度位置 0 到 1 設定對焦距離（觸控滑桿用）。 */
  setFocusT(t: number): void {
    const lo = Math.log(this.lens.minFocusM)
    const hi = Math.log(FOCUS_INFINITY_M)
    const tc = Math.min(1, Math.max(0, t))
    this.settings.focusM = Math.exp(lo + (hi - lo) * tc)
  }

  /** 對焦距離在刻度上的 0 到 1 位置。 */
  focusT(): number {
    const lo = Math.log(this.lens.minFocusM)
    const hi = Math.log(FOCUS_INFINITY_M)
    return (Math.log(this.settings.focusM) - lo) / (hi - lo)
  }
}
