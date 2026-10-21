/**
 * 驚嚇：鳥的警戒值 0 到 1。雲台轉太快、連拍、距離太近會累積，安靜時消退。
 * 0.6 以上牠會警戒（抬頭、跳開），到 1 會飛走。
 */
export interface AlertInput {
  /** 雲台角速度（rad/s） */
  panOmega: number
  /** 這一幀拍了幾張 */
  shots: number
  /** 鳥到相機的距離（m） */
  distM: number
  /** 鳥種敏感度，1 為中等 */
  skittish: number
  /** 鳥種的容忍距離（m），再近就持續累積 */
  flushDistM: number
  /** 配件倍率：迷彩布 0.5、躲鳥帳 0.25 */
  mul: number
  /** 機身是否安靜（電子快門） */
  silent: boolean
}

export const WARY_AT = 0.6
export const FLUSH_AT = 1.0

export class AlertModel {
  value = 0
  private waryFired = false

  reset(): void { this.value = 0; this.waryFired = false }

  /** 回傳這一幀發生的事件。 */
  update(dt: number, i: AlertInput): 'wary' | 'flush' | null {
    let gain = 0
    // 雲台：超過 0.25 rad/s 開始算，越快越多
    if (i.panOmega > 0.25) gain += (i.panOmega - 0.25) * 0.9
    // 連拍：每張 0.02（敏感度 1 時約 50 張飛走），電子快門不到一半
    gain += i.shots * (i.silent ? 0.008 : 0.02) / Math.max(dt, 1e-3)
    // 距離：比容忍距離近，每秒累積
    if (i.distM < i.flushDistM) gain += (1 - i.distM / i.flushDistM) * 0.35
    gain *= i.skittish * i.mul
    // 消退：每秒 0.08
    this.value = Math.max(0, Math.min(1, this.value + (gain - 0.08) * dt))
    if (this.value >= FLUSH_AT) { this.reset(); return 'flush' }
    if (!this.waryFired && this.value >= WARY_AT) { this.waryFired = true; return 'wary' }
    if (this.value < WARY_AT * 0.7) this.waryFired = false
    return null
  }
}
