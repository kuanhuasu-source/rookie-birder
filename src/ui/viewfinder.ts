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
}

const HELP = `滑鼠 轉雲台   滾輪 變焦   對焦環：W/S 或方向鍵、Shift+滾輪、右鍵拖曳
Q/E 光圈   A/D 快門   Z/C ISO   Tab 放下相機看全景
Shift 穩住（手震減半、雲台變慢）   V 減少畫面晃動（不影響照片）
左鍵 快門（按住連拍）   G 相簿   T 重上第零課
H 隱藏說明   N 讓鳥現在出現   B 讓鳥起飛   1-4 時段   5-6 天氣   7-9 換器材`

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
    this.focal.textContent = `${Math.round(s.focalMm)}mm`
    this.aperture.textContent = `f/${s.fNumber < 10 ? s.fNumber.toFixed(1).replace(/\.0$/, '') : Math.round(s.fNumber)}`
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
    const o = extra.overStops
    this.debug.textContent = `場景 EV ${extra.evScene}  相機 ${o > 0 ? '+' : ''}${o.toFixed(1)} 格  ${extra.blurInfo}`
    this.debug.style.display = extra.helpVisible ? '' : 'none'
  }
}
