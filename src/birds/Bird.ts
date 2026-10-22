import * as THREE from 'three'
import type { BirdState, SpeciesDef, SpriteDef, Range } from './types'
import { BIRD_LAYER, COMPANION_LAYER } from '../render/mask'

export interface Perch {
  position: THREE.Vector3
  /** 可以沿著跳動的方向（單位向量）與範圍（m） */
  along: THREE.Vector3
  range: number
  /** 草莖搖晃幅度（m）：停在上面的鳥會跟著晃，對焦與構圖都更難 */
  swayM?: number
  /** 光斑：樹冠縫隙的陽光週期性照到這個停棲點（秒） */
  sunSpot?: { periodS: number; onS: number; phaseS: number }
  /** 停棲點類型：branch 枝 / rock 石 / ground 地面 / mud 泥灘 / water 水面 / post 樁 / wire 電線 / grass 草穗 / bamboo 竹竿 / log 倒木 */
  tags?: PerchTag[]
}

export type PerchTag = 'branch' | 'rock' | 'ground' | 'mud' | 'water' | 'post' | 'wire' | 'grass' | 'bamboo' | 'log'

/** 這隻鳥能不能停這個停棲點：鳥沒有偏好或停棲點沒有標籤就都可以。 */
export function perchFits(perch: Perch, prefs?: PerchTag[]): boolean {
  if (!prefs || !prefs.length || !perch.tags || !perch.tags.length) return true
  return perch.tags.some((t) => prefs.includes(t))
}

/** 這個停棲點在時間 t 是否被光斑照到。 */
export function perchSunlit(p: Perch, t: number): boolean {
  if (!p.sunSpot) return false
  const u = (((t + p.sunSpot.phaseS) % p.sunSpot.periodS) + p.sunSpot.periodS) % p.sunSpot.periodS
  return u < p.sunSpot.onS
}

export type Rng = () => number

function pick(r: Range, rng: Rng): number { return r.min + (r.max - r.min) * rng() }

/**
 * 一隻紙片鳥：五段狀態機 + 貼圖切換 + 程式動畫。
 * S5 飛行（飛入 / 飛離）、S4 降落 / 起飛、S1 靜止、S2 小動作、S3 跳枝。
 */
export class Bird {
  readonly group = new THREE.Group()
  readonly paper: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  readonly eye = new THREE.Object3D()
  state: BirdState = 'S1'
  inScene = false
  /** 目前貼圖的頭部角度（度） */
  viewAngleDeg = 90
  /** 目前貼圖的平均反照率 */
  albedo = 0.44
  facing: 1 | -1 = 1
  onLeft: (() => void) | null = null
  /** 教學用：停棲後不自動轉移狀態，由外面指定 */
  scripted = false

  private sprite: SpriteDef
  private stateT = 0
  private stateDur = 0
  private dwellLeft = 0
  private perch: Perch | null = null
  private perchOffset = 0
  private flight: { from: THREE.Vector3; to: THREE.Vector3; dur: number; leaving: boolean } | null = null
  private hop: { from: number; to: number } | null = null
  private bobPhase = 0
  private leaving = false
  /** 懸停中：位置在停棲點上空，狀態維持 S5 */
  private hovering = false
  private hoverT = 0
  private textures: Partial<Record<'side' | '3q' | 'takeoff', THREE.Texture>> = {}
  private readonly tmpV = new THREE.Vector3()

  constructor(readonly species: SpeciesDef, private rng: Rng = Math.random) {
    this.sprite = species.sprites.side
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    this.paper.layers.set(BIRD_LAYER)
    this.group.add(this.paper, this.eye)
    this.group.visible = false
    this.applySprite(this.sprite)
  }

  /** 由外面載入貼圖（測試時可以不載）。 */
  setTexture(key: 'side' | '3q' | 'takeoff', tex: THREE.Texture): void {
    this.textures[key] = tex
    if (this.sprite === this.species.sprites[key]) { this.paper.material.map = tex; this.paper.material.needsUpdate = true }
  }

  private applySprite(s: SpriteDef): void {
    this.sprite = s
    const key = (Object.keys(this.species.sprites) as ('side' | '3q' | 'takeoff')[]).find((k) => this.species.sprites[k] === s)!
    const tex = this.textures[key] ?? null
    if (this.paper.material.map !== tex) { this.paper.material.map = tex; this.paper.material.needsUpdate = true }
    this.paper.scale.set(s.sizeM * this.facing, s.sizeM, 1)
    // 內容在畫布中垂直置中，讓腳底落在群組原點
    this.paper.position.y = (s.contentH * s.sizeM) / 2
    this.eye.position.set((s.eyeUv[0] - 0.5) * s.sizeM * this.facing, (s.eyeUv[1] - 0.5) * s.sizeM + this.paper.position.y, 0.003)
    this.viewAngleDeg = s.viewAngleDeg
    this.albedo = s.albedo
  }

