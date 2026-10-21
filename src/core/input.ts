export interface InputHandlers {
  onLook: (dx: number, dy: number) => void
  onFocusRing: (delta: number) => void
  onZoom: (steps: number) => void
  onKey: (code: string) => void
  onShutter: (down: boolean) => void
  onHalfPress: (down: boolean) => void
}

/** 是否為觸控為主的裝置（手機、平板）。 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
}

/**
 * 滑鼠：鎖定後移動轉雲台、滾輪變焦、左鍵快門；對焦環有右鍵拖曳、Ctrl 加移動、Shift 加滾輪、W / S 與方向鍵。
 * 觸控：單指拖曳轉雲台、雙指捏合變焦；快門與其他操作在螢幕按鈕（ui/touch.ts）。
 */
export class Input {
  locked = false
  readonly touch: boolean
  /** 目前按住的鍵，給需要持續作用的操作（對焦環）用 */
  readonly held = new Set<string>()
  private pointers = new Map<number, { x: number; y: number }>()
  private pinchDist = 0

  constructor(canvas: HTMLCanvasElement, private h: InputHandlers) {
    this.touch = isTouchDevice()
    canvas.addEventListener('click', () => {
      if (!this.touch && !this.locked) canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      if (!this.locked) this.held.clear()
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // 滑鼠
    canvas.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      const focusing = (e.buttons & 2) !== 0 || e.ctrlKey
      if (focusing) this.h.onFocusRing(e.movementX * 0.0015)
      else this.h.onLook(e.movementX, e.movementY)
    })
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return
      if (e.button === 0 && !e.ctrlKey) this.h.onShutter(true)
    })
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.h.onShutter(false)
    })
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (e.shiftKey || horizontal) {
        const d = horizontal ? e.deltaX : e.deltaY
        this.h.onFocusRing(Math.sign(d) * Math.min(1, Math.abs(d) / 50) * 0.02)
      } else {
        this.h.onZoom(-Math.sign(e.deltaY) * 3)
      }
    }, { passive: false })

    // 觸控：Pointer Events
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try { canvas.setPointerCapture(e.pointerId) } catch { /* 合成事件沒有真正的指標 */ }
      if (this.pointers.size === 2) this.pinchDist = this.distance()
    })
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') return
      const prev = this.pointers.get(e.pointerId)
      if (!prev) return
      const cur = { x: e.clientX, y: e.clientY }
      if (this.pointers.size === 1) {
        this.h.onLook((cur.x - prev.x) * 1.2, (cur.y - prev.y) * 1.2)
      }
      this.pointers.set(e.pointerId, cur)
      if (this.pointers.size === 2) {
        const d = this.distance()
        if (this.pinchDist > 0 && d > 0) {
          const steps = Math.log(d / this.pinchDist) / Math.log(1.04)
          if (Math.abs(steps) >= 0.25) { this.h.onZoom(steps); this.pinchDist = d }
        }
      }
    })
    const end = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      this.pointers.delete(e.pointerId)
      this.pinchDist = this.pointers.size === 2 ? this.distance() : 0
    }
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)

    // 鍵盤
    window.addEventListener('keydown', (e) => {
      this.held.add(e.code)
      if (e.code === 'Tab') e.preventDefault()
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.h.onHalfPress(true); return }
      const repeatable = ['KeyQ', 'KeyE', 'KeyA', 'KeyD', 'KeyZ', 'KeyC']
      if (e.repeat && !repeatable.includes(e.code)) return
      this.h.onKey(e.code)
    })
    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code)
      if (e.code === 'Space') this.h.onHalfPress(false)
    })
    window.addEventListener('blur', () => this.held.clear())
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  /** 對焦環的鍵盤方向：W / → / ↑ 對遠，S / ← / ↓ 對近。 */
  focusKeyDir(): number {
    const far = this.held.has('KeyW') || this.held.has('ArrowRight') || this.held.has('ArrowUp') ? 1 : 0
    const near = this.held.has('KeyS') || this.held.has('ArrowLeft') || this.held.has('ArrowDown') ? 1 : 0
    return far - near
  }
}
