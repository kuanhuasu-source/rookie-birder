import { describe, it, expect } from 'vitest'
import { defaultSave } from '../src/progress/save'
import { updateGuide, slotForState, guideCompletion, BONUS_NEW_SPECIES, BONUS_NEW_SLOT } from '../src/progress/guide'
import { pull, pool, PULL_COST, PITY_RARE_AT } from '../src/progress/gacha'
import type { PhotoRecord } from '../src/photo/types'

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function photo(id: string, species: string, state: string, stars: number, total: number): PhotoRecord {
  return {
    id, takenAt: 1, width: 1920, height: 1280,
    settings: { focalMm: 250, fNumber: 5.6, shutterS: 1 / 500, iso: 200, focusM: 12 },
    gear: { lens: 'L1', body: 'B1', support: 'S0' }, lighting: { time: 'morning', weather: 'sunny', evScene: 13 },
    metrics: { birdInFrame: true, distM: 12, cocPx: 0, motionPx: 0, shakePx: 0, softPx: 0, totalBlurPx: 0, overStops: 0, noiseSigma: 0, eyeX: 0.6, eyeY: 0.6, birdHeightFrac: 0.3, species, birdState: state },
    score: { focus: 30, exposure: 25, composition: 20, moment: 10, total, stars, advice: '', caps: [], detail: {} },
    blob: new Blob(), thumb: new Blob(),
  }
}

describe('guide', () => {
  it('maps states to slots', () => {
    expect(slotForState('S1')).toBe('perched')
    expect(slotForState('S2')).toBe('action')
    expect(slotForState('S3')).toBe('action')
    expect(slotForState('S4')).toBe('takeoff')
    expect(slotForState('S5')).toBe('flight')
    expect(slotForState(undefined)).toBeNull()
  })
  it('first photo of a species fills a slot and pays both bonuses', () => {
    const s = defaultSave()
    const u = updateGuide(s, photo('a', 'tree-sparrow', 'S1', 3, 60))!
    expect(u.newSpecies && u.newSlot).toBe(true)
    expect(s.coins).toBe(BONUS_NEW_SPECIES + BONUS_NEW_SLOT)
    expect(s.guide['tree-sparrow'].perched?.photoId).toBe('a')
  })
  it('only a better photo replaces the slot; worse keeps the old one', () => {
    const s = defaultSave()
    updateGuide(s, photo('a', 'tree-sparrow', 'S1', 3, 60))
    const worse = updateGuide(s, photo('b', 'tree-sparrow', 'S1', 2, 45))!
    expect(worse.improved).toBe(false)
    expect(s.guide['tree-sparrow'].perched?.photoId).toBe('a')
    const better = updateGuide(s, photo('c', 'tree-sparrow', 'S1', 4, 75))!
    expect(better.improved).toBe(true)
    expect(better.bonus).toBe(0)
    expect(s.guide['tree-sparrow'].perched?.photoId).toBe('c')
  })
  it('ignores one-star photos and photos without a bird', () => {
    const s = defaultSave()
    expect(updateGuide(s, photo('a', 'tree-sparrow', 'S1', 1, 30))).toBeNull()
    const p = photo('b', 'tree-sparrow', 'S1', 3, 60); p.metrics.birdInFrame = false
    expect(updateGuide(s, p)).toBeNull()
  })
  it('completion counts filled slots', () => {
    const s = defaultSave()
    updateGuide(s, photo('a', 'tree-sparrow', 'S1', 3, 60))
    updateGuide(s, photo('b', 'tree-sparrow', 'S4', 3, 60))
    expect(guideCompletion(s, ['tree-sparrow', 'spotted-dove'])).toEqual({ filled: 2, total: 8 })
  })
})

describe('gacha', () => {
  it('pool excludes starting gear', () => {
    const ids = pool().map((i) => i.id)
    expect(ids).not.toContain('L1')
    expect(ids).not.toContain('B1')
    expect(ids).not.toContain('S0')
    expect(ids).toContain('L5')
    expect(ids).toContain('A1')
  })
  it('refuses without coins and charges the cost', () => {
    const s = defaultSave()
    expect(pull(s, seeded(1))).toBeNull()
    s.coins = PULL_COST
    const r = pull(s, seeded(1))
    expect(r).not.toBeNull()
    expect(s.coins).toBeGreaterThanOrEqual(0)
  })
  it('new items are owned, duplicates refund coins', () => {
    const s = defaultSave()
    s.coins = 100000
    const rng = seeded(5)
    let dup = 0, fresh = 0
    for (let i = 0; i < 200; i++) { const r = pull(s, rng)!; if (r.isNew) fresh++; else { dup++; expect(r.refund).toBeGreaterThan(0) } }
    expect(fresh).toBe(pool().length)
    expect(dup).toBe(200 - pool().length)
    for (const i of pool()) expect(s.owned[i.kind]).toContain(i.id)
  })
  it('pity guarantees rare or better', () => {
    const s = defaultSave()
    s.coins = 100000
    // 用永遠抽到普通的 rng（0.0 落在第一個稀有度）
    let commons = 0
    for (let i = 0; i < PITY_RARE_AT - 1; i++) { const r = pull(s, () => 0.0)!; if (r.item.rarity === 'common') commons++ }
    expect(commons).toBe(PITY_RARE_AT - 1)
    const r = pull(s, () => 0.0)!
    expect(r.pityTriggered).toBe(true)
    expect(r.item.rarity).not.toBe('common')
    expect(s.pity).toBe(0)
  })
})