  private setFacing(f: 1 | -1): void {
    this.facing = f
    this.applySprite(this.sprite)
  }

  /** 懸停型的目標點：停棲點上空；盤旋型是圓圈上的起點。 */
  private hoverPos(): THREE.Vector3 {
    const so = this.species.soars
    if (so) return this.perchPos().add(new THREE.Vector3(so.radiusM, so.heightM, 0))
    return this.perchPos().add(new THREE.Vector3(0, this.species.hoverHeightM ?? 7, 0))
  }

  /** 潛水：true 表示在水下，紙片隱藏、評分不算在畫面裡 */
  submerged = false
  private diveTimer = 0
  private diveLeft = 0
  private rollDiveTimer(): void {
    const d = this.species.dives!
    this.diveTimer = d.everyS[0] + this.rng() * (d.everyS[1] - d.everyS[0])
  }

  /** 伴鳥：換到伴鳥圖層，遮罩與評分不看牠。 */
  isCompanion = false
  markCompanion(): void { this.isCompanion = true; this.paper.layers.set(COMPANION_LAYER) }
  get perchOffsetM(): number { return this.perchOffset }

  /** 從 from 飛進來停到 perch（懸停型則飛到上空）；offset 給群體排位置用。 */
  enter(perch: Perch, from: THREE.Vector3, offset?: number): void {
    this.perch = perch
    this.perchOffset = offset ?? (this.rng() - 0.5) * perch.range
    const to = this.species.hovers || this.species.soars ? this.hoverPos() : this.perchPos()
    this.inScene = true
    this.leaving = false
    this.hovering = false
    this.hoverT = 0
    this.submerged = false
    this.paper.visible = true
    if (this.species.dives) this.rollDiveTimer()
    this.group.visible = true
    this.dwellLeft = pick(this.species.dwell, this.rng)
    this.flight = { from: from.clone(), to, dur: from.distanceTo(to) / this.species.flightSpeedMs, leaving: false }
    this.group.position.copy(from)
    this.setFacing(to.x - from.x >= 0 ? 1 : -1)
    this.applySprite(this.species.sprites.takeoff)
    this.setState('S5')
  }

  /** 教學用：直接放在停棲點上，靜止等待指令。 */
  placeOnPerch(perch: Perch, offset = 0): void {
    this.perch = perch
    this.perchOffset = offset
    this.inScene = true
    this.leaving = false
    this.flight = null
    this.group.visible = true
    this.dwellLeft = Infinity
    this.group.position.copy(this.perchPos())
    this.submerged = false
    this.paper.visible = true
    if (this.species.dives) this.rollDiveTimer()
    this.setFacing(1)
    this.setState('S1')
    if (this.scripted) this.stateDur = Infinity
  }

  /** 教學用：切到指定的停棲狀態並停在那裡（S3 跳完會回到 S1）。 */
  scriptState(s: 'S1' | 'S2' | 'S3'): void {
    if (!this.inScene) return
    this.setState(s)
    if (s !== 'S3') this.stateDur = Infinity
  }

  /** 警戒：抬頭跳開（進 S3），之後回到停棲循環。 */
  startle(): void {
    if (!this.inScene || this.state === 'S4' || this.state === 'S5') return
    this.setState('S3')
    if (this.scripted) this.stateDur = Math.max(this.stateDur, 0.4)
  }

  /** 被嚇到：飛到另一個停棲點（不離場），停留時間減少。 */
  relocate(perch: Perch): void {
    if (!this.inScene || this.state === 'S4' || this.state === 'S5') return
    this.perch = perch
    this.perchOffset = (this.rng() - 0.5) * perch.range
    const to = this.perchPos()
    this.dwellLeft = Math.min(this.dwellLeft, 12)
    this.leaving = false
    this.flight = { from: this.group.position.clone(), to, dur: Math.max(0.6, this.group.position.distanceTo(to) / this.species.flightSpeedMs), leaving: false }
    this.setFacing(to.x - this.group.position.x >= 0 ? 1 : -1)
    this.setState('S5')
  }

  /** 目前的停棲點（沒有就 null）。 */
  get currentPerch(): Perch | null { return this.perch }

  /** 測試與除錯：立刻起飛離開（懸停型直接結束懸停）。 */
  forceTakeoff(): void {
    if (!this.inScene) return
    if (this.hovering) { this.dwellLeft = 0; return }
    if (this.state !== 'S4' && this.state !== 'S5') this.beginTakeoff()
  }

  get isHovering(): boolean { return this.hovering }

