import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { FG_BLUR_START_PX, FG_SOFT_PX, FG_MIN_BLOCK } from '../../camera/optics'

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/** 從紗幕層的深度算每個像素的遮擋權重，顏色預乘 alpha。 */
const alphaFrag = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float focalMm;
uniform float fNumber;
uniform float focusM;
uniform float sensorWmm;
uniform float refWidth;
varying vec2 vUv;

float cocPx(float dm) {
  float s = focusM * 1000.0;
  float d = max(dm * 1000.0, 1.0);
  float c = (focalMm / fNumber) * (focalMm / max(s - focalMm, 1.0)) * abs(d - s) / d;
  return c / sensorWmm * refWidth;
}
float blockWeight(float coc) {
  float t = clamp((coc - ${FG_BLUR_START_PX.toFixed(1)}) / (${FG_SOFT_PX.toFixed(1)} - ${FG_BLUR_START_PX.toFixed(1)}), 0.0, 1.0);
  float sm = t * t * (3.0 - 2.0 * t);
  return 1.0 - sm * (1.0 - ${FG_MIN_BLOCK.toFixed(2)});
}
void main() {
  vec4 c = texture2D(tColor, vUv);
  float z = texture2D(tDepth, vUv).x;
  float dist = -perspectiveDepthToViewZ(z, cameraNear, cameraFar);
  float a = c.a > 0.5 ? blockWeight(cocPx(dist)) : 0.0;
  gl_FragColor = vec4(c.rgb * a, a);
}
`

const blurFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 dir;
uniform float radiusPx;
uniform vec2 resolution;
varying vec2 vUv;
void main() {
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 18.0);
    vec2 off = dir * (fi * radiusPx / 8.0) / resolution;
    sum += texture2D(tDiffuse, vUv + off) * w;
    wsum += w;
  }
  gl_FragColor = sum / wsum;
}
`

