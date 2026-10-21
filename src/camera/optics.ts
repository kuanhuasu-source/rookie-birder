import type { SensorDef } from '../data/gear'

/** 垂直視角（度）。three.js PerspectiveCamera.fov 用的是垂直視角。 */
export function verticalFovDeg(focalMm: number, sensor: SensorDef): number {
  return (2 * Math.atan(sensor.heightMm / (2 * focalMm)) * 180) / Math.PI
}

/**
 * 模糊圈直徑（mm）。
 * focalMm 焦距、fNumber 光圈值、focusM 對焦距離（m）、distM 物距（m）。
 */
export function cocMm(focalMm: number, fNumber: number, focusM: number, distM: number): number {
  const s = focusM * 1000
  const d = Math.max(distM * 1000, 1)
  if (s <= focalMm) return 0
  const aperture = focalMm / fNumber
  return aperture * (focalMm / (s - focalMm)) * (Math.abs(d - s) / d)
}

/** 把 mm 的模糊圈換成影像寬 imageW 像素下的直徑。 */
export function mmToPx(mm: number, sensor: SensorDef, imageW: number): number {
  return (mm / sensor.widthMm) * imageW
}

export function cocPx(focalMm: number, fNumber: number, focusM: number, distM: number, sensor: SensorDef, imageW: number): number {
  return mmToPx(cocMm(focalMm, fNumber, focusM, distM), sensor, imageW)
}

/** 超焦距（m）。 */
export function hyperfocalM(focalMm: number, fNumber: number, sensor: SensorDef): number {
  return ((focalMm * focalMm) / (fNumber * sensor.cocMm) + focalMm) / 1000
}

/** 景深近端與遠端（m）。遠端 Infinity 表示到無限遠。 */
export function depthOfField(focalMm: number, fNumber: number, focusM: number, sensor: SensorDef): { nearM: number; farM: number } {
  const H = hyperfocalM(focalMm, fNumber, sensor) * 1000
  const s = focusM * 1000
  const f = focalMm
  const near = (s * (H - f)) / (H + s - 2 * f)
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s)
  return { nearM: near / 1000, farM: far === Infinity ? Infinity : far / 1000 }
}

/** 主體動態模糊長度（px）。vMs 切向速度 m/s、distM 距離 m、shutterS 快門秒。 */
export function motionBlurPx(focalMm: number, vMs: number, distM: number, shutterS: number, sensor: SensorDef, imageW: number): number {
  const blurMm = focalMm * (vMs / distM) * shutterS
  return mmToPx(blurMm, sensor, imageW)
}

/** 手震造成的模糊長度（px）。omegaRadS 角速度。 */
export function shakeBlurPx(focalMm: number, omegaRadS: number, shutterS: number, sensor: SensorDef, imageW: number): number {
  return mmToPx(focalMm * omegaRadS * shutterS, sensor, imageW)
}

/** 鏡頭全開柔化：光圈縮小兩格內線性消失。 */
export function lensSoftPx(softWideOpenPx: number, fNumber: number, maxApertureFNumber: number): number {
  const stopsDown = 2 * Math.log2(fNumber / maxApertureFNumber)
  const t = Math.min(1, Math.max(0, stopsDown / 2))
  return softWideOpenPx * (1 - t)
}

export function totalBlurPx(parts: { coc: number; motion: number; shake: number; soft: number }): number {
  return Math.sqrt(parts.coc ** 2 + parts.motion ** 2 + parts.shake ** 2 + parts.soft ** 2)
}
