/** 相機設定折算到 ISO 100 的曝光值。 */
export function evCamera(fNumber: number, shutterS: number, iso: number): number {
  return Math.log2((fNumber * fNumber) / shutterS) - Math.log2(iso / 100)
}

/** 過曝格數：正值過曝、負值欠曝。 */
export function overStops(evScene: number, fNumber: number, shutterS: number, iso: number): number {
  return evScene - evCamera(fNumber, shutterS, iso)
}

/** 套用到線性影像的曝光倍率。 */
export function exposureMultiplier(evScene: number, fNumber: number, shutterS: number, iso: number): number {
  return Math.pow(2, overStops(evScene, fNumber, shutterS, iso))
}

/** 中灰處的噪點標準差（線性空間）。 */
export function noiseSigma(kBody: number, iso: number): number {
  return 0.004 * kBody * Math.sqrt(iso / 100)
}

/** 由其他兩個參數與場景 EV 反推正確曝光的快門（給 Av / P 模式用）。 */
export function shutterForCorrectExposure(evScene: number, fNumber: number, iso: number): number {
  // evScene = log2(N^2 / t) - log2(iso/100)  =>  t = N^2 / 2^(evScene + log2(iso/100))
  return (fNumber * fNumber) / Math.pow(2, evScene + Math.log2(iso / 100))
}

export function fNumberForCorrectExposure(evScene: number, shutterS: number, iso: number): number {
  return Math.sqrt(shutterS * Math.pow(2, evScene + Math.log2(iso / 100)))
}

export const APERTURE_STEPS = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32]

export const SHUTTER_STEPS: number[] = [
  30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3,
  1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125,
  1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500,
  1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000,
]

export const ISO_STEPS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400]

/** 在階梯列表裡找最接近 value 的索引。 */
export function nearestIndex(steps: number[], value: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < steps.length; i++) {
    const d = Math.abs(Math.log2(steps[i]) - Math.log2(value))
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

export function formatShutter(s: number): string {
  if (s >= 1) return `${Number.isInteger(s) ? s : s.toFixed(1)}"`
  const inv = 1 / s
  return `1/${inv >= 10 ? Math.round(inv) : inv.toFixed(0)}`
}
