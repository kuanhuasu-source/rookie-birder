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
  it('chapter 3 wetland quests check distance, hover, backlight and settings', () => {
    const noon = LEVELS.find((l) => l.id === 'wetland-noon')!
    const dusk = LEVELS.find((l) => l.id === 'wetland-dusk')!
    expect(noon.sceneId).toBe('wetland')
    expect(dusk.sunAzDeg).toBe(350)
    const [heron, stilt, kite] = noon.quests
    expect(heron.check(photo({ species: 'night-heron', birdState: 'S1' }, { stars: 3 }))).toBe(true)
    expect(heron.check(photo({ species: 'night-heron', birdState: 'S1' }, { stars: 2 }))).toBe(false)
    expect(stilt.check(photo({ species: 'black-winged-stilt', birdState: 'S3' }, { stars: 2 }))).toBe(true)
    expect(stilt.check(photo({ species: 'black-winged-stilt', birdState: 'S1' }, { stars: 2 }))).toBe(false)
    expect(kite.check(photo({ species: 'black-winged-kite', birdState: 'S5' }, { stars: 2 }))).toBe(true)
    const [silhouette, fastKite, lowIso] = dusk.quests
    expect(silhouette.check(photo({ lightAngleDeg: 150 }, { composition: 19 }))).toBe(true)
    expect(silhouette.check(photo({ lightAngleDeg: 40 }, { composition: 19 }))).toBe(false)
    expect(fastKite.check(photo({ species: 'black-winged-kite' }, { stars: 3 }, { shutterS: 1 / 2000 }))).toBe(true)
    expect(fastKite.check(photo({ species: 'black-winged-kite' }, { stars: 3 }, { shutterS: 1 / 1000 }))).toBe(false)
    expect(lowIso.check(photo({}, { stars: 3 }, { iso: 1600 }))).toBe(true)
    expect(lowIso.check(photo({}, { stars: 3 }, { iso: 3200 }))).toBe(false)
  })
  it('chapter 4 field quests check occlusion, see-through foreground and background separation', () => {
    const morning = LEVELS.find((l) => l.id === 'field-morning')!
    const dusk = LEVELS.find((l) => l.id === 'field-dusk')!
    expect(morning.sceneId).toBe('field')
    const stats = (occlusion: number, rawOcclusion: number, bgSep: number) => ({ occlusion, rawOcclusion, bgSep, subjectMean: 0.3, clippedFrac: 0, crushedFrac: 0, bgVariance: 0.01 })
    const [prinia, munia, shrike] = morning.quests
    expect(prinia.check(photo({ species: 'plain-prinia', stats: stats(0.05, 0.05, 1) }, { stars: 3 }))).toBe(true)
    expect(prinia.check(photo({ species: 'plain-prinia', stats: stats(0.3, 0.3, 1) }, { stars: 3 }))).toBe(false)
    expect(munia.check(photo({ species: 'scaly-breasted-munia', stats: stats(0, 0, 0.9) }, {}, { fNumber: 5.6 }))).toBe(true)
    expect(munia.check(photo({ species: 'scaly-breasted-munia', stats: stats(0, 0, 0.9) }, {}, { fNumber: 8 }))).toBe(false)
    expect(munia.check(photo({ species: 'scaly-breasted-munia', stats: stats(0, 0, 0.5) }, {}, { fNumber: 5.6 }))).toBe(false)
    expect(shrike.check(photo({ species: 'long-tailed-shrike' }, { composition: 17 }))).toBe(true)
    const [through, cisticola, iso] = dusk.quests
    expect(through.check(photo({ stats: stats(0.08, 0.5, 1) }, { stars: 3 }))).toBe(true)
    expect(through.check(photo({ stats: stats(0.08, 0.1, 1) }, { stars: 3 }))).toBe(false)
    expect(through.check(photo({ stats: stats(0.3, 0.5, 1) }, { stars: 3 }))).toBe(false)
    expect(cisticola.check(photo({ species: 'golden-headed-cisticola', birdState: 'S2' }, { stars: 2 }))).toBe(true)
    expect(iso.check(photo({}, { stars: 4 }, { iso: 3200 }))).toBe(true)
    expect(iso.check(photo({}, { stars: 3 }, { iso: 3200 }))).toBe(false)
  })
  it('chapter 5 forest quests check sun spots, high ISO and the rare pitta', () => {
    const morning = LEVELS.find((l) => l.id === 'forest-morning')!
    const dusk = LEVELS.find((l) => l.id === 'forest-dusk')!
    expect(morning.shadeEv).toBe(9)
    expect(dusk.shadeEv).toBeLessThan(morning.shadeEv!)
    const [barbet, spot, iso] = morning.quests
    expect(barbet.check(photo({ species: 'taiwan-barbet', birdState: 'S1' }, { stars: 3 }))).toBe(true)
    expect(spot.check(photo({ sunlit: true }, { exposure: 21 }))).toBe(true)
    expect(spot.check(photo({ sunlit: false }, { exposure: 21 }))).toBe(false)
    expect(spot.check(photo({ sunlit: true }, { exposure: 15 }))).toBe(false)
    expect(iso.check(photo({}, { stars: 3 }, { iso: 6400 }))).toBe(true)
    expect(iso.check(photo({}, { stars: 3 }, { iso: 3200 }))).toBe(false)
    const [magpie, monarch, pitta] = dusk.quests
    expect(magpie.check(photo({ species: 'taiwan-blue-magpie' }, { stars: 3 }))).toBe(true)
    expect(monarch.check(photo({ species: 'black-naped-monarch', birdState: 'S3' }, { stars: 2 }))).toBe(true)
    expect(pitta.check(photo({ species: 'fairy-pitta' }, { stars: 1 }))).toBe(true)
    expect(pitta.reward).toBe(60)
  })
  it('shade lighting keeps the scene EV it is given and uses mostly ambient light', async () => {
    const { lightingPreset } = await import('../src/world/lighting')
    const shade = lightingPreset('morning', 'sunny', { shadeEv: 9 })
    expect(shade.evScene).toBe(9)
    expect(shade.sunIntensity).toBeLessThan(1)
    expect(shade.hemiIntensity).toBeGreaterThan(2)
    expect(lightingPreset('morning', 'sunny').evScene).toBe(13)
  })
  it('the hidden rail level sits last, unlocks after the forest, and its quests target the train', () => {
    const rail = LEVELS[LEVELS.length - 1]
    expect(rail.id).toBe('rail-dusk')
    expect(rail.hidden).toBe(true)
    // 測試期間預設打開：不需要林地的任務
    const done = new Set<string>()
    expect(isLevelUnlocked(rail, done)).toBe(true)
    expect(rail.alwaysUnlocked).toBe(true)
    const [first, lead, freeze] = rail.quests
    expect(first.check(photo({ species: 'local-train', birdState: 'S5' }, { stars: 3 }))).toBe(true)
    expect(first.check(photo({ species: 'spotted-dove', birdState: 'S5' }, { stars: 3 }))).toBe(false)
    expect(lead.check(photo({ species: 'local-train' }, { composition: 20 }))).toBe(true)
    expect(freeze.check(photo({ species: 'local-train' }, { focus: 27 }, { shutterS: 1 / 2000 }))).toBe(true)
    expect(freeze.check(photo({ species: 'local-train' }, { focus: 27 }, { shutterS: 1 / 1000 }))).toBe(false)
  })
  it('a level can override the sun azimuth to put the sun in front of the camera', async () => {
    const { lightingPreset } = await import('../src/world/lighting')
    const def = lightingPreset('dusk', 'sunny')
    const back = lightingPreset('dusk', 'sunny', 350)
    expect(back.sunDir.z).toBeLessThan(-0.9)
    expect(def.sunDir.z).toBeGreaterThan(back.sunDir.z)
    expect(back.evScene).toBe(def.evScene)
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
