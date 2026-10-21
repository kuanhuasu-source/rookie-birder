import * as THREE from 'three'
import { BIRD_LAYER } from '../render/mask'
import type { ImageStats } from './types'

const SW = 480
const SH = 320

const maskVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const maskFrag = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() { if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(1.0); }
`

/**
 * 拍照時的影像統計：小尺寸遮罩（有遮擋 / 無遮擋）讀回 CPU，
 * 再對照最終照片算主體亮度、背景雜亂，並用射線量背景距離。
 */
export class PhotoStats {
  private rtOcc = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.UnsignedByteType, depthBuffer: true })
  private rtFree = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.UnsignedByteType, depthBuffer: true })
  private black = new THREE.MeshBasicMaterial({ color: 0x000000 })
  private white = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, vertexShader: maskVert, fragmentShader: maskFrag, side: THREE.DoubleSide })
  private bufOcc = new Uint8Array(SW * SH * 4)
  private bufFree = new Uint8Array(SW * SH * 4)
  private raycaster = new THREE.Raycaster()

  constructor(private renderer: THREE.WebGLRenderer) {}

  /** 第一階段：渲染兩張遮罩並讀回，回傳之後對照照片用的資料。 */
  prepare(scene: THREE.Scene, camera: THREE.PerspectiveCamera, birdPapers: THREE.Mesh[], birdDistM: number): PreparedStats | null {
    if (birdPapers.length === 0) return null
    const r = this.renderer
    const prevBg = scene.background, prevFog = scene.fog, prevAuto = r.autoClear
    scene.background = null; scene.fog = null

    const swapped = birdPapers.map((m) => {
      const mat = this.white.clone()
      mat.uniforms.map.value = (m.material as THREE.MeshBasicMaterial).map
      const old = m.material
      m.material = mat
      return { m, old, mat }
    })
    const prevLayers = camera.layers.mask

    // 無遮擋：只畫鳥
    r.setRenderTarget(this.rtFree)
    r.setClearColor(0x000000, 1)
    r.clear()
    camera.layers.set(BIRD_LAYER)
    r.render(scene, camera)
    // 有遮擋：場景（不含鳥）黑色寫深度，再畫鳥
    camera.layers.set(0)
    scene.overrideMaterial = this.black
    r.setRenderTarget(this.rtOcc)
    r.clear()
    r.render(scene, camera)
    scene.overrideMaterial = null
    camera.layers.set(BIRD_LAYER)
    r.autoClear = false
    r.render(scene, camera)
    r.autoClear = prevAuto
    camera.layers.mask = prevLayers

    for (const s of swapped) { s.mat.dispose(); s.m.material = s.old }
    scene.background = prevBg; scene.fog = prevFog

    r.readRenderTargetPixels(this.rtOcc, 0, 0, SW, SH, this.bufOcc)
    r.readRenderTargetPixels(this.rtFree, 0, 0, SW, SH, this.bufFree)
    r.setRenderTarget(null)

    // 遮罩統計與外框
    let free = 0, occ = 0
    let minX = SW, maxX = -1, minY = SH, maxY = -1
    const freeMask = new Uint8Array(SW * SH)
    const occMask = new Uint8Array(SW * SH)
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x
      if (this.bufFree[i * 4] > 127) {
        free++; freeMask[i] = 1
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
      }
      if (this.bufOcc[i * 4] > 127) { occ++; occMask[i] = 1 }
    }
    if (free === 0) return null
    const occlusion = 1 - occ / free

    // 背景距離：沿外框外一圈射線
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const rx = Math.max(8, (maxX - minX) * 0.9), ry = Math.max(8, (maxY - minY) * 0.9)
    const dists: number[] = []
    const targets: THREE.Object3D[] = []
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !birdPapers.includes(o as THREE.Mesh)) targets.push(o) })
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry
      if (px < 0 || px >= SW || py < 0 || py >= SH) continue
      const ndc = new THREE.Vector2((px / SW) * 2 - 1, (py / SH) * 2 - 1)
      this.raycaster.setFromCamera(ndc, camera)
      const hit = this.raycaster.intersectObjects(targets, false)[0]
      dists.push(hit ? hit.distance : Infinity)
    }
    dists.sort((a, b) => a - b)
    const med = dists.length ? dists[Math.floor(dists.length / 2)] : Infinity
    const bgSep = med === Infinity ? 1 : Math.min(1, Math.max(0, (med - birdDistM) / birdDistM))

    return { occMask, freeMask, bbox: { minX, maxX, minY, maxY }, occlusion, bgSep }
  }

  /** 第二階段：拿到最終照片像素後算主體亮度與背景雜亂。photo 為由下往上的 RGBA。 */
  finish(pre: PreparedStats, photo: Uint8Array, photoW: number, photoH: number): ImageStats {
    const sx = photoW / SW, sy = photoH / SH
    let n = 0, sum = 0, clipped = 0, crushed = 0
    let bn = 0, bsum = 0, bsum2 = 0
    const { minX, maxX, minY, maxY } = pre.bbox
    const ex = (maxX - minX) * 0.5 + 6, ey = (maxY - minY) * 0.5 + 6
    const x0 = Math.max(0, Math.floor(minX - ex)), x1 = Math.min(SW - 1, Math.ceil(maxX + ex))
    const y0 = Math.max(0, Math.floor(minY - ey)), y1 = Math.min(SH - 1, Math.ceil(maxY + ey))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x
      const px = Math.min(photoW - 1, Math.floor(x * sx)), py = Math.min(photoH - 1, Math.floor(y * sy))
      const o = (py * photoW + px) * 4
      const r = photo[o] / 255, g = photo[o + 1] / 255, b = photo[o + 2] / 255
      const L = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
      if (pre.occMask[i]) {
        n++; sum += L
        if (Math.max(r, g, b) >= 0.97) clipped++
        if (Math.max(r, g, b) <= 0.04) crushed++
      } else if (!pre.freeMask[i]) {
        const Ls = 0.2126 * r + 0.7152 * g + 0.0722 * b
        bn++; bsum += Ls; bsum2 += Ls * Ls
      }
    }
    const subjectMean = n ? sum / n : 0
    const bgVariance = bn ? Math.max(0, bsum2 / bn - (bsum / bn) ** 2) : 0
    return { occlusion: pre.occlusion, subjectMean, clippedFrac: n ? clipped / n : 0, crushedFrac: n ? crushed / n : 0, bgVariance, bgSep: pre.bgSep }
  }
}

export interface PreparedStats {
  occMask: Uint8Array
  freeMask: Uint8Array
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
  occlusion: number
  bgSep: number
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
