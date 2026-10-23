import * as THREE from 'three'
import type { Perch } from '../birds/Bird'
import type { HideDef, SceneId } from '../levels/types'
import { buildPark } from './scenes/park'
import { buildStream } from './scenes/stream'
import { buildWetland } from './scenes/wetland'
import { buildField } from './scenes/field'
import { buildForest } from './scenes/forest'
import { buildRail } from './scenes/rail'
import { THIN_LAYER } from '../render/mask'

export interface World {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  perches: Perch[]
  hides: HideDef[]
  /** 每幀更新（光斑等會動的東西） */
  update?: (dt: number) => void
  /** 這個停棲點現在是否在光斑裡 */
  sunlit?: (perch: Perch | null) => boolean
  dispose: () => void
}

export function buildScene(id: SceneId): World {
  const w = id === 'stream' ? buildStream() : id === 'wetland' ? buildWetland() : id === 'field' ? buildField() : id === 'forest' ? buildForest() : id === 'rail' ? buildRail() : buildPark()
  // 燈光也有圖層：細長層單獨畫的時候也要被照到
  w.scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enable(THIN_LAYER) })
  return w
}
