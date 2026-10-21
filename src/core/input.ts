export interface InputHandlers {
  onLook: (dx: number, dy: number) => void
  onFocusRing: (delta: number) => void
  onZoom: (steps: number) => void
  onKey: (code: string) => void
  onShutter: (down: boolean) => void
  onHalfPress: (down: boolean) => void
}

/** 滑鼠鎖定後：移動轉雲台、右鍵拖曳對焦、滾輪變焦、左鍵快門。 */
export class Input {
  locked = false
  private rightDown = false

  constructor(canvas: HTMLCanvasElement, private h: InputHandlers) {
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      if (this.rightDown) this.h.onFocusRing(e.movementX * 0.0015)
      else this.h.onLook(e.movementX, e.movementY)
    })
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return
      if (e.button === 2) this.rightDown = true
      if (e.button === 0) this.h.onShutter(true)
    })
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightDown = false
      if (e.button === 0) this.h.onShutter(false)
    })
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.h.onZoom(-Math.sign(e.deltaY) * 3)
    }, { passive: false })
    window.addEventListener('keydown', (e) => {
      if (e.repeat && e.code !== 'KeyQ' && e.code !== 'KeyE' && e.code !== 'KeyA' && e.code !== 'KeyD' && e.code !== 'KeyZ' && e.code !== 'KeyC') return
      if (e.code === 'Tab') e.preventDefault()
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.h.onHalfPress(true); return }
      this.h.onKey(e.code)
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.h.onHalfPress(false)
    })
  }
}
