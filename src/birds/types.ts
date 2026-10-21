export type BirdState = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

export type SpriteView = 'side' | '3q' | 'front' | 'takeoff'

export interface SpriteDef {
  file: string
  view: SpriteView
  /** 眼睛在貼圖上的 uv，左下為原點 */
  eyeUv: [number, number]
  /** 內容在正方形畫布中的寬高佔比 */
  contentW: number
  contentH: number
  /** 紙片在世界裡的邊長（m） */
  sizeM: number
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
}
