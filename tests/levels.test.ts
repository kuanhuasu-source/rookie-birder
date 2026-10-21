import { describe, it, expect } from 'vitest'
import { LEVELS, isLevelUnlocked } from '../src/levels/data'
import { LevelSession } from '../src/levels/session'
import type { PhotoRecord } from '../src/photo/types'

function photo(over: Partial<PhotoRecord['metrics']> = {}, score: Partial<PhotoRecord['score']> = {}, settings: Partial<PhotoRecord['settings']> = {}): PhotoRecord {
  return {
    id: 'p' + Math.random(), takenAt: 1, width: 1920, height: 1280,
    settings: { focalMm: 250, fNumber: 5.6, shutterS: 1 / 500, iso: 200, focusM: 12, ...settings },
    gear: { lens: 'L1', body: 'B1', support: 'S0' }, lighting: { time: 'morning', weather: 'sunny', evScene: 13 },
    metrics: { birdInFrame: true, distM: 12, cocPx: 0, motionPx: 0, shakePx: 0, softPx: 0, totalBlurPx: 0, overStops: 0, noiseSigma: 0, eyeX: 0.6, eyeY: 0.6, birdHeightFrac: 0.3, species: 'light-vented-bulbul', birdState: 'S1', lightAngleDeg: 40, ...over },
    score: { focus: 30, exposure: 22, composition: 22, moment: 8, total: 82, stars: 4, advice: '', caps: [], detail: { bgSep: 1 }, ...score },
    blob: new Blob(), thumb: new Blob(),
  }
}

describe('levels', () => {
  it('first level is unlocked, second needs a quest from the first', () => {
    const done = new Set<string>()
    expect(isLevelUnlocked(LEVELS[0], done)).toBe(true)
    expect(isLevelUnlocked(LEVELS[1], done)).toBe(false)
    done.add(LEVELS[0].quests[0].id)
    expect(isLevelUnlocked(LEVELS[1], done)).toBe(true)
    expect(isLevelUnlocked(LEVELS[2], done)).toBe(false)
  })
  it('quests of the first level check the intended concepts', () => {
    const [bulbul, freeze, compose] = LEVELS[0].quests
    expect(bulbul.check(photo())).toBe(true)
    expect(bulbul.check(photo({ species: 'tree-sparrow' }))).toBe(false)
    expect(bulbul.check(photo({}, { stars: 2 }))).toBe(false)
    expect(freeze.check(photo({ birdState: 'S4' }, {}, { shutterS: 1 / 2000 }))).toBe(true)
    expect(freeze.check(photo({ birdState: 'S4' }, {}, { shutterS: 1 / 500 }))).toBe(false)
    expect(compose.check(photo({}, { composition: 19 }))).toBe(false)
    expect(compose.check(photo({}, { composition: 21 }))).toBe(true)
  })
  it('session counts photos, coins, best photo and completes quests once', () => {
    const done = new Set<string>()
    const s = new LevelSession(LEVELS[0], done)
    const fresh = s.onPhoto(photo(), 10)
    expect(fresh.map((q) => q.id)).toEqual(['p1-bulbul', 'p1-compose'])
    expect(s.coins).toBe(10 + 20 + 20)
    expect(s.onPhoto(photo(), 10)).toEqual([])
    expect(s.photos).toBe(2)
    expect(s.bestStars).toBe(4)
    s.update(500)
    expect(s.timeUp).toBe(true)
    const sum = s.end()
    expect(sum.questsCompleted.length).toBe(2)
    expect(sum.coins).toBe(60)
  })
})
