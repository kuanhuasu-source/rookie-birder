import type { PhotoRecord } from '../photo/types'

export type Control = 'look' | 'zoom' | 'focus' | 'aperture' | 'shutter' | 'iso' | 'shoot' | 'overview' | 'album'
export type Overlay = 'focusPoint' | 'thirds' | 'leadArrow' | 'triangle'

/** 教學步驟能看到與操作的遊戲狀態。 */
export interface TutorialCtx {
  settings: { focalMm: number; fNumber: number; shutterS: number; iso: number; focusM: number }
  overview: boolean
  metrics: { birdInFrame: boolean; cocPx: number; birdHeightFrac: number; overStops: number; eyeX: number; eyeY: number } | null
  /** 這一步開始後拍到的照片 */
  photos: PhotoRecord[]
  albumOpened: boolean
  birdState: string
  birdInScene: boolean
  /** 這一步經過的秒數 */
  elapsed: number
  // 動作
  setFocal: (mm: number) => void
  setFocus: (m: number) => void
  setExposure: (fNumber: number | null, shutterS: number | null, iso: number | null) => void
  setLighting: (time: 'dawn' | 'morning' | 'noon' | 'dusk', weather: 'sunny' | 'overcast') => void
  aimOffset: (yawRad: number, pitchRad: number) => void
  birdPlace: () => void
  birdScript: (s: 'S1' | 'S2' | 'S3') => void
  birdTakeoff: () => void
  birdReenter: () => void
  giveCoins: (n: number) => void
}

export interface TutorialStep {
  id: string
  title: string
  hint: string[]
  stuckHint?: string
  unlocked: Control[]
  overlays: Overlay[]
  /** 進入這一步時執行 */
  setup?: (ctx: TutorialCtx) => void
  /** 每幀檢查，回傳 true 進下一步 */
  done: (ctx: TutorialCtx) => boolean
  /** 每幀呼叫，給腳本化的鳥用 */
  tick?: (ctx: TutorialCtx) => void
  /** 完成後停留幾秒再進下一步 */
  holdS?: number
}
