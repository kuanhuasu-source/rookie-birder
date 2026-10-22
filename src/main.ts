import * as THREE from 'three'
import { buildScene, type World } from './world/scene'
import { lightingPreset, applyLighting, type TimeOfDay, type Weather } from './world/lighting'
import { Pipeline } from './render/pipeline'
import { CameraState } from './camera/state'
import { Rig } from './camera/rig'
import { effectiveSigma } from './camera/shake'
import { Shooting } from './camera/body'
import { Autofocus, AF_LABEL, type AfTier } from './camera/autofocus'
import { AlertModel } from './birds/alert'
import { exposureMultiplier, noiseSigma, overStops } from './camera/exposure'
import { verticalFovDeg, cocPx, shakeBlurPx, lensSoftPx, totalBlurPx, mmToPx, motionBlurPx } from './camera/optics'
import { Input, isTouchDevice } from './core/input'
import { TouchControls, TOUCH_COLUMN_PX } from './ui/touch'
import { loadSave, storeSave } from './progress/save'
import { updateGuide } from './progress/guide'
import { checkAchievements } from './progress/achievements'
import { GuideView } from './ui/guide'
import { GearView } from './ui/gear'
import { LevelView } from './ui/levels'
import { SummaryView } from './ui/summary'
import { KnowledgeView } from './ui/knowledge'
import { LEVELS, LEVEL_BY_ID } from './levels/data'
import { LevelSession } from './levels/session'
import type { LevelDef, HideDef } from './levels/types'
import { startLoop } from './core/loop'
import { Viewfinder } from './ui/viewfinder'
import { AlbumView } from './ui/album'
import { PhotoCapture, PHOTO_W } from './photo/capture'
import type { PhotoMetrics } from './photo/types'
import { Bird } from './birds/Bird'
import { BIRD_LAYER, THIN_LAYER, FX_LAYER, COMPANION_LAYER } from './render/mask'
import { loadQuality, storeQuality, type Quality } from './render/quality'
import { Spawner } from './birds/spawner'
import { spottedDove } from './birds/species/spotted-dove'
import { SPECIES, PARK_WEIGHTS, speciesName } from './birds/species'
import { FIDGET_MS } from './birds/types'
import { playCall, playBeep, unlockAudio } from './audio/call'
import { coinsFor, starString } from './photo/score'
import { TutorialRunner } from './tutorial/runner'
import { STEPS } from './tutorial/steps'
import type { TutorialCtx, Control } from './tutorial/types'
import { Chalkboard } from './ui/chalkboard'

const CARD_CAPACITY = 60

const canvas = document.getElementById('view') as HTMLCanvasElement
const hudEl = document.getElementById('hud')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
const TOUCH = isTouchDevice()
/** 開發者模式：網址加 ?dev=1，開放加代幣與換器材的除錯鍵 */
const DEV = new URLSearchParams(location.search).has('dev')
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1 : 1.5))
renderer.toneMapping = THREE.NoToneMapping
renderer.outputColorSpace = THREE.LinearSRGBColorSpace

let world: World = buildScene('park')
const camera = new THREE.PerspectiveCamera(10, 1.5, 0.3, 600)
camera.position.set(...world.hides[0].position)
camera.layers.enable(BIRD_LAYER)
camera.layers.enable(THIN_LAYER)
camera.layers.enable(FX_LAYER)
camera.layers.enable(COMPANION_LAYER)

