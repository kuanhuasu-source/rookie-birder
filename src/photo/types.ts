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
  blob: Blob
  thumb: Blob
}