  /** 潛水循環：計時到就潛下去，水下幾秒後在附近浮上來。 */
  private updateDive(dt: number): void {
    const d = this.species.dives!
    if (this.submerged) {
      this.diveLeft -= dt
      if (this.diveLeft <= 0) {
        this.submerged = false
        this.paper.visible = true
        this.perchOffset = Math.max(-this.perch!.range / 2, Math.min(this.perch!.range / 2, this.perchOffset + (this.rng() - 0.5) * this.perch!.range))
        this.rollDiveTimer()
        this.setState('S2')   // 浮上來甩水：動作格
      }
      return
    }
    this.diveTimer -= dt
    if (this.diveTimer <= 0) {
      this.submerged = true
      this.paper.visible = false
      this.diveLeft = d.underS[0] + this.rng() * (d.underS[1] - d.underS[0])
    }
  }

  /** 光斑裡的鳥比周圍亮：紙片顏色乘上倍率（HalfFloat 緩衝可以超過 1）。 */
  private lightMulValue = 1
  setLightMul(mul: number): void {
    if (mul === this.lightMulValue) return
    this.lightMulValue = mul
    this.paper.material.color.setScalar(mul)
  }
  get lightMul(): number { return this.lightMulValue }

  private swayT = 0

  private perchPos(): THREE.Vector3 {
    const p = this.perch!
    const pos = p.position.clone().addScaledVector(p.along, this.perchOffset)
    if (p.swayM) {
      // 風吹草動：兩個不同頻率疊起來，主要是左右，少量上下
      const a = p.swayM * (Math.sin(this.swayT * 1.3) * 0.7 + Math.sin(this.swayT * 3.1) * 0.3)
      pos.x += a
      pos.y += Math.abs(a) * -0.35
    }
    return pos
  }

  private setState(s: BirdState): void {
    this.state = s
    this.stateT = 0
    switch (s) {
      case 'S1':
        this.stateDur = pick(this.species.stateDurations.S1, this.rng)
        this.applySprite(this.rng() < 0.7 ? this.species.sprites.side : this.species.sprites['3q'])
        break
      case 'S2':
        this.stateDur = pick(this.species.stateDurations.S2, this.rng)
        this.bobPhase = 0
        // 有時轉身或換個角度
        if (this.rng() < 0.25) this.setFacing(this.facing === 1 ? -1 : 1)
        else if (this.rng() < 0.4) this.applySprite(this.sprite.view === 'side' ? this.species.sprites['3q'] : this.species.sprites.side)
        break
      case 'S3': {
        this.stateDur = pick(this.species.stateDurations.S3, this.rng)
        const p = this.perch!
        const dir = this.rng() < 0.5 ? -1 : 1
        let to = this.perchOffset + dir * this.species.hopDistM * (0.6 + 0.8 * this.rng())
        to = Math.max(-p.range / 2, Math.min(p.range / 2, to))
        this.hop = { from: this.perchOffset, to }
        this.applySprite(this.species.sprites.side)
        this.setFacing((to - this.perchOffset) * p.along.x >= 0 ? 1 : -1)
        break
      }
      case 'S4':
        this.stateDur = 0.4
        this.applySprite(this.species.sprites.takeoff)
        break
      case 'S5':
        this.stateDur = this.flight ? this.flight.dur : 1
        this.applySprite(this.species.sprites.takeoff)
        break
    }
  }

  private beginTakeoff(): void {
    this.leaving = true
    this.setState('S4')
  }