// 鳥：每種一隻，同時只有一隻在場
const birds: Bird[] = SPECIES.map((sp) => new Bird(sp))
// 群體的伴鳥：每種成群的鳥多幾隻備用
const companions: Record<string, Bird[]> = {}
for (const sp of SPECIES) if (sp.flock) companions[sp.id] = Array.from({ length: sp.flock.max - 1 }, () => { const b = new Bird(sp); b.markCompanion(); return b })
const allBirds: Bird[] = [...birds, ...Object.values(companions).flat()]
for (const b of allBirds) world.scene.add(b.group)
const dove = birds.find((b) => b.species === spottedDove)!
const loader = new THREE.TextureLoader()
for (const b of allBirds) {
  for (const key of ['side', '3q', 'takeoff'] as const) {
    loader.load(import.meta.env.BASE_URL + b.species.sprites[key].file, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; b.setTexture(key, t) })
  }
}
let spawner = new Spawner(birds, world.perches, Math.random, PARK_WEIGHTS)
spawner.companions = companions
let callFlashT = 0
let callName = ''
function wireSpawner(sp: Spawner): void { sp.onCall = (b) => { playCall(b.species); callFlashT = 1.5; callName = b.species.nameZh } }
wireSpawner(spawner)
/** 目前要量測與拍的鳥：教學時是斑鳩，否則是 spawner 放出來的那隻。 */
function activeBird(): Bird | null { return tutorial.active ? dove : spawner.current }

let toast = ''
let toastT = 0

// 教學
const tutorial = new TutorialRunner(STEPS)
const TUTORIAL_KEY = 'rookie-birder.tutorialDone'
let lockToastT = 0
/** 教學中被鎖住的操作：回傳 false 並提示玩家這一步先練什麼。 */
function allowed(c: Control): boolean {
  if (tutorial.allowed(c)) return true
  if (lockToastT <= 0 && tutorial.step) {
    toast = `第零課第 ${tutorial.index + 1} 頁先練「${tutorial.step.title}」，這個操作等一下再用`
    toastT = 2
    lockToastT = 2
  }
  return false
}

const save = loadSave()
const cam = new CameraState(save.equipped.lens, save.equipped.body, save.equipped.support)
cam.setAccessories(save.equipped.accessories)
const alert = new AlertModel()
let alertFlushes = 0
let scareToastT = 0
const rig = new Rig(camera)
let shooting = new Shooting(cam.body, CARD_CAPACITY)
const af = new Autofocus()
const afRay = new THREE.Raycaster()
afRay.layers.set(0); afRay.layers.enable(BIRD_LAYER); afRay.layers.enable(THIN_LAYER)   // 鳥與細長層都要打得到，特效層不算
const afCenter = new THREE.Vector2(0, 0)
/** 畫面中心打到的距離；沒打到東西回 null。 */
function centerDistance(): number | null {
  afRay.setFromCamera(afCenter, camera)
  afRay.far = 300
  const hit = afRay.intersectObjects(world.scene.children, true).find((h) => h.object.visible)
  return hit ? hit.distance : null
}

let time: TimeOfDay = 'morning'
let weather: Weather = 'sunny'
let lighting = lightingPreset(time, weather)
applyLighting(world.scene, world.sun, world.hemi, lighting)

