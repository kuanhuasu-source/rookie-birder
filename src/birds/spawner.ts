import * as THREE from 'three'
import { Bird, perchFits, type Perch, type Rng } from './Bird'

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

  /** 群體的伴鳥池：species id → 幾隻備用的 Bird */
  companions: Record<string, Bird[]> = {}

  constructor(private birds: Bird[], private perches: Perch[], private rng: Rng = Math.random, private weights?: Record<string, number>, public intervalMul = 1) {
    if (birds.length === 0) throw new Error('spawner needs at least one bird')
    this.next = this.pick()
    this.timer = this.nextInterval() * 0.4   // 第一次快一點，不要讓玩家等太久
    for (const b of birds) b.onLeft = () => this.onBirdLeft(b)
  }

  /** 目前在場的伴鳥。 */
  activeCompanions(): Bird[] {
    if (!this.current) return []
    return (this.companions[this.current.species.id] ?? []).filter((c) => c.inScene)
  }

  /** 伴鳥一起離開（領頭走了或被嚇到）。 */
  flushCompanions(): void {
    for (const c of this.activeCompanions()) c.forceTakeoff()
  }

  private onBirdLeft(b: Bird): void {
    if (this.current === b) { this.flushCompanions(); this.current = null }
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

  /** 比目前更遠離相機的停棲點（被嚇到時飛過去）；沒有就回 null，讓鳥直接離場。 */
  /** 這隻鳥能停的停棲點；場景裡一個都沒有就退回全部。 */
  perchesFor(bird: Bird): Perch[] {
    const ok = this.perches.filter((p) => perchFits(p, bird.species.perchTags))
    return ok.length ? ok : this.perches
  }

  fartherPerch(from: Perch | null, cameraPos: THREE.Vector3): Perch | null {
    const pool = this.current ? this.perchesFor(this.current) : this.perches
    const others = pool.filter((p) => p !== from)
    if (!others.length) return null
    const cur = from ? from.position.distanceTo(cameraPos) : 0
    const far = others.filter((p) => p.position.distanceTo(cameraPos) > cur + 1)
    if (!far.length) return null
    return far[Math.floor(this.rng() * far.length)]
  }

  /** 立刻出現（除錯用）。 */
  spawnNow(): void {
    if (this.current) return
    const pool = this.perchesFor(this.next)
    const perch = pool[Math.floor(this.rng() * pool.length)]
    const side = this.rng() < 0.5 ? -1 : 1
    const from = perch.position.clone().add(new THREE.Vector3(side * 10, 4 + this.rng() * 2, -3 - this.rng() * 4))
    this.current = this.next
    this.current.enter(perch, from)
    this.called = false
    // 群體：伴鳥排在領頭兩側，從稍遠的地方跟進來
    const flock = this.current.species.flock
    const pool2 = this.companions[this.current.species.id] ?? []
    if (flock && pool2.length) {
      const fitN = Math.floor(perch.range / flock.spacingM) + 1
      const n = Math.min(fitN, flock.min + Math.floor(this.rng() * (flock.max - flock.min + 1)))
      const lead = this.current.perchOffsetM
      // 兩側輪流往外排，排到停棲點邊緣就跳過，不要疊在一起
      const offsets: number[] = []
      const kMax = Math.ceil(perch.range / flock.spacingM) + 1
      for (let k = 1; k <= kMax && offsets.length < n - 1; k++) {
        for (const dir of [1, -1]) {
          const off = lead + dir * k * flock.spacingM
          if (Math.abs(off) <= perch.range / 2 + 1e-6 && offsets.length < n - 1) offsets.push(off)
        }
      }
      offsets.forEach((off, i) => {
        const c = pool2[i]
        if (c) c.enter(perch, from.clone().add(new THREE.Vector3(side * (2 + i), 0.5 + this.rng(), -1 - this.rng() * 2)), off)
      })
    }
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
