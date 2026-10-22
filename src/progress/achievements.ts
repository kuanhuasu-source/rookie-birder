import type { SaveData } from './save'
import { LEVELS } from '../levels/data'
import { SPECIES } from '../birds/species'
import { pool } from './gacha'

export interface AchievementDef {
  id: string
  /** 稱號 */
  title: string
  desc: string
  check: (save: SaveData) => boolean
}

const seen = (save: SaveData, id: string): boolean => Object.keys(save.guide[id] ?? {}).length > 0
const chapterSpecies = (chapter: number): string[] => [...new Set(LEVELS.filter((l) => l.chapter === chapter).flatMap((l) => Object.keys(l.species)))]
const allSeen = (save: SaveData, ids: string[]): boolean => ids.length > 0 && ids.every((id) => seen(save, id))
const filled = (save: SaveData): number => Object.values(save.guide).reduce((a, e) => a + Object.keys(e).length, 0)

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-three', title: '新手上路', desc: '任何一張三星以上的照片進圖鑑', check: (s) => Object.values(s.guide).some((e) => Object.values(e).some((x) => x && x.stars >= 3)) },
  { id: 'park-regular', title: '公園常客', desc: '第 1 章的鳥全部拍到', check: (s) => allSeen(s, chapterSpecies(1)) },
  { id: 'stream-watcher', title: '溪流守望者', desc: '第 2 章的鳥全部拍到', check: (s) => allSeen(s, chapterSpecies(2)) },
  { id: 'wetland-ranger', title: '濕地巡守', desc: '第 3 章的鳥全部拍到', check: (s) => allSeen(s, chapterSpecies(3)) },
  { id: 'field-detective', title: '草叢偵探', desc: '第 4 章的鳥全部拍到', check: (s) => allSeen(s, chapterSpecies(4)) },
  { id: 'forest-hermit', title: '林地隱士', desc: '第 5 章的鳥全部拍到', check: (s) => allSeen(s, chapterSpecies(5)) },
  { id: 'flight-five', title: '追焦手', desc: '五種鳥的飛行格', check: (s) => Object.values(s.guide).filter((e) => e.flight).length >= 5 },
  { id: 'five-star-five', title: '五星攝影師', desc: '五張五星照片進圖鑑', check: (s) => Object.values(s.guide).reduce((a, e) => a + Object.values(e).filter((x) => x && x.stars >= 5).length, 0) >= 5 },
  { id: 'half-guide', title: '半本圖鑑', desc: '圖鑑填滿一半', check: (s) => filled(s) >= SPECIES.length * 2 },
  { id: 'full-guide', title: '圖鑑大全', desc: '圖鑑全部填滿', check: (s) => filled(s) >= SPECIES.length * 4 },
  { id: 'legend', title: '傳說目擊者', desc: '拍到八色鳥', check: (s) => seen(s, 'fairy-pitta') },
  { id: 'collector', title: '器材收藏家', desc: '扭蛋池裡的器材全部到手', check: (s) => pool().every((i) => s.owned[i.kind].includes(i.id)) },
  { id: 'all-quests', title: '結業', desc: '三十個任務全部完成', check: (s) => LEVELS.every((l) => l.quests.every((q) => s.questsDone.includes(q.id))) },
]

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

/** 檢查所有成就，把新解鎖的寫進存檔並回傳。 */
export function checkAchievements(save: SaveData): AchievementDef[] {
  const fresh: AchievementDef[] = []
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue
    if (a.check(save)) { save.achievements.push(a.id); fresh.push(a) }
  }
  return fresh
}

/** 目前的稱號：最後解鎖的那個。 */
export function currentTitle(save: SaveData): string | null {
  const last = save.achievements[save.achievements.length - 1]
  return last ? ACHIEVEMENT_BY_ID[last]?.title ?? null : null
}