/** 觀景窗固定 3:2，置中於視窗。 */
function layout(): void {
  const margin = TOUCH ? 8 : 24
  const rotate = document.getElementById('rotate')
  if (rotate) rotate.classList.toggle('hidden', !(TOUCH && window.innerHeight > window.innerWidth))
  // 觸控時兩側留給按鈕欄
  const availW = window.innerWidth - margin * 2 - (TOUCH ? TOUCH_COLUMN_PX * 2 : 0)
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
const chalk = new Chalkboard(hudEl, TOUCH, () => { if (tutorial.active) endTutorial() })
const album = new AlbumView(() => {})
let session: LevelSession | null = null
let currentLevel: LevelDef = LEVELS[0]
let currentHide: HideDef = world.hides[0]
const questsDone = new Set<string>()
for (const id of save.questsDone) questsDone.add(id)
let knowReturn = false
const knowledge = new KnowledgeView(() => { if (knowReturn) { knowReturn = false; levelView.show() } })
const levelView = new LevelView(() => questsDone, (l, h) => startLevel(l, h), (what) => {
  levelView.hide()
  if (what === 'guide') { void guide.show(); guideReturn = true }
  else if (what === 'gear') { gearView.show(); gearReturn = true }
  else if (what === 'knowledge') { knowledge.show(); knowReturn = true }
  else startTutorial()
})
// 從主畫面打開圖鑑或裝備，關閉後回主畫面
let guideReturn = false
let gearReturn = false
const summaryView = new SummaryView(() => startLevel(currentLevel, currentHide), () => levelView.show())
const guide = new GuideView(() => save, () => { if (guideReturn) { guideReturn = false; levelView.show() } })
const gearView = new GearView(() => save, () => { checkAchievements(save); storeSave(save); applyEquipped() }, () => { if (gearReturn) { gearReturn = false; levelView.show() } })
/** 任一全螢幕頁打開時暫停拍攝輸入。 */
function overlayOpen(): boolean { return album.open || guide.open || gearView.open || levelView.open || summaryView.open || knowledge.open }
function applyEquipped(): void {
  if (cam.lens.id !== save.equipped.lens || cam.body.id !== save.equipped.body || cam.support.id !== save.equipped.support) setGear(save.equipped.lens, save.equipped.body, save.equipped.support)
  cam.setAccessories(save.equipped.accessories)
  cam.clampAperture()
}
window.addEventListener('resize', layout)

/** 把雲台轉向第一個停棲點（原型用：機位本來就面向枝頭）。 */
function aimAtPerch(): void {
  const d = world.perches[0].position.clone().sub(camera.position).normalize()
  rig.yaw = Math.atan2(-d.x, -d.z)
  rig.pitch = Math.asin(d.y)
}

/** 換關：重建場景、擺機位、設光線、換鳥群與計時。 */
function startLevel(level: LevelDef, hide: HideDef): void {
  currentLevel = level
  currentHide = hide
  for (const b of allBirds) { if (b.inScene) { b.inScene = false; b.group.visible = false }; world.scene.remove(b.group) }
  world.dispose()
  world = buildScene(level.sceneId)
  for (const b of allBirds) world.scene.add(b.group)
  time = level.time
  weather = level.weather
  setLighting()
  camera.position.set(...hide.position)
  rig.yaw = (hide.yawDeg * Math.PI) / 180
  rig.pitch = 0
  const roster = birds.filter((b) => (level.species[b.species.id] ?? 0) > 0)
  spawner = new Spawner(roster.length ? roster : birds, world.perches, Math.random, level.species, level.intervalMul)
  spawner.companions = companions
  wireSpawner(spawner)
  shooting = new Shooting(cam.body, level.cardCapacity)
  session = new LevelSession(level, questsDone)
  lag.length = 0
  eyePrevValid = false
  levelView.hide()
  summaryView.hide()
}

/** 收工：結算並回關卡頁。 */
function endLevel(): void {
  if (!session) { levelView.show(); return }
  const sum = session.end()
  session = null
  document.exitPointerLock()
  for (const b of allBirds) if (b.inScene) b.forceTakeoff()
  void summaryView.show(sum)
}
function aimAtBird(): void {
  const bird = activeBird()
  if (!bird || !bird.inScene) { aimAtPerch(); return }
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
let quality: Quality = loadQuality(TOUCH ? 'low' : 'high')
Pipeline.lowQuality = quality === 'low'
function setQuality(q: Quality): void { quality = q; Pipeline.lowQuality = q === 'low'; storeQuality(q); toast = q === 'low' ? '畫質：低（關掉前景紗幕、景深取樣減半，照片不受影響）' : '畫質：高'; toastT = 2.5 }
const REDUCE_KEY = 'rookie-birder.reduceShake'
let reduceShake = false
try { reduceShake = localStorage.getItem(REDUCE_KEY) === '1' } catch { /* 私密視窗 */ }
let bracing = false

function setLighting(): void {
  lighting = lightingPreset(time, weather, { sunAzDeg: currentLevel?.sunAzDeg, shadeEv: currentLevel?.shadeEv })
  applyLighting(world.scene, world.sun, world.hemi, lighting)
}

function setGear(lens: string, body: string, support: string): void {
  const n = new CameraState(lens, body, support)
  cam.lens = n.lens; cam.body = n.body; cam.support = n.support; cam.settings = n.settings
  cam.setAccessories(save.equipped.accessories)
  shooting = new Shooting(cam.body, shooting.cardLeft)
  rig.shake.sigma = effectiveSigma(cam.support.shakeMul, cam.lens.isStops)
  lag.length = 0
}

let braceTouch = false
/** 觸控點一下快門，按下與放開可能在同一幀內，所以另外記一個「至少拍一張」 */
let pendingShot = false
function handleKey(code: string): void {
    unlockAudio()
    if (album.open) { if (code === 'Escape' || code === 'KeyG') album.hide(); return }
    if (guide.open) { if (code === 'Escape' || code === 'KeyK') guide.hide(); return }
    if (gearView.open) { if (code === 'Escape' || code === 'KeyU') gearView.hide(); return }
    if (knowledge.open) { if (code === 'Escape' || code === 'KeyI') knowledge.hide(); return }
    if (levelView.open || summaryView.open) return
    if (tutorial.active && code === 'Escape') { endTutorial(); return }
    if (code === 'KeyT') { startTutorial(); return }
    switch (code) {
      case 'KeyQ': if (allowed('aperture')) cam.stepAperture(-1); break
      case 'KeyE': if (allowed('aperture')) cam.stepAperture(1); break
      case 'KeyA': if (allowed('shutter')) cam.stepShutter(-1); break
      case 'KeyD': if (allowed('shutter')) cam.stepShutter(1); break
      case 'KeyZ': if (allowed('iso')) cam.stepIso(-1); break
      case 'KeyC': if (allowed('iso')) cam.stepIso(1); break
      case 'Tab': if (allowed('overview')) { overview = !overview; touchUi?.setOverview(overview) } break
      case 'KeyH': helpVisible = !helpVisible; break
      case 'KeyY': setQuality(quality === 'low' ? 'high' : 'low'); break
      case 'KeyV': reduceShake = !reduceShake; try { localStorage.setItem(REDUCE_KEY, reduceShake ? '1' : '0') } catch { /* 私密視窗 */ } break
      case 'KeyB': if (!tutorial.active) spawner.current?.forceTakeoff(); break
      case 'KeyN': if (!tutorial.active) spawner.spawnNow(); break
      case 'KeyG': document.exitPointerLock(); tutorial.noteAlbumOpen(); void album.show(); break
      case 'KeyK': document.exitPointerLock(); void guide.show(); break
      case 'KeyU': document.exitPointerLock(); gearView.show(); break
      case 'KeyX': if (!tutorial.active) endLevel(); break
      case 'KeyI': document.exitPointerLock(); knowledge.show(); break
      case 'Digit1': time = 'dawn'; setLighting(); break
      case 'Digit2': time = 'morning'; setLighting(); break
      case 'Digit3': time = 'noon'; setLighting(); break
      case 'Digit4': time = 'dusk'; setLighting(); break
      case 'Digit5': weather = 'sunny'; setLighting(); break
      case 'Digit6': weather = 'overcast'; setLighting(); break
      case 'Digit7': if (DEV) setGear('L1', 'B1', 'S0'); break
      case 'Digit8': if (DEV) setGear('L3', 'B3', 'S0'); break
      case 'Digit9': if (DEV) setGear('L4', 'B4', 'S4'); break
      case 'Digit0': if (DEV) { save.coins += 100; storeSave(save); toast = '開發者模式：+100 代幣'; toastT = 2 } break
    }
}

const input = new Input(canvas, {
  onLook: (dx, dy) => { if (!overlayOpen()) rig.addMouse(dx, dy, renderer.domElement.clientHeight) },
  onFocusRing: (d) => { if (allowed('focus')) cam.focusBy(d) },
  onZoom: (steps) => { if (allowed('zoom')) cam.zoom(steps) },
  onShutter: (down) => { shutterDown = down && !overview && allowed('shoot'); unlockAudio() },
  onHalfPress: (down) => { halfPress = down },
  onKey: handleKey,
})
const touchUi = TOUCH ? new TouchControls(hudEl, DEV, {
  onKey: handleKey,
  onShutter: (down) => { shutterDown = down && !overview && allowed('shoot'); if (shutterDown) pendingShot = true; unlockAudio() },
  onBrace: (down) => { braceTouch = down },
  onFocusT: (t) => { if (allowed('focus')) cam.setFocusT(t) },
  onHalfPress: (down) => { halfPress = down },
}) : null

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
  const o = cam.optics
  const sensor = cam.sensor
  const bird = activeBird()
  const base: PhotoMetrics = {
    birdInFrame: false, distM: 0, cocPx: 0, motionPx: 0,
    shakePx: shakeBlurPx(o.focalMm, Math.hypot(rig.shake.omegaYaw + rig.panOmegaYaw, rig.shake.omegaPitch + rig.panOmegaPitch), s.shutterS, sensor, PHOTO_W),
    softPx: lensSoftPx(o.softPx, o.fNumber, cam.maxAperture * Math.pow(Math.SQRT2, cam.mods.apertureStops)), totalBlurPx: 0,
    overStops: overStops(lighting.evScene, o.fNumber, s.shutterS, s.iso),
    noiseSigma: noiseSigma(cam.body.kNoise, s.iso),
    eyeX: 0, eyeY: 0, birdHeightFrac: 0,
    species: bird?.species.id,
  }
  if (!bird || !bird.inScene || bird.submerged) { eyePrevValid = false; birdVelPx.set(0, 0); return base }

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

  // 光線方向：鳥到相機的方向與太陽方向的夾角
  const toCam = camera.position.clone().sub(eyeWorld).normalize()
  const lightAngleDeg = (Math.acos(Math.min(1, Math.max(-1, toCam.dot(lighting.sunDir)))) * 180) / Math.PI
  const pitchDeg = (Math.asin(-toCam.y) * 180) / Math.PI

  const coc = cocPx(o.focalMm, o.fNumber, s.focusM, dist, sensor, PHOTO_W)
  // 動態模糊取「量到的移動」與「微動下限」較大者
  const motion = Math.max(birdVelPx.length() * s.shutterS, motionBlurPx(o.focalMm, FIDGET_MS[bird.state], dist, s.shutterS, sensor, PHOTO_W))
  const total = totalBlurPx({ coc, motion, shake: base.shakePx, soft: base.softPx })
  const focalPx = mmToPx(o.focalMm, sensor, PHOTO_W)
  const birdHeightPx = (bird.species.bodyHeightM / dist) * focalPx
  return {
    ...base,
    birdInFrame: inFrame, distM: dist, cocPx: coc, motionPx: motion, totalBlurPx: total,
    eyeX: ex, eyeY: ey, birdHeightFrac: birdHeightPx / (PHOTO_W / 1.5),
    birdState: bird.state, viewAngleDeg: bird.viewAngleDeg, albedo: bird.albedo, facing: bird.facing,
    sunlit: bird.lightMul > 1,
    lightAngleDeg, pitchDeg,
  }
}

function takePhoto(m: PhotoMetrics): void {
  const s = cam.settings
  const bird = activeBird()
  const o = cam.optics
  const rec = capture.capture({
    scene: world.scene,
    camera,
    birdPapers: bird && bird.inScene ? [bird.paper] : [],
    settings: { ...s, focalMm: o.focalMm, fNumber: o.fNumber },
    gear: { lens: cam.lens.id, body: cam.body.id, support: cam.support.id },
    lighting: { time, weather, evScene: lighting.evScene },
    metrics: m,
    sensorWmm: cam.sensor.widthMm,
    exposureMul: exposureMultiplier(lighting.evScene, o.fNumber, s.shutterS, s.iso),
    noiseSigma: noiseSigma(cam.body.kNoise, s.iso),
    camOmega: new THREE.Vector2(rig.shake.omegaYaw + rig.panOmegaYaw, rig.shake.omegaPitch + rig.panOmegaPitch),
    birdVelPx: birdVelPx.clone(),
    cocAt: (d: number) => cocPx(cam.optics.focalMm, cam.optics.fNumber, cam.settings.focusM, d, cam.sensor, PHOTO_W),
  })
  if (rec) {
    flashT = 0.08
    rec.then((p) => {
      tutorial.notePhoto(p)
      const earned = coinsFor(p.score.stars)
      save.coins += earned
      const gu = updateGuide(save, p)
      const fresh = session?.onPhoto(p, earned + (gu?.bonus ?? 0)) ?? []
      for (const qq of fresh) save.coins += qq.reward
      save.questsDone = [...questsDone]
      const unlocked = checkAchievements(save)
      storeSave(save)
      if (unlocked.length) { toast = `成就解鎖：「${unlocked[0].title}」${unlocked[0].desc} +${unlocked[0].reward} 代幣`; toastT = 4; return }
      if (fresh.length) { toast = `任務完成：${fresh[0].title} +${fresh[0].reward} 代幣`; toastT = 3.5; return }
      if (gu?.bonus) { toast = `圖鑑：${speciesName(gu.species)}${gu.newSpecies ? '新鳥種' : '新格子'} +${gu.bonus} 代幣`; toastT = 3; return }
      const who = p.metrics.birdInFrame ? `${speciesName(p.metrics.species)}  ` : ''
      toast = `${starString(p.score.stars)} ${Math.round(p.score.total)} 分  ${who}${p.score.advice}`
      toastT = 3
    }).catch((e) => console.error('photo failed', e))
  }
}

/** 教學步驟看到的世界。 */
const tutorialCtx: TutorialCtx = {
  settings: cam.settings,
  overview: false,
  metrics: null,
  photos: [],
  albumOpened: false,
  birdState: 'S1',
  birdInScene: false,
  elapsed: 0,
  setFocal: (mm) => { cam.settings.focalMm = Math.min(cam.lens.focalMax, Math.max(cam.lens.focalMin, mm)); cam.clampAperture() },
  setFocus: (m) => { cam.settings.focusM = m },
  setExposure: (f, t, iso) => { if (f !== null) cam.settings.fNumber = f; if (t !== null) cam.settings.shutterS = t; if (iso !== null) cam.settings.iso = iso; cam.clampAperture() },
  setLighting: (t, w) => { time = t; weather = w; setLighting() },
  aimOffset: (y, p) => { aimAtPerch(); rig.yaw += y; rig.pitch += p },
  birdPlace: () => { dove.scripted = true; dove.placeOnPerch(world.perches[0], 0) },
  birdScript: (st) => dove.scriptState(st),
  birdTakeoff: () => dove.forceTakeoff(),
  birdReenter: () => { const p = world.perches[0]; dove.enter(p, p.position.clone().add(new THREE.Vector3(9, 5, -3))) },
  giveCoins: (n) => { save.coins += n; storeSave(save) },
}

function startTutorial(): void {
  levelView.hide()
  summaryView.hide()
  if (currentLevel.sceneId !== 'park') { const w = buildScene('park'); const bench = w.hides[0]; w.dispose(); startLevel(LEVELS[0], bench) }
  session = null
  overview = false
  helpVisible = false
  // 把場上的鳥清掉，教學只用斑鳩
  for (const b of allBirds) if (b.inScene) { b.inScene = false; b.group.visible = false }
  spawner.current = null
  tutorialCtx.settings = cam.settings
  tutorial.start(tutorialCtx)
}

function endTutorial(): void {
  tutorial.stop()
  dove.scripted = false
  if (dove.inScene) dove.forceTakeoff()
  spawner.reset(dove.inScene ? 10 : 6)
  try { localStorage.setItem(TUTORIAL_KEY, '1') } catch { /* 私密視窗 */ }
  // 下課後回主畫面選關；教學中的關卡不結算
  session = null
  document.exitPointerLock()
  levelView.show()
}
tutorial.onFinished = endTutorial

const STATE_LABEL: Record<string, string> = { S1: '靜止', S2: '小動作', S3: '跳枝', S4: '起飛/降落', S5: '飛行' }

let seed = 0
let lastMetrics: PhotoMetrics | null = null
startLoop((dt) => {
  const s = cam.settings
  const o = cam.optics
  camera.fov = overview ? 60 : verticalFovDeg(o.focalMm, cam.sensor)
  camera.updateProjectionMatrix()
  // 穩住：按住 Shift，手震減半、雲台變慢（模擬撐著、蹲低）
  bracing = (input.held.has('ShiftLeft') || input.held.has('ShiftRight') || braceTouch) && !overlayOpen()
  rig.sensitivity = bracing ? 0.5 : 1
  rig.shake.sigma = overview ? 0 : effectiveSigma(cam.support.shakeMul, cam.lens.isStops) * (bracing ? 0.5 : 1)
  rig.update(dt)
  trueQuat.copy(camera.quaternion)
  // 鍵盤對焦環：按住持續轉
  const fdir = input.focusKeyDir()
  if (fdir !== 0 && allowed('focus') && !overlayOpen()) cam.focusBy(fdir * dt * 0.35)
  flashT = Math.max(0, flashT - dt)
  toastT = Math.max(0, toastT - dt)
  lockToastT = Math.max(0, lockToastT - dt)
  callFlashT = Math.max(0, callFlashT - dt)

  if (!tutorial.active && session && !overlayOpen()) {
    spawner.update(dt)
    session.update(dt)
    if (session.timeUp) { endLevel(); return }
  }
  for (const b of allBirds) b.update(dt, camera.position)
  const bird = activeBird()
  // 光斑：停棲點被照到時鳥亮兩格
  world.update?.(dt)
  for (const b of allBirds) if (b.inScene) b.setLightMul(world.sunlit?.(b.currentPerch) ? 4 : 1)

  // 自動對焦：教學中一律手動
  const tier: AfTier = tutorial.active ? 0 : cam.body.afTier
  if (!overview && !overlayOpen()) {
    const b = activeBird()
    const eyeDist = b && b.inScene && lastMetrics?.birdInFrame ? lastMetrics.distM : null
    s.focusM = af.update(dt, s.focusM, {
      halfPressed: halfPress, tier, lensSpeed: o.afSpeed,
      centerDistM: halfPress && tier > 0 ? centerDistance() : null, eyeDistM: eyeDist,
      minFocusM: cam.lens.minFocusM, maxFocusM: 200,
    })
    if (af.justLocked) playBeep()
  }

  // 量測與拍照都用真實姿態
  const metrics = measureBird(dt)
  lastMetrics = metrics
  if (tutorial.active) {
    tutorialCtx.settings = cam.settings
    tutorialCtx.overview = overview
    tutorialCtx.metrics = metrics
    tutorialCtx.birdState = dove.state
    tutorialCtx.birdInScene = dove.inScene
    tutorial.update(dt, tutorialCtx)
  }
  const shots = shooting.update(dt, (shutterDown || pendingShot) && !overlayOpen())
  pendingShot = false
  for (let i = 0; i < shots; i++) takePhoto(metrics)

  // 驚嚇：只對停棲中的鳥，教學中不嚇
  scareToastT = Math.max(0, scareToastT - dt)
  spawner.intervalMul = currentLevel.intervalMul * cam.mods.intervalMul
  if (bird && bird.inScene && !tutorial.active && (bird.state === 'S1' || bird.state === 'S2' || bird.state === 'S3')) {
    const ev = alert.update(dt, {
      panOmega: rig.panOmega, shots, distM: metrics.distM || bird.group.position.distanceTo(camera.position),
      skittish: bird.species.skittish ?? 1, flushDistM: bird.species.flushDistM ?? 6,
      mul: cam.mods.alertMul, silent: !cam.body.blackout,
    })
    if (ev === 'wary') { bird.startle(); toast = `${bird.species.nameZh}在警戒，別動、別連拍`; toastT = 2.5 }
    if (ev === 'flush') {
      alertFlushes++
      spawner.flushCompanions()
      const next = alertFlushes % 2 === 1 ? spawner.fartherPerch(bird.currentPerch, camera.position) : null
      if (next) { bird.relocate(next); toast = `${bird.species.nameZh}被嚇到，飛遠了`; }
      else { bird.forceTakeoff(); toast = `${bird.species.nameZh}被你嚇走了`; }
      toastT = 3
    }
  } else if (!(bird && bird.inScene)) { alert.reset(); alertFlushes = 0 }

  // 觀景窗延遲；「減少晃動」只影響畫面，照片仍用真實姿態
  if (reduceShake) rig.applyTo(camera, 0.3)
  lag.push(camera.quaternion.clone())
  camera.quaternion.copy(trueQuat)
  const lagFrames = overview ? 0 : cam.body.evfLagFrames
  while (lag.length > lagFrames + 1) lag.shift()
  camera.quaternion.copy(lag[0])

  seed = (seed + 1) % 1000
  if (!overlayOpen()) {
    pipeline!.render(world.scene, camera, {
      focalMm: o.focalMm,
      fNumber: o.fNumber,
      focusM: s.focusM,
      sensorWmm: cam.sensor.widthMm,
      exposureMul: overview ? 1 : exposureMultiplier(lighting.evScene, o.fNumber, s.shutterS, s.iso),
      noiseSigma: overview ? 0 : noiseSigma(cam.body.kNoise, s.iso),
      dofEnabled: !overview,
      styleStrength: overview ? 0.6 : 1,
      seed,
      quality: 'live',
    }, null)
  }
  camera.quaternion.copy(trueQuat)

  if (shooting.cardLeft <= 0) hint = TOUCH ? '記憶卡滿了，選單裡收工' : '記憶卡滿了，按 X 收工'
  else if (callFlashT > 0) hint = `♪ 有鳥叫，${callName}要來了`
  else if (bracing) hint = '穩住中：手震減半，雲台變慢'
  else if (halfPress && tier === 0) hint = tutorial.active ? '這一課練手動對焦' : '這台機身只有手動對焦，升級機身才有自動對焦'
  else if (!TOUCH && !document.pointerLockElement && !overlayOpen()) hint = '點一下畫面開始（滑鼠鎖定）'
  else hint = ''

  const m = metrics
  const birdInfo = bird && bird.inScene
    ? `${bird.species.nameZh} ${STATE_LABEL[bird.state]}${m.birdInFrame ? `  鳥眼 ${m.distM.toFixed(1)}m  模糊圈 ${m.cocPx.toFixed(1)}px  動態 ${m.motionPx.toFixed(1)}px` : '  鳥不在畫面內'}  手震 ${m.shakePx.toFixed(1)}px`
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
    coins: save.coins,
    toast: toastT > 0 ? toast : '',
    reduceShake,
    afLabel: AF_LABEL[tier] + (cam.mods.focalMul > 1 ? ` · ${cam.mods.focalMul}x` : ''),
    afState: af.state,
    alert: bird && bird.inScene && !tutorial.active ? { name: bird.species.nameZh, value: alert.value } : null,
    timerS: session && !tutorial.active ? session.remainingS : null,
    quests: session && !tutorial.active ? session.level.quests.map((qq) => ({ title: qq.title, done: questsDone.has(qq.id) })) : [],
  })
  chalk.update(tutorial, { x: m.eyeX, y: m.eyeY, facing: bird?.facing ?? 1, visible: m.birdInFrame }, {
    aperture: allowed('aperture'), shutter: allowed('shutter'), iso: allowed('iso'),
  })
})

// 第一次進入：第一關的長椅機位直接上第零課；之後先到關卡頁
let tutorialDone = false
try { tutorialDone = localStorage.getItem(TUTORIAL_KEY) === '1' } catch { /* 私密視窗 */ }
startLevel(LEVELS[0], world.hides[0])
if (!tutorialDone) startTutorial()
else levelView.show()

// 給測試與截圖腳本用
;(window as unknown as { __game: unknown }).__game = {
  cam, rig, camera, capture, album, guide, gearView, levelView, summaryView, knowledge, save, af, alert,
  setHalfPress: (v: boolean) => { halfPress = v },
  applyEquipped, Pipeline, birds, dove, activeBird, shooting: () => shooting,
  world: () => world, spawner: () => spawner, session: () => session, startLevel, endLevel, levels: LEVELS, levelById: LEVEL_BY_ID,
  setLighting: (t: TimeOfDay, w: Weather) => { time = t; weather = w; setLighting() },
  setOverview: (v: boolean) => { overview = v },
  setHelp: (v: boolean) => { helpVisible = v },
  setGear,
  aimAtBird,
  shoot: () => { if (lastMetrics) takePhoto(lastMetrics) },
  metrics: () => lastMetrics,
  tutorial, startTutorial, endTutorial,
}
