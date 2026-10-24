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

/** 鐵道：一條橫向的路堤與軌道在前方，火車從左或右直線通過；月台、天橋、電桿與遠山。 */
export function buildRail(): World {
  const scene = new THREE.Scene()
  const rand = seeded(2026)
  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  const hemi = new THREE.HemisphereLight('#f6eedc', '#6d7a4a', 0.7)
  scene.add(sun, hemi)

  const TRACK_Z = -45
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), makeToon('#a9ad6e'))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  // 路堤
  const bank = new THREE.Mesh(new THREE.BoxGeometry(400, 1.0, 9), makeToon('#9a8f70'))
  bank.position.set(0, 0.5, TRACK_Z)
  scene.add(bank)
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 4.2), makeToon('#8d8a82'))
  ballast.position.set(0, 1.0, TRACK_Z)
  scene.add(ballast)
  // 枕木與鐵軌
  const tieMat = makeToon('#5a4a3a')
  for (let x = -200; x <= 200; x += 0.7) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 2.5), tieMat)
    tie.position.set(x, 1.2, TRACK_Z)
    scene.add(tie)
  }
  const railMat = makeToon('#7d7f86')
  for (const dz of [-0.72, 0.72]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(400, 0.16, 0.08), railMat)
    rail.position.set(0, 1.34, TRACK_Z + dz)
    scene.add(rail)
  }
  // 電桿與架空線
  const poleMat = makeToon('#6f6f6f')
  const wireMat = new THREE.LineBasicMaterial({ color: '#3a3a3a' })
  const pts: THREE.Vector3[] = []
  for (let x = -200; x <= 200; x += 40) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 7), poleMat)
    pole.position.set(x, 4.5, TRACK_Z + 3.2)
    scene.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.2), poleMat)
    arm.position.set(x, 7.6, TRACK_Z + 1.6)
    scene.add(arm)
    pts.push(new THREE.Vector3(x, 7.4, TRACK_Z))
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat))
  // 月台（近側）
  const platform = new THREE.Mesh(new THREE.BoxGeometry(60, 1.1, 5), makeToon('#c2b8a3'))
  platform.position.set(30, 0.55, -18)
  scene.add(platform)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 4), makeToon('#8a6a4a'))
  roof.position.set(38, 4.0, -18)
  scene.add(roof)
  for (const x of [26, 38, 50]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), makeToon('#8a6a4a'))
    post.position.set(x, 2.5, -18)
    scene.add(post)
  }
  // 天橋（左側）
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 50), makeToon('#7a7a72'))
  bridge.position.set(-16, 6.2, -30)
  scene.add(bridge)
  for (const z of [-52, -8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(5, 6.2, 0.6), makeToon('#7a7a72'))
    leg.position.set(-16, 3.1, z)
    scene.add(leg)
  }
  // 路堤後的田與樹帶、遠山：火車背後要有東西，但離軌道夠遠才化得開
  const paddy = new THREE.Mesh(new THREE.PlaneGeometry(800, 200), makeToon('#8fb05a'))
  paddy.rotation.x = -Math.PI / 2
  paddy.position.set(0, 0.02, TRACK_Z - 110)
  scene.add(paddy)
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group()
    const sc = 1 + rand() * 1.6
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.2 * sc, 2.4 * sc, 7), makeToon('#8a6a4a'))
    trunk.position.y = 1.2 * sc
    g.add(trunk)
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * sc, 1), makeToon(i % 2 ? '#7f9d58' : '#6f9a4e'))
    blob.position.y = 2.8 * sc
    g.add(blob)
    g.position.set((rand() - 0.5) * 300, 0, TRACK_Z - 35 - rand() * 40)
    scene.add(g)
  }
  for (let i = 0; i < 6; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(70 + rand() * 40, 10, 8), makeToon('#9fa98a'))
    hill.position.set((i - 2.5) * 110 + (rand() - 0.5) * 40, -35, TRACK_Z - 260 - rand() * 80)
    scene.add(hill)
  }
  // 路堤前的草（細長層）
  const grassMat = makeToon('#8da45a')
  const grassGeo = new THREE.ConeGeometry(0.06, 0.5, 4)
  for (let i = 0; i < 300; i++) {
    const m = new THREE.Mesh(grassGeo, grassMat)
    m.position.set((rand() - 0.5) * 160, 0.25, TRACK_Z + 6 + rand() * 28)
    m.scale.setScalar(0.7 + rand() * 1.2)
    markThin(m)
    scene.add(m)
  }

  // 對面的小山坡（遠機位站的地方）
  const knoll = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 8), makeToon('#9aa870'))
  knoll.position.set(0, -22, 104)
  scene.add(knoll)

  const perches: Perch[] = [
    { position: new THREE.Vector3(0, 1.42, TRACK_Z), along: new THREE.Vector3(1, 0, 0), range: 0, tags: ['rail'] },
  ]
  const hides: HideDef[] = [
    { id: 'platform', name: '月台末端', description: '離軌道三十公尺，正側面；車頭會從左邊或右邊進來，先聽汽笛', position: [0, 1.65, -15], yawDeg: 0 },
    { id: 'field', name: '田埂遠望', description: '退到六十公尺外，焦距退到底時短的列車裝得下，背景是遠山', position: [0, 1.5, 15], yawDeg: 0 },
    { id: 'slope', name: '對面山坡', description: '一百五十公尺外的小山坡，略高於路堤；焦距退到底，整列車連同田野都裝得下', position: [0, 9, 100], yawDeg: 0 },
    { id: 'bridge', name: '天橋上', description: '六公尺高俯視軌道，車頂與架空線都看得到', position: [-16, 7.9, -30], yawDeg: 40 },
  ]
  return { scene, sun, hemi, perches, hides, dispose: () => disposeScene(scene) }
}
