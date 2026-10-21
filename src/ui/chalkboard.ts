import type { TutorialRunner } from '../tutorial/runner'
import type { Overlay } from '../tutorial/types'

/** 黑板提示與粉筆輔助線，只在教學時出現。 */
export class Chalkboard {
  private board: HTMLElement
  private title: HTMLElement
  private lines: HTMLElement
  private stuck: HTMLElement
  private overlays: Record<Overlay, HTMLElement>
  private lead: HTMLElement

  constructor(container: HTMLElement) {
    const wrap = document.createElement('div')
    wrap.className = 'chalk-wrap'
    wrap.innerHTML = `
      <div class="chalkboard hidden">
        <div class="chalk-title"></div>
        <div class="chalk-lines"></div>
        <div class="chalk-stuck hidden"></div>
        <div class="chalk-skip">Esc 跳過教學</div>
      </div>
      <div class="ov ov-focus hidden"></div>
      <div class="ov ov-thirds hidden"><i></i><i></i><i></i><i></i></div>
      <div class="ov ov-lead hidden">➜</div>
      <div class="ov ov-triangle hidden">
        <svg viewBox="0 0 200 180"><polygon points="100,15 185,165 15,165"/></svg>
        <span class="tri-a">光圈</span><span class="tri-s">快門</span><span class="tri-i">ISO</span>
      </div>
    `
    container.appendChild(wrap)
    const q = (s: string) => wrap.querySelector(s) as HTMLElement
    this.board = q('.chalkboard')
    this.title = q('.chalk-title')
    this.lines = q('.chalk-lines')
    this.stuck = q('.chalk-stuck')
    this.lead = q('.ov-lead')
    this.overlays = { focusPoint: q('.ov-focus'), thirds: q('.ov-thirds'), leadArrow: q('.ov-lead'), triangle: q('.ov-triangle') }
  }

  update(runner: TutorialRunner, eye: { x: number; y: number; facing: number; visible: boolean }, active: { aperture: boolean; shutter: boolean; iso: boolean }): void {
    const s = runner.step
    this.board.classList.toggle('hidden', !s)
    for (const k of Object.keys(this.overlays) as Overlay[]) this.overlays[k].classList.toggle('hidden', !s || !s.overlays.includes(k))
    if (!s) return
    this.title.textContent = `第零課 · 第 ${runner.index + 1} / ${runner.total} 頁 · ${s.title}${runner.completing ? '  ✓' : ''}`
    this.lines.innerHTML = s.hint.filter(Boolean).map((h) => `<div>${h}</div>`).join('')
    this.stuck.classList.toggle('hidden', !(runner.stuck && s.stuckHint))
    this.stuck.textContent = s.stuckHint ?? ''
    if (s.overlays.includes('leadArrow')) {
      this.lead.style.display = eye.visible ? '' : 'none'
      this.lead.style.left = `${eye.x * 100}%`
      this.lead.style.top = `${(1 - eye.y) * 100}%`
      this.lead.style.transform = `translate(-50%, -50%) scaleX(${eye.facing}) translateX(60px)`
    }
    if (s.overlays.includes('triangle')) {
      this.overlays.triangle.querySelector('.tri-a')!.classList.toggle('on', active.aperture)
      this.overlays.triangle.querySelector('.tri-s')!.classList.toggle('on', active.shutter)
      this.overlays.triangle.querySelector('.tri-i')!.classList.toggle('on', active.iso)
    }
  }
}
