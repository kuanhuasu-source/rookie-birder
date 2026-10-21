import * as THREE from 'three'
import { buildWorld } from './world/scene'
import { lightingPreset, applyLighting, type TimeOfDay, type Weather } from './world/lighting'
import { Pipeline } from './render/pipeline'
import { CameraState } from './camera/state'
import { Rig } from './camera/rig'
import { effectiveSigma } from './camera/shake'
import { Shooting } from './camera/body'
import { exposureMultiplier, noiseSigma, overStops } from './camera/exposure'
import { verticalFovDeg, cocPx, shakeBlurPx, lensSoftPx, totalBlurPx, mmToPx } from './camera/optics'
import { Input } from './core/input'
import { startLoop } from './core/loop'
import { Viewfinder } from './ui/viewfinder'
import { AlbumView } from './ui/album'
import { PhotoCapture, PHOTO_W } from './photo/capture'
import type { PhotoMetrics } from './photo/types'
import { Bird } from './birds/Bird'
import { Spawner } from './birds/spawner'
import { spottedDove } from './birds/species/spotted-dove'
import { playCall, unlockAudio } from './audio/call'

const CARD_CAPACITY = 60

const canvas = document.getElementById('view') as HTMLCanvasElement
const hudEl = document.getElementById('hud')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.toneMapping = THREE.NoToneMapping
renderer.outputColorSpace = THREE.LinearSRGBColorSpace

const world = buildWorld()
const camera = new THREE.PerspectiveCamera(10, 1.5, 0.3, 600)
camera.position.copy(world.hidePosition)

// 鳥
const bird = new Bird(spottedDove)
world.scene.add(bird.group)
const loader = new THREE.TextureLoader()
for (const key of ['side', '3q', 'takeoff'] as const) {
  loader.load(spottedDove.sprites[key].file, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; bird.setTexture(key, t) })
}
const spawner = new Spawner(bird, world.perches)
spawner.onCall = () => { playCall(spottedDove); callFlashT = 1.5 }
let callFlashT = 0

const cam = new CameraState('L1', 'B1', 'S0')
const rig = new Rig(camera)
let shooting = new Shooting(cam.body, CARD_CAPACITY)

let time: TimeOfDay = 'morning'
let weather: Weather = 'sunny'
let lighting = lightingPreset(time, weather)
applyLighting(world.scene, world.sun, world.hemi, lighting)

