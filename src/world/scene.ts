import * as THREE from 'three'
import type { Perch } from '../birds/Bird'
import type { HideDef, SceneId } from '../levels/types'
import { buildPark } from './scenes/park'
import { buildStream } from './scenes/stream'

export interface World {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  perches: Perch[]
  hides: HideDef[]
  dispose: () => void
}

export function buildScene(id: SceneId): World {
  return id === 'stream' ? buildStream() : buildPark()
}
