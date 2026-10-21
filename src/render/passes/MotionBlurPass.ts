import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/**
 * 方向模糊：相機角速度造成全幀模糊向量，鳥遮罩內再加鳥自己的移動向量。
 * 遮罩沿著鳥的向量膨脹，讓鳥的殘影能拖到背景上。
 */
const frag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tMask;
uniform vec2 resolution;
uniform vec2 camBlurPx;
uniform vec2 birdBlurPx;
varying vec2 vUv;
const int N = 16;

float maskAt(vec2 uv) { return texture2D(tMask, uv).r; }

void main() {
  vec2 px = 1.0 / resolution;
  float m = maskAt(vUv);
  m = max(m, maskAt(vUv - birdBlurPx * 0.5 * px));
  m = max(m, maskAt(vUv + birdBlurPx * 0.5 * px));
  m = max(m, maskAt(vUv - birdBlurPx * 0.25 * px));
  m = max(m, maskAt(vUv + birdBlurPx * 0.25 * px));
  vec2 v = camBlurPx + m * birdBlurPx;
  float len = length(v);
  if (len < 0.5) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.5) / float(N) - 0.5;
    sum += texture2D(tDiffuse, vUv + v * t * px).rgb;
  }
  gl_FragColor = vec4(sum / float(N), 1.0);
}
`

export class MotionBlurPass {
  readonly material: THREE.ShaderMaterial
  private quad: FullScreenQuad

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tMask: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        camBlurPx: { value: new THREE.Vector2() },
        birdBlurPx: { value: new THREE.Vector2() },
      },
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, mask: THREE.Texture, output: THREE.WebGLRenderTarget | null): void {
    const u = this.material.uniforms
    u.tDiffuse.value = input.texture
    u.tMask.value = mask
    u.resolution.value.set(input.width, input.height)
    renderer.setRenderTarget(output)
    this.quad.render(renderer)
  }
}
