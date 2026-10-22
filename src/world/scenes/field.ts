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

/** 一叢芒草：高莖加穗，再加幾片扁葉；dense 的用在前景，要真的擋得到東西。 */
function grassClump(rand: () => number, x: number, z: number, h: number, stemMat: THREE.Material, headMat: THREE.Material, bladeMat: THREE.Material, dense = false): THREE.Group {
  const g = new THREE.Group()
  const n = (dense ? 14 : 6) + Math.floor(rand() * 5)
  for (let i = 0; i < n; i++) {
    const hh = h * (0.7 + rand() * 0.5)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, hh, 4), stemMat)
    const ox = (rand() - 0.5) * (dense ? 0.9 : 0.5), oz = (rand() - 0.5) * 0.4
    stem.position.set(ox, hh / 2, oz)
    stem.rotation.z = (rand() - 0.5) * 0.35
    stem.rotation.x = (rand() - 0.5) * 0.25
    g.add(stem)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.25, 5), headMat)
    head.position.set(ox + Math.sin(-stem.rotation.z) * hh * 0.5, hh - 0.05, oz)
    head.rotation.z = stem.rotation.z
    g.add(head)
  }
  const nb = dense ? 10 : 4
  for (let i = 0; i < nb; i++) {
    const bh = h * (0.5 + rand() * 0.4)
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.05, bh), bladeMat)
    blade.position.set((rand() - 0.5) * (dense ? 1.0 : 0.5), bh / 2, (rand() - 0.5) * 0.4)
    blade.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.5)
    g.add(blade)
  }
  g.position.set(x, 0, z)
  markThin(g)
  return g
}

