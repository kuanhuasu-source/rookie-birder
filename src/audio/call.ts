import type { SpeciesDef } from '../birds/types'

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 使用者有互動後呼叫，讓之後的鳴叫能發聲。 */
export function unlockAudio(): void { context() }

/** 程序化的「咕—咕—咕」：正弦加顫音，略帶下滑。 */
export function playCall(species: SpeciesDef): void {
  const ac = context()
  if (!ac || ac.state !== 'running') return
  const c = species.call
  const t0 = ac.currentTime + 0.05
  const master = ac.createGain()
  master.gain.value = 0.18
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  master.connect(lp).connect(ac.destination)
  for (let i = 0; i < c.notes; i++) {
    const start = t0 + i * (c.noteS + c.gapS)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    const f = c.baseHz * (i === c.notes - 1 ? 0.9 : 1)
    osc.frequency.setValueAtTime(f * 1.08, start)
    osc.frequency.exponentialRampToValueAtTime(f, start + c.noteS)
    const vib = ac.createOscillator()
    vib.frequency.value = 28
    const vibGain = ac.createGain()
    vibGain.gain.value = 9
    vib.connect(vibGain).connect(osc.frequency)
    const env = ac.createGain()
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(1, start + 0.04)
    env.gain.setValueAtTime(1, start + c.noteS - 0.08)
    env.gain.linearRampToValueAtTime(0, start + c.noteS)
    osc.connect(env).connect(master)
    osc.start(start); vib.start(start)
    osc.stop(start + c.noteS + 0.02); vib.stop(start + c.noteS + 0.02)
  }
}
