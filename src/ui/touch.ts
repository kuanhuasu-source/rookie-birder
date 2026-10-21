/**
 * 觸控裝置的螢幕按鈕，放在 3:2 觀景窗兩側的空白欄：
 * 左欄：放下相機、相簿、穩住、選單；右欄：快門（長按連拍）與光圈 / 快門 / ISO 的加減排。
 * 觀景窗底部的對焦刻度可以拖。所有操作都轉成與鍵盤相同的回呼，遊戲邏輯不用分裝置。
 */
export interface TouchHandlers {
  onKey: (code: string) => void
  onShutter: (down: boolean) => void
  onBrace: (down: boolean) => void
  onFocusT: (t: number) => void
}

export const TOUCH_COLUMN_PX = 96

export class TouchControls {
  private root: HTMLElement
  private overviewBtn: HTMLElement

  constructor(hud: HTMLElement, h: TouchHandlers) {
    document.body.classList.add('touch')
    this.root = document.createElement('div')
    this.root.id = 'touch'
    this.root.innerHTML = `
      <div class="tcol tcol-left">
        <button class="tbtn tb-overview" data-key="Tab">放下<br>相機</button>
        <button class="tbtn tb-album" data-key="KeyG">相簿</button>
        <button class="tbtn tb-brace">穩住</button>
        <button class="tbtn tb-menu">⋯</button>
      </div>
      <div class="tcol tcol-right">
        <button class="tshutter" aria-label="快門"></button>
        <div class="trow trow-aperture"><span>光圈</span><button data-key="KeyQ">−</button><button data-key="KeyE">+</button></div>
        <div class="trow trow-shutter"><span>快門</span><button data-key="KeyA">−</button><button data-key="KeyD">+</button></div>
        <div class="trow trow-iso"><span>ISO</span><button data-key="KeyZ">−</button><button data-key="KeyC">+</button></div>
      </div>
      <div class="tmenu hidden">
        <button data-key="KeyX">收工 / 選關</button>
        <button data-key="KeyK">賞鳥圖鑑</button>
        <button data-key="KeyU">裝備與扭蛋</button>
        <button data-key="KeyV">減少畫面晃動</button>
        <button data-key="KeyT">重上第零課</button>
        <button data-key="KeyH">顯示 / 隱藏數據</button>
        <button class="tmenu-close">關閉</button>
      </div>
    `
    document.body.appendChild(this.root)
    const q = (s: string) => this.root.querySelector(s) as HTMLElement

    const capture = (el: HTMLElement, e: PointerEvent) => { try { el.setPointerCapture(e.pointerId) } catch { /* 合成事件沒有真正的指標 */ } }
    const press = (el: HTMLElement, down: () => void, up: () => void) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(el, e); down() })
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
    }
    press(q('.tshutter'), () => h.onShutter(true), () => h.onShutter(false))
    const brace = q('.tb-brace')
    press(brace, () => { h.onBrace(true); brace.classList.add('on') }, () => { h.onBrace(false); brace.classList.remove('on') })
    this.overviewBtn = q('.tb-overview')

    for (const b of this.root.querySelectorAll<HTMLElement>('.tcol-left [data-key], .tmenu [data-key]')) {
      b.addEventListener('click', () => h.onKey(b.dataset.key!))
    }
    // 加減鈕：按住會連續
    for (const b of this.root.querySelectorAll<HTMLElement>('.trow button')) {
      let timer = 0
      const fire = () => h.onKey(b.dataset.key!)
      const stop = () => { clearInterval(timer); timer = 0 }
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); fire(); timer = window.setInterval(fire, 160) })
      b.addEventListener('pointerup', stop)
      b.addEventListener('pointercancel', stop)
    }
    const menu = q('.tmenu')
    q('.tb-menu').addEventListener('click', () => menu.classList.toggle('hidden'))
    q('.tmenu-close').addEventListener('click', () => menu.classList.add('hidden'))

    // 對焦刻度可拖
    const scale = hud.querySelector('.focus-scale') as HTMLElement
    const setFromEvent = (e: PointerEvent) => {
      const rect = scale.getBoundingClientRect()
      h.onFocusT((e.clientX - rect.left - 8) / (rect.width - 16))
    }
    scale.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(scale, e); setFromEvent(e) })
    scale.addEventListener('pointermove', (e) => { if (e.buttons) setFromEvent(e) })
  }

  /** 全景按鈕的文字跟著狀態換。 */
  setOverview(on: boolean): void {
    this.overviewBtn.innerHTML = on ? '舉起<br>相機' : '放下<br>相機'
  }
}
