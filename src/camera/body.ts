import type { BodyDef } from '../data/gear'

/** 連拍、緩衝區、記憶卡、黑屏。 */
export class Shooting {
  buffer = 0
  cardLeft: number
  blackoutT = 0
  private cooldown = 0
  private drain = 0

  constructor(public body: BodyDef, cardCapacity: number) {
    this.cardLeft = cardCapacity
  }

  /** 緩衝區滿了就只能以寫卡速度拍。 */
  get currentFps(): number {
    return this.buffer >= this.body.bufferFrames ? this.body.cardWriteFps : this.body.fps
  }

  /** 每幀呼叫，回傳這一幀應該拍幾張（通常 0 或 1）。 */
  update(dt: number, shutterDown: boolean): number {
    this.cooldown = Math.max(0, this.cooldown - dt)
    this.blackoutT = Math.max(0, this.blackoutT - dt)
    // 緩衝區以寫卡速度清空
    this.drain += dt * this.body.cardWriteFps
    while (this.drain >= 1 && this.buffer > 0) { this.buffer--; this.drain -= 1 }
    if (this.buffer === 0) this.drain = 0

    if (!shutterDown || this.cardLeft <= 0 || this.cooldown > 0) return 0
    this.cooldown = 1 / this.currentFps
    this.buffer++
    this.cardLeft--
    if (this.body.blackout) this.blackoutT = 0.06
    return 1
  }
}
