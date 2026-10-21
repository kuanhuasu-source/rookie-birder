import * as THREE from 'three'
import { CocDofPass } from './passes/CocDofPass'
import { ExposurePass } from './passes/ExposurePass'
import { StylePass } from './passes/StylePass'
import { MotionBlurPass } from './passes/MotionBlurPass'

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
  private rtScene: THREE.WebGLRenderTarget
  private rtA: THREE.WebGLRenderTarget
  private rtB: THREE.WebGLRenderTarget
  private style = new StylePass()
  private dof = new CocDofPass()
  private motion = new MotionBlurPass()
  private exposure = new ExposurePass()

  constructor(private renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.rtScene = this.makeSceneTarget(width, height)
    this.rtA = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    this.rtB = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
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
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: FrameParams, output: THREE.WebGLRenderTarget | null): void {
    const r = this.renderer
    r.setRenderTarget(this.rtScene)
    r.render(scene, camera)

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
    du.samples.value = p.quality === 'photo' ? 48 : 16
    du.maxCocPx.value = Math.max(8, this.rtScene.width * (p.quality === 'photo' ? 0.04 : 0.03))
    // 景深要用場景深度，但顏色用風格化後的
    du.tDepth.value = this.rtScene.depthTexture
    this.dofRenderFrom(this.rtA, this.rtB, camera)

    let last = this.rtB
    if (p.motion) {
      const mu = this.motion.material.uniforms
      mu.camBlurPx.value.copy(p.motion.camBlurPx)
      mu.birdBlurPx.value.copy(p.motion.birdBlurPx)
      this.motion.render(r, this.rtB, p.motion.mask, this.rtA)
      last = this.rtA
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
