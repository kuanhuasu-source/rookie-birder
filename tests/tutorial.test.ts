import { describe, it, expect } from 'vitest'
import { TutorialRunner, STUCK_AFTER_S } from '../src/tutorial/runner'
import { STEPS } from '../src/tutorial/steps'
import type { TutorialCtx } from '../src/tutorial/types'
import type { PhotoRecord } from '../src/photo/types'

function makeCtx(): TutorialCtx & { log: string[] } {
  const log: string[] = []
  const ctx: TutorialCtx & { log: string[] } = {
    log,
    settings: { focalMm: 250, fNumber: 5.6, shutterS: 1 / 500, iso: 200, focusM: 10 },
    overview: false,
    metrics: { birdInFrame: true, cocPx: 8, birdHeightFrac: 0.3, overStops: 0, eyeX: 0.66, eyeY: 0.66 },
    photos: [], albumOpened: false, birdState: 'S1', birdInScene: true, elapsed: 0,
    setFocal: (mm) => { ctx.settings.focalMm = mm; log.push(`focal ${mm}`) },
    setFocus: (m) => { ctx.settings.focusM = m },
    setExposure: (f, t, i) => { if (f) ctx.settings.fNumber = f; if (t) ctx.settings.shutterS = t; if (i) ctx.settings.iso = i },
    setLighting: (t, w) => log.push(`light ${t} ${w}`),
    aimOffset: () => log.push('aim'),
    birdPlace: () => log.push('place'),
    birdScript: (s) => log.push(`script ${s}`),
    birdTakeoff: () => { log.push('takeoff'); ctx.birdInScene = false },
    birdReenter: () => { log.push('reenter'); ctx.birdInScene = true },
    giveCoins: (n) => log.push(`coins ${n}`),
  }
  return ctx
}

function photo(over: Partial<PhotoRecord['metrics']>, shutterS = 1 / 500, detail: Record<string, number> = {}): PhotoRecord {
  return {
    id: 'p', takenAt: 0, width: 1920, height: 1280,
    settings: { focalMm: 250, fNumber: 5.6, shutterS, iso: 200, focusM: 12 },
    gear: { lens: 'L1', body: 'B1', support: 'S0' }, lighting: { time: 'morning', weather: 'sunny', evScene: 13 },
    metrics: { birdInFrame: true, distM: 12, cocPx: 0.3, motionPx: 0.5, shakePx: 0.3, softPx: 0.2, totalBlurPx: 0.7, overStops: 0, noiseSigma: 0.01, eyeX: 0.66, eyeY: 0.66, birdHeightFrac: 0.3, birdState: 'S1', ...over },
    score: { focus: 30, exposure: 25, composition: 25, moment: 8, total: 88, stars: 5, advice: '', caps: [], detail },
    blob: new Blob(), thumb: new Blob(),
  }
}

describe('TutorialRunner', () => {
  it('runs setup of the first step on start and gates controls', () => {
    const r = new TutorialRunner(STEPS)
    const c = makeCtx()
    r.start(c)
    expect(r.step?.id).toBe('find')
    expect(c.log).toContain('place')
    expect(r.allowed('overview')).toBe(true)
    expect(r.allowed('zoom')).toBe(false)
  })
  it('walks the whole lesson when each condition is met', () => {
    const r = new TutorialRunner(STEPS)
    const c = makeCtx()
    let finished = false
    r.onFinished = () => { finished = true }
    r.start(c)
    const tick = (n: number) => { for (let i = 0; i < n; i++) r.update(1 / 30, c) }
    // find：鳥在畫面內 → 完成並停留
    tick(40); expect(r.step?.id).toBe('zoom')
    c.metrics!.birdHeightFrac = 0.3; tick(40); expect(r.step?.id).toBe('focus')
    c.metrics!.cocPx = 1; tick(40); expect(r.step?.id).toBe('bright')
    c.metrics!.overStops = 0.2; tick(45); expect(r.step?.id).toBe('dark')
    tick(45); expect(r.step?.id).toBe('steady')
    r.notePhoto(photo({ shakePx: 1 })); tick(50); expect(r.step?.id).toBe('moving')
    r.notePhoto(photo({ motionPx: 1 }, 1 / 500)); tick(50); expect(r.step?.id).toBe('compose')
    r.notePhoto(photo({}, 1 / 500, { thirds: 0.8, lead: 0.9 })); tick(50); expect(r.step?.id).toBe('score')
    r.noteAlbumOpen(); tick(30); expect(r.step?.id).toBe('takeoff')
    // 起飛腳本：3 秒後呼叫 takeoff，7.5 秒後 reenter
    tick(30 * 4); expect(c.log).toContain('takeoff')
    tick(30 * 4); expect(c.log).toContain('reenter')
    r.notePhoto(photo({ birdState: 'S4' })); tick(60); expect(r.step?.id).toBe('done')
    expect(c.log).toContain('coins 30')
    tick(30 * 7)
    expect(finished).toBe(true)
    expect(r.active).toBe(false)
  })
  it('reports stuck after the timeout', () => {
    const r = new TutorialRunner(STEPS)
    const c = makeCtx()
    c.metrics!.birdInFrame = false
    r.start(c)
    for (let i = 0; i < 30 * (STUCK_AFTER_S + 1); i++) r.update(1 / 30, c)
    expect(r.stuck).toBe(true)
    expect(r.step?.id).toBe('find')
  })
})
