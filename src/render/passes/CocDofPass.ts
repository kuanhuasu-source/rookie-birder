import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const frag = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 resolution;
uniform float focalMm;
uniform float fNumber;
uniform float focusM;
uniform float sensorWmm;
uniform float maxCocPx;
uniform float enabled;
varying vec2 vUv;

uniform int samples;
const int NMAX = 48;
// Poisson disk，半徑 1，前 16 點也夠均勻可單獨當低品質用
const vec2 P[48] = vec2[48](
  vec2(0.056, 0.736), vec2(-0.532, 0.567), vec2(-0.180, -0.182), vec2(0.912, 0.076),
  vec2(-0.028, 0.483), vec2(0.686, -0.019), vec2(0.357, -0.591), vec2(-0.617, -0.698),
  vec2(-0.852, -0.125), vec2(0.040, -0.768), vec2(-0.056, 0.167), vec2(-0.182, -0.920),
  vec2(-0.909, 0.330), vec2(0.226, -0.215), vec2(0.306, 0.351), vec2(-0.384, -0.392),
  vec2(-0.621, -0.028), vec2(-0.821, -0.480), vec2(-0.399, -0.877), vec2(0.617, -0.781),
  vec2(0.623, -0.425), vec2(-0.104, -0.448), vec2(0.760, 0.472), vec2(-0.328, 0.207),
  vec2(-0.239, 0.844), vec2(-0.699, 0.178), vec2(0.244, 0.034), vec2(0.162, -0.461),
  vec2(0.253, 0.609), vec2(-0.252, 0.520), vec2(0.320, -0.858), vec2(-0.375, -0.615),
  vec2(0.422, 0.783), vec2(0.039, -0.078), vec2(0.496, 0.161), vec2(0.913, -0.146),
  vec2(0.531, 0.523), vec2(0.500, -0.224), vec2(0.124, 0.976), vec2(-0.397, -0.091),
  vec2(0.777, -0.597), vec2(-0.765, 0.634), vec2(0.927, -0.372), vec2(-0.566, 0.822),
  vec2(-0.644, -0.310), vec2(0.929, 0.319), vec2(0.711, 0.693), vec2(-0.984, 0.077)
);

float distM(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}

/** 模糊圈半徑（px），與 optics.ts 的 cocMm 同一條公式。 */
float cocRadiusPx(float dm) {
  float s = focusM * 1000.0;
  float d = max(dm * 1000.0, 1.0);
  float A = focalMm / fNumber;
  float c = A * (focalMm / max(s - focalMm, 1.0)) * abs(d - s) / d;
  float px = c / sensorWmm * resolution.x;
  return min(px, maxCocPx) * 0.5;
}

void main() {
  vec4 center = texture2D(tDiffuse, vUv);
  if (enabled < 0.5) { gl_FragColor = center; return; }
  float dc = distM(vUv);
  float rc = cocRadiusPx(dc);
  // 搜尋半徑至少要能收到附近前景的擴散
  float search = max(rc, maxCocPx * 0.25);
  vec3 sum = center.rgb;
  float wsum = 1.0;
  for (int i = 0; i < NMAX; i++) {
    if (i >= samples) break;
    vec2 off = P[i] * search;
    vec2 uv = vUv + off / resolution;
    float ds = distM(uv);
    float rs = cocRadiusPx(ds);
    float dist = length(off);
    // 樣本的模糊圈要能覆蓋到中心點才算數
    float w = smoothstep(dist - 1.0, dist + 1.0, rs);
    // 背景不能滲到比它清楚的前景上
    if (ds > dc) w *= clamp(rc / max(rs, 0.5), 0.0, 1.0);
    sum += texture2D(tDiffuse, uv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}
`

export class CocDofPass {
  readonly material: THREE.ShaderMaterial
  readonly quad: FullScreenQuad

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 500 },
        resolution: { value: new THREE.Vector2(1, 1) },
        focalMm: { value: 250 },
        fNumber: { value: 5.6 },
        focusM: { value: 10 },
        sensorWmm: { value: 36 },
        maxCocPx: { value: 40 },
        enabled: { value: 1 },
        samples: { value: 16 },
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
    renderer.setRenderTarget(output)
    this.quad.render(renderer)
  }
}
