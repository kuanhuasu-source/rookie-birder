/**
 * 自動對焦：依機身等級決定行為，依鏡頭速度決定合焦要多久。
 * tier 0 手動；1 單點（半按時取一次目標）；2 連續（半按期間每幀重取）；3 鳥眼（有鳥就鎖眼睛）。
 */
export type AfTier = 0 | 1 | 2 | 3
export type AfState = 'idle' | 'seeking' | 'locked' | 'hunting'

export interface AfInput {
  halfPressed: boolean
  tier: AfTier
  /** 鏡頭合焦每公尺需要的秒數（越小越快） */
  lensSpeed: number
  /** 中心點的場景距離（m），沒打到東西為 null */
  centerDistM: number | null
  /** 鳥眼距離（m），鳥不在畫面內為 null */
  eyeDistM: number | null
  minFocusM: number
  maxFocusM: number
}

export class Autofocus {
  state: AfState = 'idle'
  /** 目前的目標距離 */
  target: number | null = null
  /** 連續對焦與鳥眼用：是否正在追 */
  tracking = false
  /** 拉風箱時的方向 */
  private huntDir = 1
  private wasPressed = false
  /** 合焦那一幀為 true，給提示音用 */
  justLocked = false

  /** 回傳新的對焦距離。 */
  update(dt: number, focusM: number, input: AfInput): number {
    this.justLocked = false
    if (input.tier === 0 || !input.halfPressed) {
      this.state = 'idle'
      this.target = null
      this.tracking = false
      this.wasPressed = input.halfPressed
      return focusM
    }
    const pressedNow = !this.wasPressed
    this.wasPressed = true

    // 取目標：單點只在按下那一刻取一次；連續與鳥眼每幀重取
    const wanted = input.tier === 3 && input.eyeDistM !== null ? input.eyeDistM : input.centerDistM
    if (input.tier === 1) { if (pressedNow) this.target = wanted }
    else this.target = wanted

    if (this.target === null) {
      // 拉風箱：來回掃
      this.state = 'hunting'
      const speed = 3 / Math.max(0.05, input.lensSpeed)      // m/s
      let f = focusM + this.huntDir * speed * dt
      if (f >= input.maxFocusM) { f = input.maxFocusM; this.huntDir = -1 }
      if (f <= input.minFocusM) { f = input.minFocusM; this.huntDir = 1 }
      return f
    }

    const t = Math.min(input.maxFocusM, Math.max(input.minFocusM, this.target))
    const diff = t - focusM
    // 合焦判定：模糊圈大致在可接受範圍，用距離的 1.5% 當門檻
    const tol = Math.max(0.03, t * 0.015)
    if (Math.abs(diff) <= tol) {
      if (this.state !== 'locked') this.justLocked = true
      this.state = 'locked'
      this.tracking = input.tier >= 2
      return t
    }
    this.state = 'seeking'
    // 對焦馬達：近處每秒約 4/lensSpeed 公尺，遠處按比例更快（對焦環是對數刻度）。
    // 入門鏡 3 → 13 公尺約 1.2 秒，L 級變焦約 0.4 秒。
    const speed = (4 / Math.max(0.05, input.lensSpeed)) * Math.max(1, focusM / 4)
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt)
    return focusM + step
  }
}

export const AF_LABEL: Record<AfTier, string> = { 0: 'MF', 1: 'AF-S 單點', 2: 'AF-C 追焦', 3: '鳥眼 AF' }
