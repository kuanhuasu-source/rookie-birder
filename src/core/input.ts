export interface InputHandlers {
  onLook: (dx: number, dy: number) => void
  onFocusRing: (delta: number) => void
  onZoom: (steps: number) => void
  onKey: (code: string) => void
  onShutter: (down: boolean) => void
  onHalfPress: (down: boolean) => void
}

/**
 * 滑鼠鎖定後：移動轉雲台、滾輪變焦、左鍵快門。
 * 對焦環有四種方式，照顧 Mac 觸控板：右鍵拖曳、Ctrl 加移動、Shift 加滾輪（或橫向滾動）、W / S 與方向鍵。
 */
export class Input {
  locked = false
  /** 目前按住的鍵，給需要持續作用的操作（對焦環）用 */
  readonly held = new Set<string>()

  constructor(canvas: HTMLCanvasElement, private h: InputHandlers) {
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      if (!this.locked) this.held.clear()
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
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

  /** 對焦環的鍵盤方向：W / → / ↑ 對遠，S / ← / ↓ 對近。 */
  focusKeyDir(): number {
    const far = this.held.has('KeyW') || this.held.has('ArrowRight') || this.held.has('ArrowUp') ? 1 : 0
    const near = this.held.has('KeyS') || this.held.has('ArrowLeft') || this.held.has('ArrowDown') ? 1 : 0
    return far - near
  }
}
