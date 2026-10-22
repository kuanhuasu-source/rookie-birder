import * as THREE from 'three'
import { makeToon } from '../../render/materials/toon'
import { markThin, FX_LAYER } from '../../render/mask'
import { type Perch, perchSunlit } from '../../birds/Bird'
import type { World } from '../scene'
import type { HideDef } from '../../levels/types'
import { disposeScene } from './park'

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** 林地：高大的樹幹、厚厚的樹冠，地面很暗；幾個停棲點會輪流被樹冠縫隙的光斑照到。 */
export function buildForest(): World {
  const scene = new THREE.Scene()
  const rand = seeded(97)
  const sun = new THREE.DirectionalLight('#ffffff', 0.6)
  const hemi = new THREE.HemisphereLight('#9fb27a', '#3f4a2c', 3.4)
  scene.add(sun, hemi)

  // 地面：落葉層與苔蘚
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), makeToon('#5a4a33'))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const mossMat = makeToon('#4f6b36')
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1 + rand() * 2.5, 9), mossMat)
    m.rotation.x = -Math.PI / 2
    m.position.set((rand() - 0.5) * 80, 0.01, -(rand() * 60))
    scene.add(m)
  }
  // 樹幹與樹冠：幾十棵，樹冠在 7 到 13 公尺高，把天空遮掉
  const trunkMat = makeToon('#5e4a38')
  const canopyMats = ['#3d6b35', '#4a7a3d', '#355f2f', '#527f44'].map((c) => makeToon(c))
  const trees: [number, number, number][] = []
  for (let i = 0; i < 46; i++) {
    const x = (rand() - 0.5) * 90, z = -(4 + rand() * 60)
    if (Math.hypot(x, z + 10) < 4) continue
    trees.push([x, z, 0.8 + rand() * 1.2])
  }
  for (const [x, z, sc] of trees) {
    const h = 9 * sc
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc, 0.38 * sc, h, 8), trunkMat)
    trunk.position.set(x, h / 2, z)
    scene.add(trunk)
    for (let k = 0; k < 3; k++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((2.2 + rand() * 1.6) * sc, 1), canopyMats[Math.floor(rand() * canopyMats.length)])
      blob.position.set(x + (rand() - 0.5) * 3 * sc, h - 1 + rand() * 2.5 * sc, z + (rand() - 0.5) * 3 * sc)
      scene.add(blob)
    }
  }
  // 頭頂的樹冠層：一大片，從機位往上看幾乎看不到天
  for (let i = 0; i < 30; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rand() * 2.5, 1), canopyMats[Math.floor(rand() * canopyMats.length)])
    blob.position.set((rand() - 0.5) * 70, 10 + rand() * 4, -(rand() * 50) + 5)
    scene.add(blob)
  }
  // 蕨類與矮灌木（細長層）
  const fernMat = makeToon('#5f8a45')
  fernMat.side = THREE.DoubleSide
  for (let i = 0; i < 220; i++) {
    const g = new THREE.Group()
    const n = 4 + Math.floor(rand() * 4)
    for (let k = 0; k < n; k++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.7), fernMat)
      frond.position.y = 0.3
      frond.rotation.set(-0.5 - rand() * 0.6, (k / n) * Math.PI * 2 + rand() * 0.5, 0)
      g.add(frond)
    }
    g.position.set((rand() - 0.5) * 60, 0, -(1 + rand() * 45))
    g.scale.setScalar(0.6 + rand() * 1.0)
    markThin(g)
    scene.add(g)
  }
  // 倒木：地面的鳥（八色鳥）會站在旁邊
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 6, 9), makeToon('#4a3a2a'))
  log.rotation.z = Math.PI / 2
  log.rotation.y = 0.3
  log.position.set(-3, 0.3, -12)
  scene.add(log)
  // 結果的樹（五色鳥）：矮一點的樹，枝上有橘色果實
  const fruitTree = new THREE.Group()
  const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 4, 7), trunkMat)
  ft.position.y = 2
  fruitTree.add(ft)
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 6), trunkMat)
  branch.rotation.z = Math.PI / 2 - 0.25
  branch.position.set(1.3, 3.6, 0)
  fruitTree.add(branch)
  // 樹冠在橫枝上方，橫枝末端留給鳥站
  const fb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), makeToon('#4f7f3c'))
  fb.position.set(0, 5.9, 0)
  fruitTree.add(fb)
  const fruitMat = makeToon('#e07a2f')
  for (let i = 0; i < 24; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), fruitMat)
    const a = rand() * Math.PI * 2, r = 1.2 + rand() * 0.5
    f.position.set(Math.cos(a) * r, 5.3 + rand() * 1.2, Math.sin(a) * r)
    fruitTree.add(f)
  }
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), fruitMat)
    f.position.set(1.6 + i * 0.22, 3.75 - i * 0.05, (rand() - 0.5) * 0.2)
    fruitTree.add(f)
  }
  fruitTree.position.set(4, 0, -11)
  scene.add(fruitTree)
  // 枯枝：藍鵲與鶲愛站的橫枝
  const snag = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4.5, 6), makeToon('#7a6a58'))
  snag.rotation.z = Math.PI / 2 + 0.12
  snag.position.set(-6, 2.6, -15)
  scene.add(snag)
  const snagPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.6, 7), makeToon('#7a6a58'))
  snagPost.position.set(-8, 1.3, -15.2)
  scene.add(snagPost)
  // 觀景台：高機位
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), makeToon('#6f5a44'))
  deck.position.set(6, 2.9, 2)
  scene.add(deck)
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.9, 6), makeToon('#6f5a44'))
    leg.position.set(6 + dx, 1.45, 2 + dz)
    scene.add(leg)
  }

  const perches: Perch[] = [
    { position: new THREE.Vector3(6.0, 3.95, -11), along: new THREE.Vector3(1, 0, -0.1).normalize(), range: 1.0, sunSpot: { periodS: 70, onS: 28, phaseS: 0 } },   // 果樹橫枝末端（五色鳥）
    { position: new THREE.Vector3(-6, 2.9, -15), along: new THREE.Vector3(1, 0, 0), range: 3.2, sunSpot: { periodS: 70, onS: 28, phaseS: 35 } },                  // 枯枝（藍鵲、鶲）
    { position: new THREE.Vector3(-3, 0.66, -12), along: new THREE.Vector3(1, 0, 0.3).normalize(), range: 2.4, sunSpot: { periodS: 90, onS: 30, phaseS: 60 } }, // 倒木（八色鳥、畫眉）
    { position: new THREE.Vector3(1.5, 1.6, -19), along: new THREE.Vector3(1, 0, 0), range: 0.6 },                                                            // 陰影裡的矮枝
  ]
  // 光斑的視覺：一道從樹冠下來的光柱與一盞聚光燈，照到的時候才亮
  const beams: { light: THREE.SpotLight; mesh: THREE.Mesh; perch: Perch }[] = []
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })
  for (const p of perches) {
    if (!p.sunSpot) continue
    const light = new THREE.SpotLight('#fff1c0', 0, 14, 0.35, 0.6, 1.2)
    light.position.set(p.position.x + 1.5, p.position.y + 8, p.position.z + 2)
    light.target.position.copy(p.position)
    scene.add(light, light.target)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.2, 9, 12, 1, true), beamMat)
    mesh.position.set(p.position.x + 0.75, p.position.y + 4, p.position.z + 1)
    mesh.rotation.z = 0.18
    mesh.layers.set(FX_LAYER)
    mesh.visible = false
    scene.add(mesh)
    beams.push({ light, mesh, perch: p })
  }
  const hides: HideDef[] = [
    { id: 'trail', name: '林道上', description: '站在林道上，看得到果樹和枯枝，但頭頂的樹冠很厚，光很少', position: [0, 1.5, -2], yawDeg: 0 },
    { id: 'roots', name: '樹根下蹲著', description: '蹲在大樹根旁邊，離倒木最近，視線貼著地面', position: [-1.5, 0.7, -6], yawDeg: 8 },
    { id: 'deck', name: '觀景台', description: '三公尺高的木平台，站著跟果樹的橫枝差不多高，離枯枝遠一點', position: [6, 4.4, 2], yawDeg: 6 },
  ]
  let t = 0
  const update = (dt: number): void => {
    t += dt
    for (const b of beams) {
      const on = perchSunlit(b.perch, t)
      // 淡入淡出
      const target = on ? 1 : 0
      const cur = b.light.intensity / 420
      const next = cur + (target - cur) * Math.min(1, dt * 1.5)
      b.light.intensity = next * 420
      b.mesh.visible = next > 0.02
      ;(b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.1 * next
    }
  }
  const sunlit = (perch: Perch | null): boolean => !!perch && perchSunlit(perch, t)
  return { scene, sun, hemi, perches, hides, update, sunlit, dispose: () => { beamMat.dispose(); disposeScene(scene) } }
}
