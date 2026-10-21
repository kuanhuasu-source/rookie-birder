import * as THREE from 'three'
import { Bird, type Perch, type Rng } from './Bird'

/** 出現機制：等待間隔 → 提前鳴叫 → 從畫面外飛入 → 離開後再等。多鳥種時依權重挑一隻，同時只有一隻在場。 */
export class Spawner {
  timer: number
  called = false
  readonly callLeadS = 2.5
  /** 下一隻要出現的鳥（鳴叫用的是牠的叫聲） */
  next: Bird
  /** 目前在場的鳥 */
  current: Bird | null = null
  onCall: ((bird: Bird) => void) | null = null

  constructor(private birds: Bird[], private perches: Perch[], private rng: Rng = Math.random, private weights?: Record<string, number>, private intervalMul = 1) {
    if (birds.length === 0) throw new Error('spawner needs at least one bird')
    this.next = this.pick()
    this.timer = this.nextInterval() * 0.4   // 第一次快一點，不要讓玩家等太久
    for (const b of birds) b.onLeft = () => this.onBirdLeft(b)
  }

  private onBirdLeft(b: Bird): void {
    if (this.current === b) this.current = null
    this.next = this.pick()
    this.timer = this.nextInterval()
    this.called = false
  }

  private pick(): Bird {
    if (this.birds.length === 1) return this.birds[0]
    const ws = this.birds.map((b) => this.weights?.[b.species.id] ?? 1)
    let r = this.rng() * ws.reduce((a, b) => a + b, 0)
    for (let i = 0; i < this.birds.length; i++) { r -= ws[i]; if (r <= 0) return this.birds[i] }
    return this.birds[this.birds.length - 1]
  }

  private nextInterval(): number {
    const r = this.next.species.interval
    return (r.min + (r.max - r.min) * this.rng()) * this.intervalMul
  }

  /** 立刻出現（除錯用）。 */
  spawnNow(): void {
    if (this.current) return
    const perch = this.perches[Math.floor(this.rng() * this.perches.length)]
    const side = this.rng() < 0.5 ? -1 : 1
    const from = perch.position.clone().add(new THREE.Vector3(side * 10, 4 + this.rng() * 2, -3 - this.rng() * 4))
    this.current = this.next
    this.current.enter(perch, from)
    this.called = false
  }

  /** 教學結束等情境：重新開始等待。 */
  reset(delayS: number): void {
    this.current = this.birds.find((b) => b.inScene) ?? null
    this.next = this.pick()
    this.timer = delayS
    this.called = false
  }

  update(dt: number): void {
    if (this.current?.inScene) return
    this.current = null
    this.timer -= dt
    if (!this.called && this.timer <= this.callLeadS) { this.called = true; this.onCall?.(this.next) }
    if (this.timer <= 0) this.spawnNow()
  }
}
