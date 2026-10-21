import type { PhotoRecord } from '../photo/types'
import type { SaveData, GuideSlot } from './save'
import { GUIDE_SLOTS } from './save'

/** 鳥的狀態對應到圖鑑格子。 */
export function slotForState(state: string | undefined): GuideSlot | null {
  switch (state) {
    case 'S1': return 'perched'
    case 'S2': case 'S3': return 'action'
    case 'S4': return 'takeoff'
    case 'S5': return 'flight'
    default: return null
  }
}

export interface GuideUpdate {
  species: string
  slot: GuideSlot
  newSpecies: boolean
  newSlot: boolean
  improved: boolean
  bonus: number
}

/** 圖鑑最低門檻：兩星以上才收。 */
export const GUIDE_MIN_STARS = 2
export const BONUS_NEW_SPECIES = 15
export const BONUS_NEW_SLOT = 10

/** 拍到照片後更新圖鑑，回傳有沒有新格子與獎勵；沒鳥或太差就回 null。 */
export function updateGuide(save: SaveData, photo: PhotoRecord): GuideUpdate | null {
  const m = photo.metrics
  if (!m.birdInFrame || !m.species) return null
  const slot = slotForState(m.birdState)
  if (!slot || photo.score.stars < GUIDE_MIN_STARS) return null
  const entry = (save.guide[m.species] ??= {})
  const newSpecies = Object.keys(entry).length === 0
  const prev = entry[slot]
  const newSlot = !prev
  const improved = !!prev && photo.score.total > prev.total
  if (newSlot || improved) entry[slot] = { photoId: photo.id, stars: photo.score.stars, total: photo.score.total, takenAt: photo.takenAt }
  const bonus = (newSpecies ? BONUS_NEW_SPECIES : 0) + (newSlot ? BONUS_NEW_SLOT : 0)
  save.coins += bonus
  return { species: m.species, slot, newSpecies, newSlot, improved, bonus }
}

export function guideCompletion(save: SaveData, speciesIds: string[]): { filled: number; total: number } {
  let filled = 0
  for (const id of speciesIds) for (const s of GUIDE_SLOTS) if (save.guide[id]?.[s]) filled++
  return { filled, total: speciesIds.length * GUIDE_SLOTS.length }
}
