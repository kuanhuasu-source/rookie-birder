import * as THREE from 'three'
import { makeToon } from '../../render/materials/toon'
import { markThin } from '../../render/mask'
import type { Perch } from '../../birds/Bird'
import type { World } from '../scene'
import type { HideDef } from '../../levels/types'
import { disposeScene } from './park'

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** 溪流：橫過畫面的水道、兩岸的草叢與蘆葦、伸到水面上的枯枝、溪中的石頭。 */
export function buildStream(): World {
  const scene = new THREE.Scene()
  const rand = seeded(31)
  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  const hemi = new THREE.HemisphereLight('#f6eedc', '#6d7a4a', 0.7)
  scene.add(sun, hemi)

  // 近岸與對岸
  const bankMat = makeToon('#9bb46a')
  const near = new THREE.Mesh(new THREE.PlaneGeometry(600, 60), bankMat)
  near.rotation.x = -Math.PI / 2
  near.position.set(0, 0.35, 24)
  scene.add(near)
  const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), bankMat)
  far.rotation.x = -Math.PI / 2
  far.position.set(0, 0.35, -212)
  scene.add(far)
  // 水面：z 從 −6 到 −12
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 60), makeToon('#7fa6b8'))
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.0, -9)
  scene.add(water)
  // 岸邊的坡
  for (const [z, rot] of [[-6, 1], [-12, -1]] as [number, number][]) {
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(600, 1.2), makeToon('#8a9a5c'))
    slope.rotation.x = -Math.PI / 2 + rot * 0.5
    slope.position.set(0, 0.18, z + rot * 0.2)
    scene.add(slope)
  }
  // 卵石
  const pebbleMat = makeToon('#b5b0a6')
  for (let i = 0; i < 160; i++) {
    const r = 0.08 + rand() * 0.2
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), pebbleMat)
    const side = rand() < 0.5 ? -1 : 1
    m.position.set((rand() - 0.5) * 60, 0.3, side > 0 ? -5.2 + rand() * 0.9 : -12.8 - rand() * 0.9)
    scene.add(m)
  }
  // 溪中大石
  const rockMat = makeToon('#a8a39a')
  const rocks: [number, number, number][] = [[-2.5, -10, 0.9], [2.2, -8, 0.6], [5.5, -11, 0.7], [-6, -8.5, 0.8], [-9, -11, 1.1], [9, -9, 0.9]]
  for (const [x, z, r] of rocks) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockMat)
    m.position.set(x, r * 0.35, z)
    m.scale.set(1.3, 0.8, 1.1)
    scene.add(m)
  }
  // 蘆葦與草叢：兩岸
  const reedMat = makeToon('#8fae5a')
  const reedGeo = new THREE.ConeGeometry(0.05, 1.6, 4)
  for (let i = 0; i < 400; i++) {
    const m = new THREE.Mesh(reedGeo, reedMat)
    const side = rand() < 0.5 ? -1 : 1
    let x = (rand() - 0.5) * 70
    // 近岸的蘆葦讓開機位到停棲點之間的視線走廊
    if (side > 0 && Math.abs(x) < 3.5) x += Math.sign(x || 1) * 3.5
    const z = side > 0 ? -4.5 + rand() * 1.5 : -13 - rand() * 2
    m.position.set(x, 0.35 + 0.8, z)
    m.rotation.z = (rand() - 0.5) * 0.25
    m.scale.setScalar(0.7 + rand() * 0.8)
    markThin(m)
    scene.add(m)
  }
  // 前景草：機位附近
  const fgMat = makeToon('#6f9a4e')
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), fgMat)
    const side = i % 2 === 0 ? -1 : 1
    m.position.set(side * (1.6 + rand() * 1.6), 0.35 + 0.35, -(1.5 + rand() * 1.5))
    scene.add(m)
  }
  // 對岸的樹
  const greens = ['#6f9a4e', '#86ad5b', '#5f8a45']
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group()
    const sc = 1 + rand() * 1.6
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.2 * sc, 2.4 * sc, 7), makeToon('#8a6a4a'))
    trunk.position.y = 1.2 * sc
    g.add(trunk)
    for (let k = 0; k < 3; k++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + rand() * 0.8) * sc, 1), makeToon(greens[k % 3]))
      blob.position.set((rand() - 0.5) * 1.6 * sc, 2.4 * sc + (rand() * 1.2 + 0.3) * sc, (rand() - 0.5) * 1.6 * sc)
      g.add(blob)
    }
    g.position.set((rand() - 0.5) * 70, 0.35, -(16 + rand() * 18))
    scene.add(g)
  }
  for (let i = 0; i < 4; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(40 + rand() * 30, 10, 8), makeToon('#8fa56e'))
    hill.position.set((i - 1.5) * 70 + (rand() - 0.5) * 30, -20, -150 - rand() * 40)
    scene.add(hill)
  }
  // 枯枝：從對岸伸到水面上
  const dead = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 4.2, 6), makeToon('#7a6a58'))
  dead.rotation.z = Math.PI / 2 - 0.18
  dead.rotation.y = 0.35
  dead.position.set(1.2, 1.35, -10.4)
  scene.add(dead)
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 7), makeToon('#7a6a58'))
  stump.position.set(3.0, 0.9, -11.6)
  scene.add(stump)

  const perches: Perch[] = [
    { position: new THREE.Vector3(0.6, 1.45, -10.2), along: new THREE.Vector3(1, 0.17, -0.35).normalize(), range: 1.8 , tags: ['branch'] },   // 枯枝
    { position: new THREE.Vector3(-2.5, 1.06, -10.0), along: new THREE.Vector3(1, 0, 0), range: 0.6 , tags: ['rock'] },                     // 溪中石（石頂）
    { position: new THREE.Vector3(4.0, 0.36, -12.6), along: new THREE.Vector3(1, 0, 0), range: 2.5 , tags: ['ground'] },                     // 對岸卵石灘
  ]
  const hides: HideDef[] = [
    { id: 'rock', name: '溪邊大石', description: '正對枯枝與溪中石，距離十公尺，視線略高於水面', position: [0, 1.4, 0], yawDeg: 0 },
    { id: 'reeds', name: '上游草叢', description: '斜斜地看過去，離溪中石近，對岸樹林當背景', position: [-7, 1.1, -5], yawDeg: -52 },
    { id: 'bridge', name: '橋下', description: '趴得很低，幾乎與水面平視，但距離遠一些', position: [4, 0.55, 2], yawDeg: 18 },
  ]
  return { scene, sun, hemi, perches, hides, dispose: () => disposeScene(scene) }
}
