/** 以 requestAnimationFrame 驅動，dt 夾在 50ms 以內避免分頁切回來時跳太大。 */
export function startLoop(step: (dt: number, t: number) => void): () => void {
  let last = performance.now()
  let id = 0
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    step(dt, now / 1000)
    id = requestAnimationFrame(tick)
  }
  id = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(id)
}
