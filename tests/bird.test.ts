import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Bird, type Perch } from '../src/birds/Bird'
import { Spawner } from '../src/birds/spawner'
import { spottedDove } from '../src/birds/species/spotted-dove'

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const perch: Perch = { position: new THREE.Vector3(0, 2, -12), along: new THREE.Vector3(1, 0, 0), range: 1.6 }
const camPos = new THREE.Vector3(0, 1.5, 0)

describe('Bird state machine', () => {
  it('flies in, lands, perches through S1-S3, takes off and leaves within dwell + flight time', () => {
    const bird = new Bird(spottedDove, seeded(1))
    const seen = new Set<string>()
    let left = false
    bird.onLeft = () => { left = true }
    bird.enter(perch, new THREE.Vector3(10, 6, -14))
    expect(bird.state).toBe('S5')
    const dt = 1 / 60
    let t = 0
    while (!left && t < 120) { bird.update(dt, camPos); seen.add(bird.state); t += dt }
    expect(left).toBe(true)
    expect(bird.inScene).toBe(false)
    expect(seen.has('S4')).toBe(true)
    expect(seen.has('S1')).toBe(true)
    // 停留上限 40 秒加飛行，不該超過 50 秒
    expect(t).toBeLessThan(50)
    expect(t).toBeGreaterThan(spottedDove.dwell.min * 0.8)
  })
  it('stays on the perch range while perched', () => {
    const bird = new Bird(spottedDove, seeded(7))
    bird.enter(perch, new THREE.Vector3(-10, 6, -10))
    for (let i = 0; i < 60 * 30; i++) {
      bird.update(1 / 60, camPos)
      if (bird.state === 'S1' || bird.state === 'S2' || bird.state === 'S3') {
        expect(Math.abs(bird.group.position.x)).toBeLessThanOrEqual(perch.range / 2 + 0.01)
        expect(bird.group.position.y).toBeGreaterThanOrEqual(2 - 0.01)
      }
    }
  })
  it('eye stays inside the paper and follows facing', () => {
    const bird = new Bird(spottedDove, seeded(3))
    bird.enter(perch, new THREE.Vector3(10, 6, -14))
    for (let i = 0; i < 60 * 20; i++) bird.update(1 / 60, camPos)
    const half = spottedDove.sprites[bird.state === 'S5' || bird.state === 'S4' ? 'takeoff' : 'side'].sizeM / 2 + 0.1
    expect(Math.abs(bird.eye.position.x)).toBeLessThan(half)
    expect(Math.sign(bird.eye.position.x)).toBe(bird.facing)
  })
  it('forceTakeoff leaves from a perched state', () => {
    const bird = new Bird(spottedDove, seeded(5))
    bird.enter(perch, new THREE.Vector3(10, 6, -14))
    while (bird.state === 'S5' || bird.state === 'S4') bird.update(1 / 60, camPos)
    bird.forceTakeoff()
    expect(bird.state).toBe('S4')
    let left = false
    bird.onLeft = () => { left = true }
    for (let i = 0; i < 60 * 10 && !left; i++) bird.update(1 / 60, camPos)
    expect(left).toBe(true)
  })
})

describe('Spawner', () => {
  it('calls before spawning and respawns after the bird leaves', () => {
    const rng = seeded(11)
    const bird = new Bird(spottedDove, rng)
    const sp = new Spawner([bird], [perch], rng)
    let calls = 0
    sp.onCall = () => { calls++ }
    const dt = 1 / 30
    let spawnedAt = -1
    let t = 0
    while (spawnedAt < 0 && t < 60) { sp.update(dt); bird.update(dt, camPos); t += dt; if (bird.inScene) spawnedAt = t }
    expect(spawnedAt).toBeGreaterThan(0)
    expect(calls).toBe(1)
    // 跑到離開並再次出現
    let respawned = false
    let wasOut = false
    while (!respawned && t < 200) {
      sp.update(dt); bird.update(dt, camPos); t += dt
      if (!bird.inScene) wasOut = true
      if (wasOut && bird.inScene) respawned = true
    }
    expect(respawned).toBe(true)
    expect(calls).toBe(2)
  })
})

describe('Spawner with several species', () => {
  it('picks species by weight and never has two birds in scene', async () => {
    const { lightVentedBulbul, treeSparrow } = await import('../src/birds/species')
    const rng = seeded(21)
    const birds = [new Bird(spottedDove, rng), new Bird(lightVentedBulbul, rng), new Bird(treeSparrow, rng)]
    const sp = new Spawner(birds, [perch], rng, { 'spotted-dove': 0.2, 'light-vented-bulbul': 0.6, 'tree-sparrow': 0.2 }, 0.2)
    const seen = new Map<string, number>()
    const dt = 1 / 30
    for (let t = 0; t < 600; t += dt) {
      sp.update(dt)
      for (const b of birds) b.update(dt, camPos)
      const inScene = birds.filter((b) => b.inScene)
      expect(inScene.length).toBeLessThanOrEqual(1)
      if (sp.current && sp.current.inScene && sp.current.state === 'S4') seen.set(sp.current.species.id, (seen.get(sp.current.species.id) ?? 0) + 1)
    }
    expect(seen.size).toBeGreaterThanOrEqual(2)
    expect((seen.get('light-vented-bulbul') ?? 0)).toBeGreaterThan(seen.get('tree-sparrow') ?? 0)
  })
})