/** 把糊掉的紗幕疊到畫面上；紗幕有東西且場景比它更近的地方不疊。 */
const compositeFrag = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tVeil;
uniform sampler2D tVeilDepth;
uniform sampler2D tSceneDepth;
uniform float cameraNear;
uniform float cameraFar;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec4 v = texture2D(tVeil, vUv);
  float vz = texture2D(tVeilDepth, vUv).x;
  float sz = texture2D(tSceneDepth, vUv).x;
  float keep = (vz < 0.9999 && sz < vz) ? 0.0 : 1.0;
  gl_FragColor = vec4(base.rgb * (1.0 - v.a * keep) + v.rgb * keep, base.a);
}
`

/**
 * 細長前景的紗幕：失焦的草與蘆葦不是實心的遮擋，而是半透明的一層顏色。
 * 流程：只畫細長層（比紗幕距離近的部分）→ 依深度算 alpha → 高斯模糊 → 疊回主畫面。
 */
export class VeilPass {
  readonly rtVeil: THREE.WebGLRenderTarget
  private rtA: THREE.WebGLRenderTarget
  private rtB: THREE.WebGLRenderTarget
  readonly alpha: THREE.ShaderMaterial
  readonly blur: THREE.ShaderMaterial
  readonly composite: THREE.ShaderMaterial
  private quadA: FullScreenQuad
  private quadB: FullScreenQuad
  private quadC: FullScreenQuad

  constructor(width: number, height: number) {
    this.rtVeil = this.makeVeilTarget(width, height)
    this.rtA = new THREE.WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), { type: THREE.HalfFloatType })
    this.rtB = new THREE.WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), { type: THREE.HalfFloatType })
    this.alpha = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 100 }, focalMm: { value: 400 }, fNumber: { value: 5.6 }, focusM: { value: 10 }, sensorWmm: { value: 36 }, refWidth: { value: 1920 } },
      vertexShader: vert, fragmentShader: alphaFrag, depthTest: false, depthWrite: false,
    })
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, radiusPx: { value: 12 }, resolution: { value: new THREE.Vector2(1, 1) } },
      vertexShader: vert, fragmentShader: blurFrag, depthTest: false, depthWrite: false,
    })
    this.composite = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tVeil: { value: null }, tVeilDepth: { value: null }, tSceneDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 100 } },
      vertexShader: vert, fragmentShader: compositeFrag, depthTest: false, depthWrite: false,
    })
    this.quadA = new FullScreenQuad(this.alpha)
    this.quadB = new FullScreenQuad(this.blur)
    this.quadC = new FullScreenQuad(this.composite)
  }

  private makeVeilTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const depth = new THREE.DepthTexture(Math.ceil(w / 2), Math.ceil(h / 2))
    depth.type = THREE.UnsignedIntType
    return new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), { type: THREE.HalfFloatType, depthTexture: depth, depthBuffer: true })
  }

  setSize(w: number, h: number): void {
    this.rtVeil.dispose(); this.rtVeil.depthTexture?.dispose()
    ;(this as { rtVeil: THREE.WebGLRenderTarget }).rtVeil = this.makeVeilTarget(w, h)
    this.rtA.setSize(Math.ceil(w / 2), Math.ceil(h / 2))
    this.rtB.setSize(Math.ceil(w / 2), Math.ceil(h / 2))
  }

  /**
   * 第一步：把細長層裡比 nearM 近的部分畫進紗幕（用裁切平面），相機與主畫面同一個。
   * 呼叫端已把相機圖層設成只有細長層。
   */
  renderVeilScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, nearM: number): void {
    const prevBg = scene.background, prevFog = scene.fog
    scene.background = null; scene.fog = null
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    // 留下 dot(fwd, p) − dot(fwd, cam) − nearM <= 0 的點：法向量取反
    const plane = new THREE.Plane(fwd.clone().negate(), fwd.dot(camera.position) + nearM)
    const prevPlanes = renderer.clippingPlanes
    renderer.clippingPlanes = [plane]
    renderer.setRenderTarget(this.rtVeil)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.clippingPlanes = prevPlanes
    scene.background = prevBg; scene.fog = prevFog
  }

  /** 第二步：alpha、模糊、疊合。input 是主畫面，output 是疊完的結果。 */
  composeOnto(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, sceneDepth: THREE.Texture, output: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera, p: { focalMm: number; fNumber: number; focusM: number; sensorWmm: number; refWidth: number; blurPx: number }): void {
    const au = this.alpha.uniforms
    au.tColor.value = this.rtVeil.texture
    au.tDepth.value = this.rtVeil.depthTexture
    au.cameraNear.value = camera.near; au.cameraFar.value = camera.far
    au.focalMm.value = p.focalMm; au.fNumber.value = p.fNumber; au.focusM.value = p.focusM; au.sensorWmm.value = p.sensorWmm; au.refWidth.value = p.refWidth
    renderer.setRenderTarget(this.rtA)
    this.quadA.render(renderer)

    const bu = this.blur.uniforms
    bu.resolution.value.set(this.rtA.width, this.rtA.height)
    bu.radiusPx.value = p.blurPx
    bu.tDiffuse.value = this.rtA.texture; bu.dir.value.set(1, 0)
    renderer.setRenderTarget(this.rtB)
    this.quadB.render(renderer)
    bu.tDiffuse.value = this.rtB.texture; bu.dir.value.set(0, 1)
    renderer.setRenderTarget(this.rtA)
    this.quadB.render(renderer)

    const cu = this.composite.uniforms
    cu.tDiffuse.value = input.texture
    cu.tVeil.value = this.rtA.texture
    cu.tVeilDepth.value = this.rtVeil.depthTexture
    cu.tSceneDepth.value = sceneDepth
    cu.cameraNear.value = camera.near; cu.cameraFar.value = camera.far
    renderer.setRenderTarget(output)
    this.quadC.render(renderer)
  }
}
