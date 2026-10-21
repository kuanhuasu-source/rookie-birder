import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { AlertModel, WARY_AT } from '../src/birds/alert'
import { Bird, type Perch } from '../src/birds/Bird'
import { spottedDove } from '../src/birds/species/spotted-dove'

const calm = { panOmega: 0, shots: 0, distM: 12, skittish: 1, flushDistM: 6, mul: 1, silent: false }

describe('AlertModel', () => {
  it('stays calm when nothing happens', () => {
    const a = new AlertModel()
    for (let i = 0; i < 600; i++) expect(a.update(1 / 60, calm)).toBeNull()
    expect(a.value).toBe(0)
  })
  it('fast panning raises alert to wary then flush', () => {
    const a = new AlertModel()
    const events: string[] = []
    for (let i = 0; i < 600; i++) { const e = a.update(1 / 60, { ...calm, panOmega: 1.2 }); if (e) events.push(e) }
    expect(events[0]).toBe('wary')
    expect(events).toContain('flush')
  })
  it('camouflage halves the build-up', () => {
    const a = new AlertModel(), b = new AlertModel()
    for (let i = 0; i < 60; i++) { a.update(1 / 60, { ...calm, panOmega: 1 }); b.update(1 / 60, { ...calm, panOmega: 1, mul: 0.5 }) }
    expect(b.value).toBeLessThan(a.value)
    expect(b.value).toBeGreaterThan(0)
  })
  it('being too close accumulates, a tame species slower', () => {
    const a = new AlertModel(), b = new AlertModel()
    for (let i = 0; i < 180; i++) { a.update(1 / 60, { ...calm, distM: 3 }); b.update(1 / 60, { ...calm, distM: 3, skittish: 0.5 }) }
    expect(a.value).toBeGreaterThan(b.value)
    expect(a.value).toBeGreaterThan(0.2)
  })
  it('long bursts add up, silent shutter less', () => {
    const a = new AlertModel(), b = new AlertModel()
    for (let i = 0; i < 10; i++) { a.update(1 / 60, { ...calm, shots: 1 }); b.update(1 / 60, { ...calm, shots: 1, silent: true }) }
    expect(a.value).toBeGreaterThan(b.value)
  })
  it('decays and can fire wary again later', () => {
    const a = new AlertModel()
    let wary = 0
    for (let i = 0; i < 50; i++) if (a.update(1 / 60, { ...calm, panOmega: 1.2 }) === 'wary') wary++
    expect(a.value).toBeGreaterThanOrEqual(WARY_AT)
    for (let i = 0; i < 60 * 12; i++) a.update(1 / 60, calm)
    expect(a.value).toBeLessThan(WARY_AT * 0.7)
    for (let i = 0; i < 50; i++) if (a.update(1 / 60, { ...calm, panOmega: 1.2 }) === 'wary') wary++
    expect(wary).toBe(2)
  })
})

describe('Bird startle and relocate', () => {
  const p1: Perch = { position: new THREE.Vector3(0, 2, -12), along: new THREE.Vector3(1, 0, 0), range: 1 }
  const p2: Perch = { position: new THREE.Vector3(-6, 1, -20), along: new THREE.Vector3(1, 0, 0), range: 1 }
  const cam = new THREE.Vector3(0, 1.5, 0)
  it('startle jumps to S3 and returns to perched states', () => {
    const b = new Bird(spottedDove, () => 0.5)
    b.enter(p1, new THREE.Vector3(8, 6, -10))
    while (b.state === 'S5' || b.state === 'S4') b.update(1 / 60, cam)
    b.startle()
    expect(b.state).toBe('S3')
    for (let i = 0; i < 120; i++) b.update(1 / 60, cam)
    expect(['S1', 'S2', 'S3']).toContain(b.state)
    expect(b.inScene).toBe(true)
  })
  it('relocate flies to the new perch without leaving', () => {
    const b = new Bird(spottedDove, () => 0.5)
    b.enter(p1, new THREE.Vector3(8, 6, -10))
    while (b.state === 'S5' || b.state === 'S4') b.update(1 / 60, cam)
    b.relocate(p2)
    expect(b.state).toBe('S5')
    for (let i = 0; i < 60 * 5; i++) b.update(1 / 60, cam)
    expect(b.inScene).toBe(true)
    expect(b.currentPerch).toBe(p2)
    expect(b.group.position.distanceTo(p2.position)).toBeLessThan(1.5)
  })
})
