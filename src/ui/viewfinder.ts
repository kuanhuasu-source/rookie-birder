import { formatShutter } from '../camera/exposure'
import type { CameraState } from '../camera/state'

export interface HudExtra {
  overview: boolean
  evScene: number
  overStops: number
  blurInfo: string
  helpVisible: boolean
  hint: string
  cardLeft: number
  buffer: number
  bufferMax: number
  blackout: boolean
  flash: boolean
  coins: number
  toast: string
  reduceShake: boolean
  /** 剩餘秒數，null 表示沒有計時 */
  timerS: number | null
  quests: { title: string; done: boolean }[]
  afLabel: string
  afState: 'idle' | 'seeking' | 'locked' | 'hunting'
  /** 場上那隻鳥的警戒值 0 到 1，沒鳥為 null */
  alert: { name: string; value: number } | null
}

const HELP = `滑鼠 轉雲台   滾輪 變焦   對焦環：W/S 或方向鍵、Shift+滾輪、右鍵拖曳
Q/E 光圈   A/D 快門   Z/C ISO   Tab 放下相機看全景
空白鍵 半按對焦（機身有自動對焦時）   Shift 穩住（手震減半、雲台變慢）   V 減少畫面晃動（不影響照片）   Y 畫質高 / 低
左鍵 快門（按住連拍）   G 相簿   K 圖鑑   U 裝備與扭蛋   I 攝影知識   X 收工 / 選關   T 重上第零課
H 隱藏說明   N 讓鳥現在出現   B 讓鳥起飛   1-4 時段   5-6 天氣   （?dev=1：0 加代幣、7-9 換器材）`

/** 紙框觀景窗的 HTML 層。 */
export class Viewfinder {
  private root: HTMLElement
  private focal: HTMLElement
  private aperture: HTMLElement
  private shutter: HTMLElement
  private iso: HTMLElement
  private needle: HTMLElement
  private focusLabel: HTMLElement
  private help: HTMLElement
  private hint: HTMLElement
  private debug: HTMLElement
  private shots: HTMLElement
  private blackout: HTMLElement
  private flash: HTMLElement
  private coins: HTMLElement
  private toast: HTMLElement
  private timer: HTMLElement
  private quests: HTMLElement
  private afMode: HTMLElement
  private centerMark: HTMLElement
  private alertBar: HTMLElement

  constructor(container: HTMLElement) {
    this.root = container
    container.innerHTML = `
      <div class="frame"></div>
      <div class="center-mark"></div>
      <div class="readout tl"></div>
      <div class="readout tr"></div>
      <div class="readout bl"></div>
      <div class="readout br"></div>
      <div class="focus-scale"><div class="label"></div><div class="needle"></div></div>
      <div class="help"></div>
      <div class="hint hidden"></div>
      <div class="readout debug" style="top:70px;left:26px;font-size:16px;opacity:0.8"></div>
      <div class="shots"></div>
      <div class="blackout"></div>
      <div class="flash"></div>
      <div class="readout coins"></div>
      <div class="toast hidden"></div>
      <div class="readout timer"></div>
      <div class="quests hidden"></div>
      <div class="readout afmode"></div>
      <div class="alertbar hidden"><span class="who"></span>警戒<span class="track"><span class="fill"></span></span></div>
    `
    const q = (s: string) => container.querySelector(s) as HTMLElement
    this.focal = q('.tl')
    this.aperture = q('.tr')
    this.shutter = q('.bl')
    this.iso = q('.br')
    this.needle = q('.needle')
    this.focusLabel = q('.focus-scale .label')
    this.help = q('.help')
    this.hint = q('.hint')
    this.debug = q('.debug')
    this.shots = q('.shots')
    this.blackout = q('.blackout')
    this.flash = q('.flash')
    this.coins = q('.coins')
    this.toast = q('.toast')
    this.timer = q('.timer')
    this.quests = q('.quests')
    this.afMode = q('.afmode')
    this.alertBar = q('.alertbar')
    this.centerMark = q('.center-mark')
    this.help.textContent = HELP

    const scale = q('.focus-scale')
    for (const [t, label] of [[0, ''], [0.25, ''], [0.5, ''], [0.75, ''], [1, '∞']] as [number, string][]) {
      const tick = document.createElement('div')
      tick.className = 'tick'
      tick.style.left = `${8 + t * 300}px`
      tick.innerHTML = `<span>${label}</span>`
      scale.appendChild(tick)
    }
  }

  update(cam: CameraState, extra: HudExtra): void {
    const s = cam.settings
    const eq = Math.round(cam.equivalentFocalMm)
    this.focal.textContent = `${Math.round(cam.optics.focalMm)}mm${eq !== Math.round(cam.optics.focalMm) ? ` (等效 ${eq})` : ''}`
    const fn = cam.optics.fNumber
    this.aperture.textContent = `f/${fn < 10 ? fn.toFixed(1).replace(/\.0$/, '') : Math.round(fn)}`
    this.shutter.textContent = formatShutter(s.shutterS)
    this.iso.textContent = `ISO ${s.iso}`
    this.needle.style.left = `${8 + cam.focusT() * 300}px`
    this.focusLabel.textContent = s.focusM >= 150 ? '對焦 ∞' : `對焦 ${s.focusM < 10 ? s.focusM.toFixed(1) : Math.round(s.focusM)} m`
    this.root.classList.toggle('overview', extra.overview)
    this.help.classList.toggle('hidden', !extra.helpVisible)
    this.hint.classList.toggle('hidden', !extra.hint)
    this.hint.textContent = extra.hint
    this.shots.textContent = `剩 ${extra.cardLeft} 張 · 緩衝 ${extra.buffer}/${extra.bufferMax}`
    this.blackout.classList.toggle('on', extra.blackout)
    this.flash.classList.toggle('on', extra.flash)
    this.coins.textContent = `代幣 ${extra.coins}${extra.reduceShake ? ' · 減晃' : ''}`
    this.toast.classList.toggle('hidden', !extra.toast)
    this.toast.textContent = extra.toast
    if (extra.timerS === null) this.timer.style.display = 'none'
    else {
      this.timer.style.display = ''
      const m = Math.floor(extra.timerS / 60), sec = Math.floor(extra.timerS % 60)
      this.timer.textContent = `${m}:${sec.toString().padStart(2, '0')}`
      this.timer.classList.toggle('low', extra.timerS < 60)
    }
    this.afMode.textContent = extra.afLabel
    this.alertBar.classList.toggle('hidden', !extra.alert)
    if (extra.alert) {
      ;(this.alertBar.querySelector('.who') as HTMLElement).textContent = `${extra.alert.name} `
      ;(this.alertBar.querySelector('.fill') as HTMLElement).style.width = `${Math.round(extra.alert.value * 100)}%`
      this.alertBar.classList.toggle('wary', extra.alert.value >= 0.6)
    }
    this.centerMark.className = `center-mark af-${extra.afState}`
    this.quests.classList.toggle('hidden', extra.quests.length === 0)
    const qh = extra.quests.map((qq) => `<div class="${qq.done ? 'done' : ''}">${qq.done ? '✓' : '○'} ${qq.title}</div>`).join('')
    if (this.quests.innerHTML !== qh) this.quests.innerHTML = qh
    const o = extra.overStops
    this.debug.textContent = `場景 EV ${extra.evScene}  相機 ${o > 0 ? '+' : ''}${o.toFixed(1)} 格  ${extra.blurInfo}`
    this.debug.style.display = extra.helpVisible ? '' : 'none'
  }
}
