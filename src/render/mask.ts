import * as THREE from 'three'

const BIRD_LAYER = 1
/** 細長的前景物（草莖、蘆葦、葉片）：失焦時會變半透明，獨立圖層另外畫。 */
const THIN_LAYER = 2

/** 把物件（含子物件）標成細長前景。 */
export function markThin(obj: THREE.Object3D): void {
  obj.traverse((o) => { o.layers.set(THIN_LAYER) })
}

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
 * 鳥的遮罩：整個場景先用黑色畫一遍寫入深度，再只畫鳥（含紙片的 alpha 裁切）成白色。
 * 被前景擋住的部分因為深度測試會保持黑色，所以遮罩同時也反映遮擋。
 */
export class BirdMask {
  readonly target: THREE.WebGLRenderTarget
  private black = new THREE.MeshBasicMaterial({ color: 0x000000 })
  private white = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, vertexShader: maskVert, fragmentShader: maskFrag, side: THREE.DoubleSide })

  constructor(width: number, height: number) {
    this.target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, depthBuffer: true })
  }

  setSize(w: number, h: number): void { this.target.setSize(w, h) }

  /** 回傳遮罩裡白色像素的比例估計不在這裡做，評分時另外讀回。 */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, birdPapers: THREE.Mesh[]): void {
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.background = null
    scene.fog = null
    const prevMask = camera.layers.mask
    // 場景（不含鳥）用黑色寫入深度
    camera.layers.set(0)
    camera.layers.enable(THIN_LAYER)
    scene.overrideMaterial = this.black
    renderer.setRenderTarget(this.target)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(scene, camera)
    scene.overrideMaterial = null

    camera.layers.set(BIRD_LAYER)
    const swapped: { m: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = []
    for (const m of birdPapers) {
      swapped.push({ m, mat: m.material })
      const mat = this.white.clone()
      mat.uniforms.map.value = (m.material as THREE.MeshBasicMaterial).map
      m.material = mat
    }
    const prevAuto = renderer.autoClear
    renderer.autoClear = false
    renderer.render(scene, camera)
    renderer.autoClear = prevAuto
    for (const s of swapped) {
      ;(s.m.material as THREE.Material).dispose()
      s.m.material = s.mat
    }
    camera.layers.mask = prevMask
    scene.background = prevBg
    scene.fog = prevFog
  }
}

export { BIRD_LAYER, THIN_LAYER }
