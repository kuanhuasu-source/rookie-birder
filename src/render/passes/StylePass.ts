import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/**
 * 紙片塗鴉風：由深度緩衝找輪廓與摺痕畫鉛筆描邊（帶抖線），
 * 再疊上程序化的紙張顆粒與淡淡的色鉛筆斜線。
 */
const frag = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 resolution;
uniform float lineWidth;
uniform float wobbleSeed;
uniform float strength;
varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float dist(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
}

void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  if (strength < 0.01) { gl_FragColor = vec4(col, 1.0); return; }

  // 抖線：取樣位置加低頻雜訊位移，像逐格手繪
  vec2 px = 1.0 / resolution;
  vec2 wob = (vec2(vnoise(vUv * 40.0 + wobbleSeed), vnoise(vUv * 40.0 + wobbleSeed + 50.0)) - 0.5) * 2.0 * lineWidth * 0.9;
  vec2 uv = vUv + wob * px;

  float d0 = dist(uv);
  float w = lineWidth;
  float dl = dist(uv - vec2(w, 0) * px), dr = dist(uv + vec2(w, 0) * px);
  float du = dist(uv - vec2(0, w) * px), dd = dist(uv + vec2(0, w) * px);
  // 相對深度差：輪廓
  float jump = max(max(abs(dl - d0), abs(dr - d0)), max(abs(du - d0), abs(dd - d0))) / d0;
  float silhouette = smoothstep(0.015, 0.05, jump);
  // 二階差：摺痕（低多邊形的面交界）
  float crease = (abs(dl + dr - 2.0 * d0) + abs(du + dd - 2.0 * d0)) / d0;
  float creaseLine = smoothstep(0.0025, 0.009, crease) * 0.55;
  float edge = clamp(max(silhouette, creaseLine), 0.0, 1.0);
  // 線條粗細不均
  edge *= 0.7 + 0.3 * vnoise(vUv * resolution * 0.15 + wobbleSeed);

  vec3 pencil = vec3(0.045, 0.045, 0.05);
  col = mix(col, pencil, edge * strength);

  // 紙張顆粒（螢幕空間，固定不隨相機動）
  vec2 gp = vUv * resolution;
  float grain = hash(gp) * 0.6 + vnoise(gp * 0.35) * 0.4;
  float fiber = vnoise(vec2(gp.x * 0.08, gp.y * 0.9)) * 0.5 + vnoise(vec2(gp.x * 0.9, gp.y * 0.08)) * 0.5;
  float paper = 1.0 - (grain * 0.10 + fiber * 0.06) * strength;
  // 色鉛筆斜線：只在中間調，很淡
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float hatch = 0.5 + 0.5 * sin((gp.x + gp.y) * 0.9 + vnoise(gp * 0.05) * 6.0);
  float mid = smoothstep(0.02, 0.15, L) * (1.0 - smoothstep(0.4, 0.9, L));
  paper *= 1.0 - hatch * mid * 0.05 * strength;

  gl_FragColor = vec4(col * paper, 1.0);
}
`

export class StylePass {
  readonly material: THREE.ShaderMaterial
  private quad: FullScreenQuad

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 500 },
        resolution: { value: new THREE.Vector2(1, 1) },
        lineWidth: { value: 1.5 },
        wobbleSeed: { value: 0 },
        strength: { value: 1 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget | null, camera: THREE.PerspectiveCamera): void {
    const u = this.material.uniforms
    u.tDiffuse.value = input.texture
    u.tDepth.value = input.depthTexture
    u.cameraNear.value = camera.near
    u.cameraFar.value = camera.far
    u.resolution.value.set(input.width, input.height)
    u.lineWidth.value = Math.max(1.2, input.width / 900)
    renderer.setRenderTarget(output)
    this.quad.render(renderer)
  }
}
