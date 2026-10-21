import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const frag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float exposureMul;
uniform float noiseSigma;
uniform float seed;
uniform vec2 resolution;
varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// 三個均勻分佈相加近似高斯，標準差約 0.5
float gauss(vec2 p) {
  return (hash(p) + hash(p + 17.1) + hash(p + 91.7)) - 1.5;
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * exposureMul;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 p = vUv * resolution + vec2(seed * 13.7, seed * 7.3);
  // 亮度噪點為主，少量色彩噪點
  float nl = gauss(p) * 2.0;
  vec3 nc = vec3(gauss(p + 3.1), gauss(p + 5.3), gauss(p + 9.7)) * 0.7;
  vec3 n = (nl + nc) * noiseSigma * sqrt(max(L, 0.0) + 0.02) / sqrt(0.2);
  c = max(c + n, 0.0);
  c = aces(c * 0.8);
  gl_FragColor = vec4(toSrgb(c), 1.0);
}
`

export class ExposurePass {
  readonly material: THREE.ShaderMaterial
  private quad: FullScreenQuad

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        exposureMul: { value: 1 },
        noiseSigma: { value: 0 },
        seed: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget | null): void {
    const u = this.material.uniforms
    u.tDiffuse.value = input.texture
    u.resolution.value.set(input.width, input.height)
    renderer.setRenderTarget(output)
    this.quad.render(renderer)
  }
}