describe('hovering species', () => {
  it('flies to the hover point, hovers in S5 for its dwell, then leaves', async () => {
    const { spottedDove } = await import('../src/birds/species/spotted-dove')
    const kite = { ...spottedDove, id: 'kite-test', hovers: true, hoverHeightM: 6, dwell: { min: 4, max: 4 }, flightSpeedMs: 10 }
    const bird = new Bird(kite, seeded(9))
    let left = false
    bird.onLeft = () => { left = true }
    bird.enter(perch, new THREE.Vector3(12, 8, -14))
    let hoverFrames = 0
    let t = 0
    while (!left && t < 30) {
      bird.update(1 / 60, camPos); t += 1 / 60
      if (bird.isHovering) { hoverFrames++; expect(bird.state).toBe('S5'); expect(bird.group.position.y).toBeGreaterThan(perch.position.y + 4) }
    }
    expect(hoverFrames).toBeGreaterThan(60 * 3)
    expect(left).toBe(true)
  })
})

describe('swaying perch', () => {
  it('a bird on a swaying grass stem moves sideways over time, a rigid perch does not', () => {
    const sway = { position: new THREE.Vector3(0, 1, -10), along: new THREE.Vector3(1, 0, 0), range: 0, swayM: 0.15 }
    const rigid = { ...sway, swayM: undefined }
    const a = new Bird(spottedDove, seeded(3)); a.placeOnPerch(sway)
    const b = new Bird(spottedDove, seeded(3)); b.placeOnPerch(rigid)
    const xs = new Set<number>()
    for (let i = 0; i < 120; i++) { a.update(1 / 30, camPos); b.update(1 / 30, camPos); xs.add(+a.group.position.x.toFixed(3)); expect(b.group.position.x).toBe(0) }
    expect(xs.size).toBeGreaterThan(10)
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.15)
  })
})

describe('lore', () => {
  it('every species has complete guide information', async () => {
    const { SPECIES } = await import('../src/birds/species')
    const { LORE } = await import('../src/birds/lore')
    for (const sp of SPECIES) {
      const l = LORE[sp.id]
      expect(l, sp.id).toBeDefined()
      for (const k of ['latin', 'lengthCm', 'status', 'habitat', 'features', 'habits', 'voice', 'tip'] as const) expect(l[k].length, `${sp.id}.${k}`).toBeGreaterThan(1)
    }
  })
})

describe('sun spots', () => {
  it('a perch with a sun spot is lit for onS seconds of every period, offset by its phase', async () => {
    const { perchSunlit } = await import('../src/birds/Bird')
    const p: Perch = { position: new THREE.Vector3(), along: new THREE.Vector3(1, 0, 0), range: 1, sunSpot: { periodS: 60, onS: 20, phaseS: 10 } }
    expect(perchSunlit(p, 0)).toBe(true)      // (0+10) % 60 = 10 < 20
    expect(perchSunlit(p, 9)).toBe(true)
    expect(perchSunlit(p, 11)).toBe(false)    // 21
    expect(perchSunlit(p, 55)).toBe(true)     // 65 % 60 = 5
    expect(perchSunlit({ ...p, sunSpot: undefined }, 0)).toBe(false)
  })
  it('setLightMul scales the paper colour and reports back', () => {
    const b = new Bird(spottedDove, seeded(1))
    expect(b.lightMul).toBe(1)
    b.setLightMul(4)
    expect(b.paper.material.color.r).toBe(4)
    expect(b.lightMul).toBe(4)
    b.setLightMul(1)
    expect(b.paper.material.color.g).toBe(1)
  })
})

describe('perch preferences', () => {
  it('a bird only lands on perches whose tags it accepts, and falls back when none fit', async () => {
    const { perchFits } = await import('../src/birds/Bird')
    const grass: Perch = { position: new THREE.Vector3(0, 1, -10), along: new THREE.Vector3(1, 0, 0), range: 1, tags: ['grass'] }
    const wire: Perch = { position: new THREE.Vector3(5, 1.4, -14), along: new THREE.Vector3(1, 0, 0), range: 1, tags: ['wire'] }
    expect(perchFits(grass, ['grass', 'bamboo'])).toBe(true)
    expect(perchFits(wire, ['grass', 'bamboo'])).toBe(false)
    expect(perchFits(wire, undefined)).toBe(true)
    expect(perchFits({ ...wire, tags: undefined }, ['grass'])).toBe(true)
    const shrike = new Bird({ ...spottedDove, id: 'shrike-test', perchTags: ['wire', 'post'] }, seeded(4))
    const prinia = new Bird({ ...spottedDove, id: 'prinia-test', perchTags: ['grass'] }, seeded(5))
    const sp = new Spawner([shrike, prinia], [grass, wire], seeded(6), { 'shrike-test': 1, 'prinia-test': 1 })
    expect(sp.perchesFor(shrike)).toEqual([wire])
    expect(sp.perchesFor(prinia)).toEqual([grass])
    const egret = new Bird({ ...spottedDove, id: 'egret-test', perchTags: ['water'] }, seeded(7))
    expect(new Spawner([egret], [grass, wire], seeded(8)).perchesFor(egret)).toEqual([grass, wire])
    for (let i = 0; i < 6; i++) { sp.next = shrike; sp.spawnNow(); expect(shrike.currentPerch).toBe(wire); shrike.inScene = false; sp.current = null }
  })
})