/** 田野草叢：田埂、芒草、圍籬與電線，前景的草會擋到鳥，背景有遠有近。 */
export function buildField(): World {
  const scene = new THREE.Scene()
  const rand = seeded(41)
  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  const hemi = new THREE.HemisphereLight('#f6eedc', '#7d8a4e', 0.7)
  scene.add(sun, hemi)

  // 地面：休耕的田，再往遠是綠油油的田
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), makeToon('#b9b07a'))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const paddy = new THREE.Mesh(new THREE.PlaneGeometry(600, 200), makeToon('#8fb05a'))
  paddy.rotation.x = -Math.PI / 2
  paddy.position.set(0, 0.01, -120)
  scene.add(paddy)
  // 田埂：一條橫的土堤，機位之一趴在這裡，草從堤上長出來擋在鏡頭前
  const bund = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, 1.2), makeToon('#a58f63'))
  bund.position.set(0, 0.2, -2.2)
  scene.add(bund)
  // 農路
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 300), makeToon('#c2b48e'))
  road.rotation.x = -Math.PI / 2
  road.position.set(-12, 0.02, -100)
  scene.add(road)

  const stemMat = makeToon('#b9a865')
  const headMat = makeToon('#e2d3a0')
  const greenStem = makeToon('#8da45a')
  const bladeMat = makeToon('#a9b35f')
  bladeMat.side = THREE.DoubleSide
  // 前景芒草：長在田埂上，離鏡頭 1.5 到 3 公尺，正好擋在田埂機位看草穗的視線上；夠糊就會化開
  const fg: [number, number, number][] = [[0.3, -3.4, 1.1], [-0.7, -3.8, 1.15], [1.4, -4.2, 1.0], [-1.8, -3.2, 1.1], [2.6, -3.6, 1.0], [-3.0, -4.4, 1.1], [3.6, -4.8, 1.0]]
  for (const [x, z, h] of fg) scene.add(grassClump(rand, x, z, h, stemMat, headMat, bladeMat, true))
  // 中景芒草：鳥停的草叢（停棲點在穗的高度），每叢前面 1.5 到 2 公尺再一叢，這層貼著鳥、化不開
  const mid: [number, number, number][] = [[-3, -11, 1.5], [1.5, -12, 1.6], [5, -10.5, 1.4], [-6, -13, 1.5], [3.5, -15, 1.7], [-1, -16, 1.5]]
  for (const [x, z, h] of mid) scene.add(grassClump(rand, x, z, h, stemMat, headMat, bladeMat))
  const near: [number, number, number][] = [[-2.2, -9.4, 1.3], [2.3, -10.3, 1.35], [2.5, -13.3, 1.45]]
  for (const [x, z, h] of near) scene.add(grassClump(rand, x, z, h, stemMat, headMat, bladeMat))
  // 矮草：到處都是
  const lowGeo = new THREE.ConeGeometry(0.06, 0.45, 4)
  for (let i = 0; i < 500; i++) {
    const m = new THREE.Mesh(lowGeo, greenStem)
    const x = (rand() - 0.5) * 80, z = -(3 + rand() * 60)
    if (Math.abs(x + 12) < 3.5) continue
    m.position.set(x, 0.22, z)
    m.scale.setScalar(0.7 + rand() * 1.2)
    markThin(m)
    scene.add(m)
  }
  // 圍籬：木樁與兩條電線，伯勞最愛站的地方（右側，背後是近的樹籬）
  const postMat = makeToon('#6f5a44')
  const wireMat = new THREE.LineBasicMaterial({ color: '#4a4a4a' })
  const postsX = [6, 9, 12, 15, 18]
  for (const x of postsX) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6), postMat)
    post.position.set(x, 0.75, -14)
    scene.add(post)
  }
  for (const y of [1.0, 1.4]) {
    const pts = postsX.map((x) => new THREE.Vector3(x, y, -14))
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat))
  }
  // 竹竿：斑文鳥成群停的地方（左側，背後是遠的田）
  const bambooMat = makeToon('#c8b86a')
  for (const [x, z] of [[-9, -12], [-9.6, -12.4], [-8.4, -11.6]] as [number, number][]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.9, 5), bambooMat)
    m.position.set(x, 0.95, z)
    m.rotation.z = (rand() - 0.5) * 0.2
    scene.add(m)
  }
  // 近的樹籬：在圍籬後面 4 公尺，讓伯勞那邊的背景化不開
  const hedgeMat = makeToon('#5f8a45')
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + rand() * 0.6, 1), hedgeMat)
    b.position.set(5 + i * 2.1, 1.1, -18 - rand() * 0.8)
    scene.add(b)
  }
  // 遠的樹帶與山
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group()
    const sc = 0.9 + rand() * 1.3
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.16 * sc, 2 * sc, 7), makeToon('#8a6a4a'))
    trunk.position.y = sc
    g.add(trunk)
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 * sc, 1), makeToon(i % 2 ? '#7f9d58' : '#6f9a4e'))
    blob.position.y = 2.4 * sc
    g.add(blob)
    g.position.set((rand() - 0.5) * 160, 0, -(45 + rand() * 25))
    scene.add(g)
  }
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(50 + rand() * 30, 10, 8), makeToon('#9fb08a'))
    hill.position.set((i - 2) * 90 + (rand() - 0.5) * 40, -30, -200 - rand() * 60)
    scene.add(hill)
  }
  // 電線桿：第三個機位躲在後面
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 6, 8), postMat)
  pole.position.set(7.5, 3, -2)
  scene.add(pole)

  const perches: Perch[] = [
    { position: new THREE.Vector3(1.5, 1.55, -12), along: new THREE.Vector3(1, 0, 0), range: 0.3, swayM: 0.08 },   // 芒草穗（鷦鶯、扇尾鶯）
    { position: new THREE.Vector3(-3, 1.45, -11), along: new THREE.Vector3(1, 0, 0), range: 0.3, swayM: 0.1 },     // 芒草穗
    { position: new THREE.Vector3(12, 1.42, -14), along: new THREE.Vector3(1, 0, 0), range: 5 },                   // 電線（伯勞）
    { position: new THREE.Vector3(-9, 1.9, -12), along: new THREE.Vector3(1, 0, 0), range: 1.0 },                  // 竹竿頂（斑文鳥）
    { position: new THREE.Vector3(3.5, 1.7, -15), along: new THREE.Vector3(1, 0, 0), range: 0.3, swayM: 0.09 },    // 芒草穗（遠一點）
  ]
  const hides: HideDef[] = [
    { id: 'bund', name: '田埂趴低', description: '趴在田埂後面，鳥離你最近，但田埂上的芒草就在鏡頭前面', position: [0, 0.75, -1.6], yawDeg: 0 },
    { id: 'road', name: '農路站著', description: '站在農路上視野乾淨，離鳥遠一點；往右看背後是樹籬，往左看是整片田', position: [-12, 1.6, 2], yawDeg: 25 },
    { id: 'pole', name: '電線桿後', description: '靠著電線桿，離圍籬最近；芒草在左前方', position: [8.3, 1.4, -1.0], yawDeg: 10 },
  ]
  return { scene, sun, hemi, perches, hides, dispose: () => disposeScene(scene) }
}
