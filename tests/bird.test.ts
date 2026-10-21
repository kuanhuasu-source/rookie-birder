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
    const sp = new Spawner(bird, [perch], rng)
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
