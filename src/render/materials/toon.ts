import * as THREE from 'three'

let gradient: THREE.DataTexture | null = null

/** 三階色階的 gradient map，所有 toon 材質共用。 */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const data = new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255])
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

export function makeToon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() })
}