/** 觀景窗固定 3:2，置中於視窗。 */
function layout(): void {
  const margin = 24
  const availW = window.innerWidth - margin * 2
  const availH = window.innerHeight - margin * 2
  let w = availW
  let h = Math.round(w / 1.5)
  if (h > availH) { h = availH; w = Math.round(h * 1.5) }
  const left = Math.round((window.innerWidth - w) / 2)
  const top = Math.round((window.innerHeight - h) / 2)
  renderer.setSize(w, h)
  Object.assign(canvas.style, { left: `${left}px`, top: `${top}px` })
  Object.assign(hudEl.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` })
  camera.aspect = 1.5
  camera.updateProjectionMatrix()
  pipeline?.setSize(renderer.domElement.width, renderer.domElement.height)
}
let pipeline: Pipeline | null = null
layout()
pipeline = new Pipeline(renderer, renderer.domElement.width, renderer.domElement.height)
const capture = new PhotoCapture(renderer)
const hud = new Viewfinder(hudEl)
const album = new AlbumView(() => {})
window.addEventListener('resize', layout)

/** 把雲台轉向第一個停棲點（原型用：機位本來就面向枝頭）。 */
function aimAtPerch(): void {
  const d = world.perches[0].position.clone().sub(camera.position).normalize()
  rig.yaw = Math.atan2(-d.x, -d.z)
  rig.pitch = Math.asin(d.y)
}
function aimAtBird(): void {
  if (!bird.inScene) { aimAtPerch(); return }
  const target = new THREE.Vector3()
  bird.eye.getWorldPosition(target)
  const d = target.sub(camera.position).normalize()
  rig.yaw = Math.atan2(-d.x, -d.z)
  rig.pitch = Math.asin(d.y)
}
aimAtPerch()
rig.shake.sigma = effectiveSigma(cam.support.shakeMul, cam.lens.isStops)

let overview = false
let helpVisible = true
let hint = ''
let shutterDown = false
let halfPress = false
let flashT = 0

function setLighting(): void {
  lighting = lightingPreset(time, weather)
  applyLighting(world.scene, world.sun, world.hemi, lighting)
}

function setGear(lens: string, body: string, support: string): void {
  const n = new CameraState(lens, body, support)
  cam.lens = n.lens; cam.body = n.body; cam.support = n.support; cam.settings = n.settings
  shooting = new Shooting(cam.body, shooting.cardLeft)
  rig.shake.sigma = effectiveSigma(cam.support.shakeMul, cam.lens.isStops)
  lag.length = 0
}

new Input(canvas, {
  onLook: (dx, dy) => { if (!album.open) rig.addMouse(dx, dy, renderer.domElement.clientHeight) },
  onFocusRing: (d) => cam.focusBy(d),
  onZoom: (steps) => cam.zoom(steps),
  onShutter: (down) => { shutterDown = down && !overview; unlockAudio() },
  onHalfPress: (down) => { halfPress = down },
  onKey: (code) => {
    unlockAudio()
    if (album.open) { if (code === 'Escape' || code === 'KeyG') album.hide(); return }
    switch (code) {
      case 'KeyQ': cam.stepAperture(-1); break
      case 'KeyE': cam.stepAperture(1); break
      case 'KeyA': cam.stepShutter(-1); break
      case 'KeyD': cam.stepShutter(1); break
      case 'KeyZ': cam.stepIso(-1); break
      case 'KeyC': cam.stepIso(1); break
      case 'Tab': overview = !overview; break
      case 'KeyH': helpVisible = !helpVisible; break
      case 'KeyB': bird.forceTakeoff(); break
      case 'KeyN': spawner.spawnNow(); break
      case 'KeyG': document.exitPointerLock(); void album.show(); break
      case 'Digit1': time = 'dawn'; setLighting(); break
      case 'Digit2': time = 'morning'; setLighting(); break
      case 'Digit3': time = 'noon'; setLighting(); break
      case 'Digit4': time = 'dusk'; setLighting(); break
      case 'Digit5': weather = 'sunny'; setLighting(); break
      case 'Digit6': weather = 'overcast'; setLighting(); break
      case 'Digit7': setGear('L1', 'B1', 'S0'); break
      case 'Digit8': setGear('L3', 'B3', 'S0'); break
      case 'Digit9': setGear('L4', 'B4', 'S4'); break
    }
  },
})

// 觀景窗延遲：環形緩衝保存最近幾幀的真實姿態
const lag: THREE.Quaternion[] = []
const trueQuat = new THREE.Quaternion()

const eyeWorld = new THREE.Vector3()
const eyePrevWorld = new THREE.Vector3()
const tmpNdc = new THREE.Vector3()
const birdVelPx = new THREE.Vector2()   // 鳥眼自身移動在照片像素上的速度
let eyePrevValid = false

/** 以目前相機投影鳥眼現在與上一幀的位置，差值就是鳥自己的移動（不含雲台）。 */
function measureBird(dt: number): PhotoMetrics {
  const s = cam.settings
  const sensor = cam.sensor
  const base: PhotoMetrics = {
    birdInFrame: false, distM: 0, cocPx: 0, motionPx: 0,
    shakePx: shakeBlurPx(s.focalMm, Math.hypot(rig.shake.omegaYaw + rig.panOmegaYaw, rig.shake.omegaPitch + rig.panOmegaPitch), s.shutterS, sensor, PHOTO_W),
    softPx: lensSoftPx(cam.lens.softWideOpenPx, s.fNumber, cam.maxAperture), totalBlurPx: 0,
    overStops: overStops(lighting.evScene, s.fNumber, s.shutterS, s.iso),
    noiseSigma: noiseSigma(cam.body.kNoise, s.iso),
    eyeX: 0, eyeY: 0, birdHeightFrac: 0,
    species: spottedDove.id,
  }
  if (!bird.inScene) { eyePrevValid = false; birdVelPx.set(0, 0); return base }

  bird.eye.getWorldPosition(eyeWorld)
  const dist = eyeWorld.distanceTo(camera.position)
  tmpNdc.copy(eyeWorld).project(camera)
  const ex = tmpNdc.x * 0.5 + 0.5
  const ey = tmpNdc.y * 0.5 + 0.5
  const inFrame = ex > 0 && ex < 1 && ey > 0 && ey < 1 && tmpNdc.z < 1
  if (eyePrevValid && dt > 0) {
    const p = tmpNdc.clone()
    const q = eyePrevWorld.clone().project(camera)
    birdVelPx.set(((p.x - q.x) * 0.5 * PHOTO_W) / dt, ((p.y - q.y) * 0.5 * (PHOTO_W / 1.5)) / dt)
  } else birdVelPx.set(0, 0)
  eyePrevWorld.copy(eyeWorld)
  eyePrevValid = true

  const coc = cocPx(s.focalMm, s.fNumber, s.focusM, dist, sensor, PHOTO_W)
  const motion = birdVelPx.length() * s.shutterS
  const total = totalBlurPx({ coc, motion, shake: base.shakePx, soft: base.softPx })
  const focalPx = mmToPx(s.focalMm, sensor, PHOTO_W)
  const birdHeightPx = (spottedDove.bodyHeightM / dist) * focalPx
  return {
    ...base,
    birdInFrame: inFrame, distM: dist, cocPx: coc, motionPx: motion, totalBlurPx: total,
    eyeX: ex, eyeY: ey, birdHeightFrac: birdHeightPx / (PHOTO_W / 1.5),
    birdState: bird.state, viewAngleDeg: bird.viewAngleDeg,
  }
}

function takePhoto(m: PhotoMetrics): void {
  const s = cam.settings
  const rec = capture.capture({
    scene: world.scene,
    camera,
    birdPapers: bird.inScene ? [bird.paper] : [],
    settings: { ...s },
    gear: { lens: cam.lens.id, body: cam.body.id, support: cam.support.id },
    lighting: { time, weather, evScene: lighting.evScene },
    metrics: m,
    sensorWmm: cam.sensor.widthMm,
    exposureMul: exposureMultiplier(lighting.evScene, s.fNumber, s.shutterS, s.iso),
    noiseSigma: noiseSigma(cam.body.kNoise, s.iso),
    camOmega: new THREE.Vector2(rig.shake.omegaYaw + rig.panOmegaYaw, rig.shake.omegaPitch + rig.panOmegaPitch),
    birdVelPx: birdVelPx.clone(),
  })
  if (rec) { flashT = 0.08; rec.catch((e) => console.error('photo failed', e)) }
}

const STATE_LABEL: Record<string, string> = { S1: '靜止', S2: '小動作', S3: '跳枝', S4: '起飛/降落', S5: '飛行' }

let seed = 0
let lastMetrics: PhotoMetrics | null = null
startLoop((dt) => {
  const s = cam.settings
  camera.fov = overview ? 60 : verticalFovDeg(s.focalMm, cam.sensor)
  camera.updateProjectionMatrix()
  rig.shake.sigma = overview ? 0 : effectiveSigma(cam.support.shakeMul, cam.lens.isStops)
  rig.update(dt)
  trueQuat.copy(camera.quaternion)
  flashT = Math.max(0, flashT - dt)
  callFlashT = Math.max(0, callFlashT - dt)

  spawner.update(dt)
  bird.update(dt, camera.position)

  // 量測與拍照都用真實姿態
  const metrics = measureBird(dt)
  lastMetrics = metrics
  const shots = shooting.update(dt, shutterDown && !album.open)
  for (let i = 0; i < shots; i++) takePhoto(metrics)

  // 觀景窗延遲
  lag.push(trueQuat.clone())
  const lagFrames = overview ? 0 : cam.body.evfLagFrames
  while (lag.length > lagFrames + 1) lag.shift()
  camera.quaternion.copy(lag[0])

  seed = (seed + 1) % 1000
  if (!album.open) {
    pipeline!.render(world.scene, camera, {
      focalMm: s.focalMm,
      fNumber: s.fNumber,
      focusM: s.focusM,
      sensorWmm: cam.sensor.widthMm,
      exposureMul: overview ? 1 : exposureMultiplier(lighting.evScene, s.fNumber, s.shutterS, s.iso),
      noiseSigma: overview ? 0 : noiseSigma(cam.body.kNoise, s.iso),
      dofEnabled: !overview,
      styleStrength: overview ? 0.6 : 1,
      seed,
      quality: 'live',
    }, null)
  }
  camera.quaternion.copy(trueQuat)

  if (shooting.cardLeft <= 0) hint = '記憶卡滿了，按 G 看相簿'
  else if (callFlashT > 0) hint = '♪ 咕—咕—咕（有鳥要來了）'
  else if (halfPress) hint = cam.body.afTier === 0 ? '這台機身只有手動對焦' : '半按快門'
  else if (!document.pointerLockElement && !album.open) hint = '點一下畫面開始（滑鼠鎖定）'
  else hint = ''

  const m = metrics
  const birdInfo = bird.inScene
    ? `${STATE_LABEL[bird.state]}${m.birdInFrame ? `  鳥眼 ${m.distM.toFixed(1)}m  模糊圈 ${m.cocPx.toFixed(1)}px  動態 ${m.motionPx.toFixed(1)}px` : '  鳥不在畫面內'}  手震 ${m.shakePx.toFixed(1)}px`
    : `等待中 ${Math.max(0, spawner.timer).toFixed(0)}s  手震 ${m.shakePx.toFixed(1)}px`
  hud.update(cam, {
    overview,
    evScene: lighting.evScene,
    overStops: m.overStops,
    blurInfo: birdInfo,
    helpVisible,
    hint,
    cardLeft: shooting.cardLeft,
    buffer: shooting.buffer,
    bufferMax: cam.body.bufferFrames,
    blackout: shooting.blackoutT > 0,
    flash: flashT > 0,
  })
})

// 給測試與截圖腳本用
;(window as unknown as { __game: unknown }).__game = {
  cam, rig, world, camera, capture, album, bird, spawner, shooting: () => shooting,
  setLighting: (t: TimeOfDay, w: Weather) => { time = t; weather = w; setLighting() },
  setOverview: (v: boolean) => { overview = v },
  setHelp: (v: boolean) => { helpVisible = v },
  setGear,
  aimAtBird,
  shoot: () => { if (lastMetrics) takePhoto(lastMetrics) },
  metrics: () => lastMetrics,
}
