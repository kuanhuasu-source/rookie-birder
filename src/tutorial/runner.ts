import type { TutorialStep, TutorialCtx, Control, Overlay } from './types'
import type { PhotoRecord } from '../photo/types'

export const STUCK_AFTER_S = 20

/** 依序執行教學步驟：進入時 setup、每幀 tick 與 done 檢查、完成後停留再前進。 */
export class TutorialRunner {
  index = -1
  active = false
  elapsed = 0
  private holdLeft = 0
  private photos: PhotoRecord[] = []
  private albumOpened = false
  onFinished: (() => void) | null = null

  constructor(private steps: TutorialStep[]) {}

  get step(): TutorialStep | null { return this.active ? this.steps[this.index] ?? null : null }
  get stuck(): boolean { return this.active && this.elapsed > STUCK_AFTER_S && this.holdLeft <= 0 }
  get completing(): boolean { return this.holdLeft > 0 }
  get total(): number { return this.steps.length }

  start(ctx: TutorialCtx): void {
    this.active = true
    this.index = -1
    this.advance(ctx)
  }

  stop(): void {
    this.active = false
    this.index = -1
  }

  allowed(control: Control): boolean {
    const s = this.step
    return !s || s.unlocked.includes(control)
  }

  overlays(): Overlay[] {
    return this.step?.overlays ?? []
  }

  notePhoto(p: PhotoRecord): void { if (this.active) this.photos.push(p) }
  noteAlbumOpen(): void { this.albumOpened = true }

  private advance(ctx: TutorialCtx): void {
    this.index++
    this.elapsed = 0
    this.holdLeft = 0
    this.photos = []
    this.albumOpened = false
    if (this.index >= this.steps.length) {
      this.active = false
      this.onFinished?.()
      return
    }
    this.steps[this.index].setup?.(ctx)
  }

  /** 把執行器內部的紀錄填進 ctx 再交給步驟。 */
  private fill(ctx: TutorialCtx): TutorialCtx {
    ctx.photos = this.photos
    ctx.albumOpened = this.albumOpened
    ctx.elapsed = this.elapsed
    return ctx
  }

  update(dt: number, ctx: TutorialCtx): void {
    const s = this.step
    if (!s) return
    this.elapsed += dt
    const c = this.fill(ctx)
    if (this.holdLeft > 0) {
      this.holdLeft -= dt
      if (this.holdLeft <= 0) this.advance(c)
      return
    }
    s.tick?.(c)
    if (s.done(c)) {
      if (s.holdS && s.holdS > 0) this.holdLeft = s.holdS
      else this.advance(c)
    }
  }
}
