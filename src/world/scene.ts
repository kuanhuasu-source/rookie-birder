import * as THREE from 'three'
import { makeToon } from '../render/materials/toon'
import type { Perch } from '../birds/Bird'

export interface World {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  perches: Perch[]
  hidePosition: THREE.Vector3
}

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function tree(rand: () => number, x: number, z: number, scale: number): THREE.Group {
  const g = new THREE.Group()
  const trunkH = 2.2 * scale
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, trunkH, 7), makeToon('#8a6a4a'))
  trunk.position.y = trunkH / 2
  g.add(trunk)
  const greens = ['#6f9a4e', '#86ad5b', '#5f8a45', '#9bbd68']
  const n = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const r = (0.9 + rand() * 0.8) * scale
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), makeToon(greens[Math.floor(rand() * greens.length)]))
    blob.position.set((rand() - 0.5) * 1.6 * scale, trunkH + (rand() * 1.4 + 0.3) * scale, (rand() - 0.5) * 1.6 * scale)
    g.add(blob)
  }
  g.position.set(x, 0, z)
  return g
}

export function buildWorld(): World {
  const scene = new THREE.Scene()
  const rand = seeded(7)

  const sun = new THREE.DirectionalLight('#ffffff', 2.6)
  const hemi = new THREE.HemisphereLight('#f6eedc', '#6d7a4a', 0.7)
  scene.add(sun, hemi)

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), makeToon('#9bb46a'))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // 草叢與小石頭：給景深一些可以看的東西
  const grassMat = makeToon('#7ea257')
  const grassGeo = new THREE.ConeGeometry(0.08, 0.5, 5)
  for (let i = 0; i < 700; i++) {
    const m = new THREE.Mesh(grassGeo, grassMat)
    const r = 2 + rand() * 60
    const a = rand() * Math.PI * 2
    m.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r)
    m.rotation.y = rand() * Math.PI
    const s = 0.6 + rand() * 1.4
    m.scale.set(s, s, s)
    scene.add(m)
  }
  const rockMat = makeToon('#a8a39a')
  for (let i = 0; i < 40; i++) {
    const r = 0.3 + rand() * 0.8
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat)
    const d = 6 + rand() * 50
    const a = rand() * Math.PI * 2
    m.position.set(Math.cos(a) * d, r * 0.4, Math.sin(a) * d)
    scene.add(m)
  }

  // 前景草：離相機 3 到 6 公尺，偏畫面兩側
  const fgMat = makeToon('#6f9a4e')
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2, 5), fgMat)
    const side = i % 2 === 0 ? -1 : 1
    m.position.set(side * (0.6 + rand() * 1.4), 0.6, -(3 + rand() * 3))
    scene.add(m)
  }

  // 樹：中景與遠景
  for (let i = 0; i < 26; i++) {
    const z = -(18 + rand() * 40)
    const x = (rand() - 0.5) * 70
    scene.add(tree(rand, x, z, 1 + rand() * 1.6))
  }
  // 遠山
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(40 + rand() * 30, 10, 8), makeToon('#8fa56e'))
    hill.position.set((i - 2) * 60 + (rand() - 0.5) * 30, -20, -140 - rand() * 40)
    scene.add(hill)
  }

  // 鳥停的樹：枝幹伸到畫面中央偏右
  const perchTree = tree(rand, 3.2, -12.5, 1.4)
  scene.add(perchTree)
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.2, 6), makeToon('#7a5a3c'))
  branch.rotation.z = Math.PI / 2 - 0.12
  branch.position.set(1.7, 2.05, -12.1)
  scene.add(branch)

  // 第二個停棲點：左前方的大石頭
  const bigRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), makeToon('#9e9a90'))
  bigRock.position.set(-1.6, 0.45, -9.2)
  bigRock.scale.set(1.3, 0.9, 1.1)
  scene.add(bigRock)

  const perches: Perch[] = [
    { position: new THREE.Vector3(0.9, 2.10, -12.0), along: new THREE.Vector3(1, 0.12, 0).normalize(), range: 1.6 },
    { position: new THREE.Vector3(-1.6, 1.13, -9.2), along: new THREE.Vector3(1, 0, 0), range: 0.6 },
  ]

  return { scene, sun, hemi, perches, hidePosition: new THREE.Vector3(0, 1.5, 0) }
}
