import * as THREE from 'three'
import { CocDofPass } from './passes/CocDofPass'
import { ExposurePass } from './passes/ExposurePass'
import { StylePass } from './passes/StylePass'
import { MotionBlurPass } from './passes/MotionBlurPass'
import { VeilPass } from './passes/VeilPass'
import { THIN_LAYER } from './mask'
import { FG_BLUR_START_PX, FG_REF_WIDTH_PX } from '../camera/optics'

export interface FrameParams {
  focalMm: number
  fNumber: number
  focusM: number
  sensorWmm: number
  exposureMul: number
  noiseSigma: number
  dofEnabled: boolean
  styleStrength: number
  seed: number
  /** 只有照片才有：相機與鳥的模糊向量（px）與鳥遮罩 */
  motion?: { camBlurPx: THREE.Vector2; birdBlurPx: THREE.Vector2; mask: THREE.Texture }
  quality: 'live' | 'photo'
}

/**
 * 場景 → 風格（描邊、紙張） → 景深 → 動態模糊（照片） → 曝光與噪點 → 輸出。
 * 同一個類別同時給觀景窗（輸出到螢幕）與照片（輸出到 Uint8 緩衝）用。
 */
export class Pipeline {
  /** 除錯：'on' 正常；'noCompose' 不疊紗幕；'off' 不分層 */
  static debugVeil: 'on' | 'noCompose' | 'off' | 'noFar' | 'noVeilScene' = 'on'
  /** 低畫質：不畫紗幕、景深取樣減半（照片不受影響） */
  static lowQuality = false
  private rtScene: THREE.WebGLRenderTarget
  private rtA: THREE.WebGLRenderTarget
  private rtB: THREE.WebGLRenderTarget
  private style = new StylePass()
  private dof = new CocDofPass()
  private motion = new MotionBlurPass()
  private exposure = new ExposurePass()
  private veil: VeilPass
  private clipPlane = new THREE.Plane()

  constructor(private renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.rtScene = this.makeSceneTarget(width, height)
    this.rtA = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    this.rtB = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    this.veil = new VeilPass(width, height)
  }

  get width(): number { return this.rtScene.width }
  get height(): number { return this.rtScene.height }

  private makeSceneTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const depth = new THREE.DepthTexture(w, h)
    depth.type = THREE.UnsignedIntType
    return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture: depth, depthBuffer: true })
  }

  setSize(w: number, h: number): void {
    this.rtScene.dispose()
    this.rtScene.depthTexture?.dispose()
    this.rtScene = this.makeSceneTarget(w, h)
    this.rtA.setSize(w, h)
    this.rtB.setSize(w, h)
    this.veil.setSize(w, h)
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: FrameParams, output: THREE.WebGLRenderTarget | null): void {
    const r = this.renderer
    // 紗幕距離：比這近的細長前景（草、蘆葦）模糊圈已經超過 FG_BLUR_START_PX，改畫成半透明的紗幕
    const sMm = p.focusM * 1000
    const K = (p.focalMm / p.fNumber) * (p.focalMm / Math.max(1, sMm - p.focalMm))
    const C = (FG_BLUR_START_PX / FG_REF_WIDTH_PX) * p.sensorWmm
    const veilNearM = p.dofEnabled ? (sMm / (1 + C / K)) / 1000 : 0
    const useVeil = Pipeline.debugVeil !== 'off' && !(Pipeline.lowQuality && p.quality === 'live') && veilNearM > camera.near * 1.5
    const prevLayers = camera.layers.mask

    r.setRenderTarget(this.rtScene)
    if (useVeil) {
      camera.layers.disable(THIN_LAYER)
      r.render(scene, camera)
      // 細長層比紗幕距離遠的部分照常畫（同一個相機、同一個深度緩衝）
      camera.layers.set(THIN_LAYER)
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      this.clipPlane.set(fwd, -(fwd.dot(camera.position) + veilNearM))
      if (Pipeline.debugVeil !== 'noFar') {
        // 背景是 Color 的話 three 會強制清畫面，所以這一趟先拿掉背景
        const prevBg = scene.background
        scene.background = null
        r.clippingPlanes = [this.clipPlane]
        const prevAuto = r.autoClear
        r.autoClear = false
        r.render(scene, camera)
        r.autoClear = prevAuto
        r.clippingPlanes = []
        scene.background = prevBg
      }
      // 比紗幕距離近的部分畫進紗幕
      if (Pipeline.debugVeil !== 'noVeilScene') this.veil.renderVeilScene(r, scene, camera, veilNearM)
      camera.layers.mask = prevLayers
    } else {
      r.render(scene, camera)
    }

    const su = this.style.material.uniforms
    su.strength.value = p.styleStrength
    su.wobbleSeed.value = Math.floor(p.seed / 8) * 3.7
    this.style.render(r, this.rtScene, this.rtA, camera)

    const du = this.dof.material.uniforms
    du.focalMm.value = p.focalMm
    du.fNumber.value = p.fNumber
    du.focusM.value = p.focusM
    du.sensorWmm.value = p.sensorWmm
    du.enabled.value = p.dofEnabled ? 1 : 0
    du.samples.value = p.quality === 'photo' ? 48 : Pipeline.lowQuality ? 8 : 16
    du.maxCocPx.value = Math.max(8, this.rtScene.width * (p.quality === 'photo' ? 0.04 : 0.03))
    // 景深要用場景深度，但顏色用風格化後的
    du.tDepth.value = this.rtScene.depthTexture
    this.dofRenderFrom(this.rtA, this.rtB, camera)

    let last = this.rtB
    if (useVeil && Pipeline.debugVeil === 'on') {
      this.veil.composeOnto(r, this.rtB, this.rtScene.depthTexture!, this.rtA, camera, {
        focalMm: p.focalMm, fNumber: p.fNumber, focusM: p.focusM, sensorWmm: p.sensorWmm, refWidth: FG_REF_WIDTH_PX,
        blurPx: Math.max(6, this.rtScene.width * 0.012),
      })
      last = this.rtA
    }
    if (p.motion) {
      const mu = this.motion.material.uniforms
      mu.camBlurPx.value.copy(p.motion.camBlurPx)
      mu.birdBlurPx.value.copy(p.motion.birdBlurPx)
      const out = last === this.rtA ? this.rtB : this.rtA
      this.motion.render(r, last, p.motion.mask, out)
      last = out
    }

    const eu = this.exposure.material.uniforms
    eu.exposureMul.value = p.exposureMul
    eu.noiseSigma.value = p.noiseSigma
    eu.seed.value = p.seed
    this.exposure.render(r, last, output)
  }

  private dofRenderFrom(input: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera): void {
    const u = this.dof.material.uniforms
    u.tDiffuse.value = input.texture
    u.cameraNear.value = camera.near
    u.cameraFar.value = camera.far
    u.resolution.value.set(input.width, input.height)
    this.renderer.setRenderTarget(output)
    this.dof.quad.render(this.renderer)
  }
}