  private nextPerchedState(): void {
    const table = this.species.transitions[this.state as 'S1' | 'S2' | 'S3']
    let r = this.rng()
    for (const [s, p] of Object.entries(table)) {
      r -= p
      if (r <= 0) {
        if (s === 'S4') this.beginTakeoff()
        else this.setState(s as BirdState)
        return
      }
    }
    this.setState('S1')
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.swayT += dt
    if (!this.inScene) return
    this.stateT += dt
    const sp = this.species
    switch (this.state) {
      case 'S5': {
        if (this.hovering) {
          this.hoverT += dt
          const base = this.hoverPos()
          const so = sp.soars
          if (so) {
            // 盤旋：繞停棲點上空畫大圈，幾乎不拍翅；面向跟著前進方向
            const a = (this.hoverT / so.periodS) * Math.PI * 2
            const c = this.perchPos()
            this.group.position.set(c.x + Math.cos(a) * so.radiusM, c.y + so.heightM + Math.sin(this.hoverT * 0.5) * 1.5, c.z + Math.sin(a) * so.radiusM)
            const vx = -Math.sin(a)
            if ((vx >= 0 ? 1 : -1) !== this.facing) this.setFacing(vx >= 0 ? 1 : -1)
            this.paper.scale.y = this.sprite.sizeM * (0.97 + 0.03 * Math.sin(this.hoverT * 2.5))
          } else {
            // 懸停：原地上下小幅起伏、快速拍翅，停留時間到了就離開
            this.group.position.set(base.x + Math.sin(this.hoverT * 0.7) * 0.3, base.y + Math.sin(this.hoverT * 1.9) * 0.25, base.z)
            this.paper.scale.y = this.sprite.sizeM * (0.7 + 0.3 * Math.abs(Math.sin(this.hoverT * Math.PI * 9)))
          }
          this.dwellLeft -= dt
          if (this.dwellLeft <= 0 && !this.leaving) {
            this.leaving = true
            this.hovering = false
            const away = new THREE.Vector3(this.facing * 12, 4, (this.rng() - 0.5) * 6)
            const from = this.group.position.clone()
            this.flight = { from, to: (sp.soars ? from : base).clone().add(away), dur: away.length() / sp.flightSpeedMs, leaving: true }
            this.stateT = 0
            this.stateDur = this.flight.dur
          }
          break
        }
        const f = this.flight!
        const u = Math.min(1, this.stateT / f.dur)
        // 飛行弧線：中段略高
        this.group.position.lerpVectors(f.from, f.to, u)
        this.group.position.y += Math.sin(u * Math.PI) * (f.leaving ? 1.2 : 0.8)
        const flap = 0.78 + 0.22 * Math.abs(Math.sin(this.stateT * Math.PI * 7))
        this.paper.scale.y = this.sprite.sizeM * flap
        if (u >= 1) {
          if (f.leaving) { this.inScene = false; this.group.visible = false; this.onLeft?.() }
          else if (this.species.hovers || this.species.soars) { this.group.position.copy(f.to); this.hovering = true; this.hoverT = 0; this.flight = null }
          else { this.group.position.copy(f.to); this.setState('S4') }
        }
        break
      }
      case 'S4': {
        const u = Math.min(1, this.stateT / this.stateDur)
        const base = this.perchPos()
        if (this.leaving) {
          this.group.position.copy(base).add(new THREE.Vector3(0, 0.25 * u, 0))
          this.paper.scale.y = this.sprite.sizeM * (0.85 + 0.15 * Math.sin(u * Math.PI * 2))
          if (u >= 1) {
            const away = new THREE.Vector3(this.facing * 9, 5, (this.rng() - 0.5) * 6)
            this.flight = { from: this.group.position.clone(), to: base.clone().add(away), dur: away.length() / sp.flightSpeedMs, leaving: true }
            this.setState('S5')
          }
        } else {
          this.group.position.copy(base).add(new THREE.Vector3(0, 0.12 * (1 - u), 0))
          this.paper.scale.y = this.sprite.sizeM * (0.85 + 0.15 * (1 - u))
          if (u >= 1) { this.group.position.copy(base); this.setState('S1') }
        }
        break
      }
      case 'S1': {
        this.group.position.copy(this.perchPos())
        this.paper.scale.y = this.sprite.sizeM * (1 + 0.008 * Math.sin(this.stateT * 2.2))
        this.paper.rotation.z = 0
        if (sp.dives) this.updateDive(dt)
        if (!this.submerged && this.stateT >= this.stateDur) this.afterPerched()
        break
      }
      case 'S2': {
        this.group.position.copy(this.perchPos())
        this.bobPhase += dt * 9
        // 點頭、理毛：小幅前傾與擺動
        this.paper.rotation.z = this.facing * Math.sin(this.bobPhase) * 0.07
        this.paper.scale.y = this.sprite.sizeM * (1 - 0.03 * Math.max(0, Math.sin(this.bobPhase * 0.5)))
        if (this.stateT >= this.stateDur) { this.paper.rotation.z = 0; this.afterPerched() }
        break
      }
      case 'S3': {
        const u = Math.min(1, this.stateT / this.stateDur)
        const h = this.hop!
        this.perchOffset = h.from + (h.to - h.from) * u
        this.group.position.copy(this.perchPos())
        this.group.position.y += Math.sin(u * Math.PI) * 0.12
        if (u >= 1) this.afterPerched()
        break
      }
    }
    // 面向相機（只轉水平）
    this.tmpV.subVectors(cameraPos, this.group.position)
    this.group.rotation.y = Math.atan2(this.tmpV.x, this.tmpV.z)
  }

  private afterPerched(): void {
    if (this.scripted) { this.setState('S1'); this.stateDur = Infinity; return }
    this.dwellLeft -= this.stateT
    if (this.dwellLeft <= 0) this.beginTakeoff()
    else this.nextPerchedState()
  }
}
