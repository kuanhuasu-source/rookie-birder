import type { PhotoRecord } from '../photo/types'
import type { TimeOfDay, Weather } from '../world/lighting'

export type SceneId = 'park' | 'stream'

export interface HideDef {
  id: string
  name: string
  /** 中性的描述，讓玩家自己判斷光線與距離 */
  description: string
  position: [number, number, number]
  /** 面向的水平角（度），0 為 −z */
  yawDeg: number
}

export interface QuestDef {
  id: string
  title: string
  hint: string
  reward: number
  check: (p: PhotoRecord) => boolean
}

export interface LevelDef {
  id: string
  chapter: number
  title: string
  subtitle: string
  sceneId: SceneId
  time: TimeOfDay
  weather: Weather
  /** 鳥種 id → 出現權重 */
  species: Record<string, number>
  quests: QuestDef[]
  durationS: number
  cardCapacity: number
  /** 間隔倍率：越小鳥越常來 */
  intervalMul: number
}
