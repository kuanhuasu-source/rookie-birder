import * as THREE from 'three'
import { Bird, type Perch, type Rng } from './Bird'

/** 出現機制：等待間隔 → 提前鳴叫 → 從畫面外飛入 → 離開後再等。 */
export class Spawner {
  timer: number
  called = false
  readonly callLeadS = 2.5
  onCall: (() => void) | null = null

  constructor(private bird: Bird, private perches: Perch[], private rng: Rng = Math.random, private intervalMul = 1) {
    this.timer = this.nextInterval() * 0.4   // 第一次快一點，不要讓玩家等太久
    bird.onLeft = () => { this.timer = this.nextInterval(); this.called = false }
  }

  private nextInterval(): number {
    const r = this.bird.species.interval
    return (r.min + (r.max - r.min) * this.rng()) * this.intervalMul
  }

  /** 立刻出現（除錯用）。 */
  spawnNow(): void {
    if (this.bird.inScene) return
    const perch = this.perches[Math.floor(this.rng() * this.perches.length)]
    const side = this.rng() < 0.5 ? -1 : 1
    const from = perch.position.clone().add(new THREE.Vector3(side * 10, 4 + this.rng() * 2, -3 - this.rng() * 4))
    this.bird.enter(perch, from)
    this.called = false
  }

  update(dt: number): void {
    if (this.bird.inScene) return
    this.timer -= dt
    if (!this.called && this.timer <= this.callLeadS) { this.called = true; this.onCall?.() }
    if (this.timer <= 0) this.spawnNow()
  }
}
