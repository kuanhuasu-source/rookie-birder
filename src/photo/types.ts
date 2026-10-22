export interface PhotoMetrics {
  birdInFrame: boolean
  distM: number
  cocPx: number
  motionPx: number
  shakePx: number
  softPx: number
  totalBlurPx: number
  overStops: number
  noiseSigma: number
  /** 鳥眼在照片上的位置，0 到 1，左下為原點 */
  eyeX: number
  eyeY: number
  birdHeightFrac: number
  /** 鳥的狀態與頭部角度，給姿態評分用 */
  birdState?: string
  viewAngleDeg?: number
  species?: string
  albedo?: number
  /** 鳥面向畫面右（1）或左（-1） */
  facing?: 1 | -1
  /** 太陽方向與「鳥到相機」方向的夾角：0 順光、180 逆光 */
  lightAngleDeg?: number
  /** 鳥在光斑裡（比周圍亮兩格） */
  sunlit?: boolean
  /** 相機看鳥眼的俯仰角（度），0 代表平視 */
  pitchDeg?: number
  /** 影像統計（拍照時由小尺寸遮罩算出） */
  stats?: ImageStats
}

export interface ImageStats {
  /** 鳥被前景遮住的有效比例 0 到 1：失焦很糊的前景算成半透明 */
  occlusion: number
  /** 不管糊不糊，幾何上被前景擋住的比例 */
  rawOcclusion?: number
  /** 主體在最終照片上的平均亮度（sRGB 解碼後的線性值） */
  subjectMean: number
  clippedFrac: number
  crushedFrac: number
  /** 主體周圍環帶的亮度變異數 */
  bgVariance: number
  /** 背景與主體的距離比：(背景距離 − 主體距離) / 主體距離，夾 0 到 1，天空為 1 */
  bgSep: number
}

export interface PhotoScore {
  focus: number
  exposure: number
  composition: number
  moment: number
  total: number
  stars: number
  advice: string
  caps: string[]
  detail: Record<string, number>
}

export interface PhotoRecord {
  id: string
  takenAt: number
  width: number
  height: number
  settings: { focalMm: number; fNumber: number; shutterS: number; iso: number; focusM: number }
  gear: { lens: string; body: string; support: string }
  lighting: { time: string; weather: string; evScene: number }
  metrics: PhotoMetrics
  score: PhotoScore
  blob: Blob
  thumb: Blob
}
