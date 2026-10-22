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

/** 濕地：開闊的淺水與泥灘，停棲點遠，天空佔畫面一大半。 */
export function buildWetland(): World {
  const scene = new THREE.Scene()
  const rand = seeded(77)
  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  const hemi = new THREE.HemisphereLight('#f6eedc', '#8a8f6a', 0.7)
  scene.add(sun, hemi)

  // 近岸的堤防草地
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(600, 30), makeToon('#a2b06a'))
  bank.rotation.x = -Math.PI / 2
  bank.position.set(0, 0.3, 10)
  scene.add(bank)
  // 淺水：一大片
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), makeToon('#8fb3b8'))
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.0, -150)
  scene.add(water)
  // 泥灘：水中幾片低矮的島
  const mudMat = makeToon('#a89a7a')
  const flats: [number, number, number, number][] = [[-4, -24, 9, 3], [10, -30, 12, 3.5], [22, -22, 7, 2.5], [-18, -34, 10, 3], [2, -44, 16, 4], [-30, -26, 8, 2.5]]
  for (const [x, z, w, d] of flats) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.6, 0.25, 10), mudMat)
    m.scale.z = d / w
    m.position.set(x, 0.1, z)
    scene.add(m)
  }
  // 水中的木樁
  const postMat = makeToon('#6f5a44')
  const posts: [number, number, number][] = [[6, -19, 1.3], [-22, -20, 1.0], [15, -26, 1.5], [-2, -36, 1.2]]
  for (const [x, z, h] of posts) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 6), postMat)
    m.position.set(x, h / 2, z)
    scene.add(m)
  }
  // 遠岸：一條低矮的樹帶與蘆葦
  const reedMat = makeToon('#9aa860')
  const reedGeo = new THREE.ConeGeometry(0.05, 1.5, 4)
  for (let i = 0; i < 260; i++) {
    const m = new THREE.Mesh(reedGeo, reedMat)
    const x = (rand() - 0.5) * 120
    const z = -(48 + rand() * 10)
    m.position.set(x, 0.75, z)
    m.scale.setScalar(0.8 + rand() * 0.7)
    markThin(m)
    scene.add(m)
  }
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group()
    const sc = 0.8 + rand() * 1.2
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.16 * sc, 2 * sc, 7), makeToon('#8a6a4a'))
    trunk.position.y = sc
    g.add(trunk)
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * sc, 1), makeToon(i % 2 ? '#7f9d58' : '#6f9a4e'))
    blob.position.y = 2.4 * sc
    g.add(blob)
    g.position.set((rand() - 0.5) * 140, 0.3, -(60 + rand() * 20))
    scene.add(g)
  }
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(50 + rand() * 30, 10, 8), makeToon('#9fb08a'))
    hill.position.set((i - 2) * 90 + (rand() - 0.5) * 40, -30, -220 - rand() * 60)
    scene.add(hill)
  }
  // 堤防：機位之一在高處
  const levee = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 6), makeToon('#9a9480'))
  levee.position.set(0, 1.5, 6)
  scene.add(levee)
  // 賞鳥牆：中間留一道真正的觀察窗（上下兩片牆板加兩側）
  const wallMat = makeToon('#7a6a58')
  const lower = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.3), wallMat)
  lower.position.set(0, 0.6, -1.2)
  const upper = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.3), wallMat)
  upper.position.set(0, 2.0, -1.2)
  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.3), wallMat)
  leftPost.position.set(-2.2, 1.5, -1.2)
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.3), wallMat)
  rightPost.position.set(2.2, 1.5, -1.2)
  scene.add(lower, upper, leftPost, rightPost)

  const perches: Perch[] = [
    { position: new THREE.Vector3(6, 1.3, -19), along: new THREE.Vector3(1, 0, 0), range: 0.2 , tags: ['post'] },          // 木樁（夜鷺）
    { position: new THREE.Vector3(-4, 0.23, -24), along: new THREE.Vector3(1, 0, 0), range: 7 , tags: ['mud', 'ground'] },           // 泥灘（高蹺鴴走動）
    { position: new THREE.Vector3(10, 0.23, -30), along: new THREE.Vector3(1, 0, 0.2).normalize(), range: 10 , tags: ['mud', 'ground'] }, // 遠泥灘
    { position: new THREE.Vector3(-14, 0.05, -28), along: new THREE.Vector3(1, 0, 0), range: 6 , tags: ['water'] },          // 水面（紅冠水雞）
  ]
  const hides: HideDef[] = [
    { id: 'wall', name: '賞鳥牆', description: '從牆上的窗口看出去，鳥在二十公尺外，正面逆著下午的光', position: [0, 1.5, -0.6], yawDeg: 0 },
    { id: 'levee', name: '堤防上', description: '站得高、看得遠，但是俯視的角度，鳥會變小', position: [-6, 3.4, 4], yawDeg: -12 },
    { id: 'mud', name: '泥灘邊', description: '趴在近岸的泥灘，與水面平視，離高蹺鴴最近', position: [-6, 0.5, -10], yawDeg: -8 },
  ]
  return { scene, sun, hemi, perches, hides, dispose: () => disposeScene(scene) }
}
