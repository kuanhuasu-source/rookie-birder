/** 玩家進度：代幣、器材、圖鑑。存在 localStorage，照片本身在 IndexedDB。 */
export type GuideSlot = 'perched' | 'action' | 'takeoff' | 'flight'
export const GUIDE_SLOTS: GuideSlot[] = ['perched', 'action', 'takeoff', 'flight']
export const SLOT_LABEL: Record<GuideSlot, string> = { perched: '停棲', action: '動作', takeoff: '起飛', flight: '飛行' }

export interface GuideEntry {
  photoId: string
  stars: number
  total: number
  takenAt: number
}

export interface SaveData {
  version: 1
  coins: number
  owned: { lens: string[]; body: string[]; support: string[]; accessory: string[] }
  equipped: { lens: string; body: string; support: string; accessories: string[] }
  /** species id → slot → 最佳照片 */
  guide: Record<string, Partial<Record<GuideSlot, GuideEntry>>>
  pulls: number
  pity: number
  questsDone: string[]
  /** 已解鎖的成就 id，依解鎖順序 */
  achievements: string[]
}

const KEY = 'rookie-birder.save'

export function defaultSave(): SaveData {
  return {
    version: 1,
    coins: 0,
    owned: { lens: ['L1'], body: ['B1'], support: ['S0'], accessory: [] },
    equipped: { lens: 'L1', body: 'B1', support: 'S0', accessories: [] },
    guide: {},
    pulls: 0,
    pity: 0,
    questsDone: [],
    achievements: [],
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSave()
    const d = JSON.parse(raw) as Partial<SaveData>
    const base = defaultSave()
    return {
      ...base, ...d,
      owned: { ...base.owned, ...(d.owned ?? {}) },
      equipped: { ...base.equipped, ...(d.equipped ?? {}) },
      guide: d.guide ?? {},
      questsDone: d.questsDone ?? [],
      achievements: d.achievements ?? [],
    }
  } catch {
    return defaultSave()
  }
}

export function storeSave(s: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 私密視窗或空間不足 */ }
}
