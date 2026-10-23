export type BirdState = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

/**
 * 各狀態的最小「微動」速度（m/s）：就算看起來靜止，鳥的頭與身體也一直在動，
 * 慢速快門拍不出完全清楚的鳥。用來當動態模糊的下限，讓三腳架不能用 1/3 秒換低 ISO。
 */
export const FIDGET_MS: Record<BirdState, number> = { S1: 0.02, S2: 0.08, S3: 0.3, S4: 0.5, S5: 0.5 }

export type SpriteView = 'side' | '3q' | 'front' | 'takeoff'

export interface SpriteDef {
  file: string
  view: SpriteView
  /** 眼睛在貼圖上的 uv，左下為原點 */
  eyeUv: [number, number]
  /** 內容在正方形畫布中的寬高佔比 */
  contentW: number
  contentH: number
  /** 紙片在世界裡的高（m）；寬 = sizeM × aspect */
  sizeM: number
  /** 貼圖寬高比，沒給就是正方形 */
  aspect?: number
  /** 頭部方向與相機視線的夾角（度）：側面 90、四分之三 45、正面 0 */
  viewAngleDeg: number
  /** 這張貼圖不透明區域的平均線性亮度，曝光評分的目標 */
  albedo: number
}

export interface Range { min: number; max: number }

export interface SpeciesDef {
  id: string
  nameZh: string
  nameEn: string
  /** 身體高度（m），構圖評分用 */
  bodyHeightM: number
  /** 主體平均反照率對應的曝光目標亮度 */
  albedo: number
  sprites: Record<'side' | '3q' | 'takeoff', SpriteDef>
  /** 一次停留的總秒數 */
  dwell: Range
  /** 兩次出現之間的秒數 */
  interval: Range
  stateDurations: Record<'S1' | 'S2' | 'S3', Range>
  /** 停棲狀態之間的轉移機率（不含被 dwell 逼出的起飛） */
  transitions: Record<'S1' | 'S2' | 'S3', Partial<Record<'S1' | 'S2' | 'S3' | 'S4', number>>>
  flightSpeedMs: number
  hopDistM: number
  call: { baseHz: number; notes: number; noteS: number; gapS: number }
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  /** 驚嚇敏感度，1 為中等 */
  skittish?: number
  /** 容忍距離（m），比這近會一直累積警戒 */
  flushDistM?: number
  /** 懸停型（黑翅鳶）：不停棲，飛到停棲點上空懸停到停留時間結束 */
  hovers?: boolean
  /** 懸停高度（m） */
  hoverHeightM?: number
  /** 盤旋型（大冠鷲）：在停棲點上空繞大圈滑翔，不停棲 */
  soars?: { heightM: number; radiusM: number; periodS: number }
  /** 潛水型（小鸊鷉）：停在水面時週期性潛下去再浮上來 */
  dives?: { everyS: [number, number]; underS: [number, number] }
  /** 橫向通過（火車）：沿停棲點方向直線等速穿過，從不停下 */
  passes?: { speedMs: number; spanM: number }
  /** 會停的停棲點類型；沒給就什麼都停 */
  perchTags?: import('./Bird').PerchTag[]
  /** 群體：一次來幾隻（含領頭），在同一個停棲點上隔 spacingM 排開 */
  flock?: { min: number; max: number; spacingM: number }
}
