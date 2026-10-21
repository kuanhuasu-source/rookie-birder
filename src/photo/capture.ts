import * as THREE from 'three'
import { Pipeline } from '../render/pipeline'
import { BirdMask, BIRD_LAYER } from '../render/mask'
import type { PhotoRecord, PhotoMetrics } from './types'
import { savePhoto } from './album'
import { PhotoStats } from './stats'
import { scorePhoto } from './score'

export const PHOTO_W = 1920
export const PHOTO_H = 1280

export interface CaptureInput {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera          // 真實姿態（含手震），不含觀景窗延遲
  birdPapers: THREE.Mesh[]
  settings: PhotoRecord['settings']
  gear: PhotoRecord['gear']
  lighting: PhotoRecord['lighting']
  metrics: PhotoMetrics
  sensorWmm: number
  exposureMul: number
  noiseSigma: number
  /** 相機角速度（rad/s）：yaw、pitch */
  camOmega: THREE.Vector2
  /** 鳥眼在照片像素座標下的速度（px/s） */
  birdVelPx: THREE.Vector2
}

/** 照片成像：高解析渲染、非同步讀回、WebP 編碼、存進相簿。 */
export class PhotoCapture {
  private pipeline: Pipeline
  private mask: BirdMask
  private stats: PhotoStats
  private pool: THREE.WebGLRenderTarget[] = []
  private busy = new Set<THREE.WebGLRenderTarget>()
  private photoCamera = new THREE.PerspectiveCamera()
  inFlight = 0

  constructor(private renderer: THREE.WebGLRenderer) {
    this.pipeline = new Pipeline(renderer, PHOTO_W, PHOTO_H)
    this.mask = new BirdMask(PHOTO_W, PHOTO_H)
    this.stats = new PhotoStats(renderer)
    for (let i = 0; i < 3; i++) this.pool.push(new THREE.WebGLRenderTarget(PHOTO_W, PHOTO_H, { type: THREE.UnsignedByteType, depthBuffer: false }))
  }

  /** 回傳 null 表示讀回緩衝都在忙，這張丟掉（真實機身也會卡）。 */
  capture(input: CaptureInput): Promise<PhotoRecord> | null {
    const rt = this.pool.find((t) => !this.busy.has(t))
    if (!rt) return null
    this.busy.add(rt)
    this.inFlight++

    const cam = this.photoCamera
    cam.fov = input.camera.fov
    cam.near = input.camera.near
    cam.far = input.camera.far
    cam.aspect = PHOTO_W / PHOTO_H
    cam.layers.enable(BIRD_LAYER)
    cam.updateProjectionMatrix()
    cam.position.copy(input.camera.position)
    cam.quaternion.copy(input.camera.quaternion)
    cam.updateMatrixWorld()

    this.mask.render(this.renderer, input.scene, cam, input.birdPapers)
    const pre = input.metrics.birdInFrame ? this.stats.prepare(input.scene, cam, input.birdPapers, input.metrics.distM) : null

    const t = input.settings.shutterS
    const focalPx = (input.settings.focalMm / input.sensorWmm) * PHOTO_W
    const camBlurPx = new THREE.Vector2(input.camOmega.x * t * focalPx, input.camOmega.y * t * focalPx)
    const birdBlurPx = input.birdVelPx.clone().multiplyScalar(t)

    this.pipeline.render(input.scene, cam, {
      focalMm: input.settings.focalMm,
      fNumber: input.settings.fNumber,
      focusM: input.settings.focusM,
      sensorWmm: input.sensorWmm,
      exposureMul: input.exposureMul,
      noiseSigma: input.noiseSigma,
      dofEnabled: true,
      styleStrength: 1,
      seed: Math.floor(Math.random() * 1000),
      motion: { camBlurPx, birdBlurPx, mask: this.mask.target.texture },
      quality: 'photo',
    }, rt)
    this.renderer.setRenderTarget(null)

    const buf = new Uint8Array(PHOTO_W * PHOTO_H * 4)
    const takenAt = Date.now()
    const id = `${takenAt}-${Math.random().toString(36).slice(2, 7)}`
    const record = (async () => {
      try {
        await this.renderer.readRenderTargetPixelsAsync(rt, 0, 0, PHOTO_W, PHOTO_H, buf)
      } finally {
        this.busy.delete(rt)
      }
      const metrics = { ...input.metrics }
      if (pre) metrics.stats = this.stats.finish(pre, buf, PHOTO_W, PHOTO_H)
      const score = scorePhoto(metrics, { imageW: PHOTO_W, imageH: PHOTO_H })
      const { blob, thumb } = await encode(buf, PHOTO_W, PHOTO_H)
      const rec: PhotoRecord = {
        id, takenAt, width: PHOTO_W, height: PHOTO_H,
        settings: { ...input.settings },
        gear: { ...input.gear },
        lighting: { ...input.lighting },
        metrics, score,
        blob, thumb,
      }
      await savePhoto(rec)
      this.inFlight--
      return rec
    })()
    return record
  }
}

/** WebGL 讀回是由下往上，要翻轉；編成 WebP 與縮圖。 */
async function encode(buf: Uint8Array, w: number, h: number): Promise<{ blob: Blob; thumb: Blob }> {
  const flipped = new Uint8ClampedArray(w * h * 4)
  const row = w * 4
  for (let y = 0; y < h; y++) flipped.set(buf.subarray(y * row, (y + 1) * row), (h - 1 - y) * row)
  const img = new ImageData(flipped, w, h)
  const full = new OffscreenCanvas(w, h)
  full.getContext('2d')!.putImageData(img, 0, 0)
  const tw = 360
  const th = Math.round((h / w) * tw)
  const small = new OffscreenCanvas(tw, th)
  small.getContext('2d')!.drawImage(full, 0, 0, tw, th)
  const [blob, thumb] = await Promise.all([
    full.convertToBlob({ type: 'image/webp', quality: 0.86 }),
    small.convertToBlob({ type: 'image/webp', quality: 0.8 }),
  ])
  return { blob, thumb }
}
