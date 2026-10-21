import { gear } from '../data/gear'
import type { SaveData } from './save'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type GearKind = 'lens' | 'body' | 'support' | 'accessory'

export interface GachaItem { kind: GearKind; id: string; name: string; rarity: Rarity }

export const PULL_COST = 30
export const PITY_RARE_AT = 8
export const RARITY_LABEL: Record<Rarity, string> = { common: '普通', rare: '稀有', epic: '史詩', legendary: '傳說' }
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 2 }
/** 重複時退回的代幣 */
export const REFUND: Record<Rarity, number> = { common: 10, rare: 20, epic: 40, legendary: 80 }

const RARITY_OF: Record<string, Rarity> = {
  L1: 'common', L2: 'common', L3: 'rare', L4: 'epic', L5: 'legendary',
  B1: 'common', B2: 'common', B3: 'rare', B4: 'epic',
  S1: 'common', S2: 'rare', S3: 'rare', S4: 'epic',
  A1: 'common', A2: 'rare', A3: 'rare', A4: 'epic',
}

/** 扭蛋池：起始配備（L1 B1 S0）不在池裡。 */
export function pool(): GachaItem[] {
  const items: GachaItem[] = []
  for (const l of gear.lenses) if (RARITY_OF[l.id]) items.push({ kind: 'lens', id: l.id, name: l.name, rarity: RARITY_OF[l.id] })
  for (const b of gear.bodies) if (RARITY_OF[b.id]) items.push({ kind: 'body', id: b.id, name: b.name, rarity: RARITY_OF[b.id] })
  for (const s of gear.supports) if (RARITY_OF[s.id]) items.push({ kind: 'support', id: s.id, name: s.name, rarity: RARITY_OF[s.id] })
  for (const a of gear.accessories) if (RARITY_OF[a.id]) items.push({ kind: 'accessory', id: a.id, name: a.name, rarity: RARITY_OF[a.id] })
  return items.filter((i) => i.id !== 'L1' && i.id !== 'B1')
}

export interface PullResult { item: GachaItem; isNew: boolean; refund: number; pityTriggered: boolean }

/** 抽一次：先抽稀有度（含保底），再在該稀有度裡等機率抽一件；重複退幣。 */
export function pull(save: SaveData, rng: () => number = Math.random): PullResult | null {
  if (save.coins < PULL_COST) return null
  save.coins -= PULL_COST
  save.pulls++
  save.pity++
  const items = pool()
  let rarity: Rarity
  const pityTriggered = save.pity >= PITY_RARE_AT
  if (pityTriggered) {
    rarity = rollRarity(rng, ['rare', 'epic', 'legendary'])
  } else {
    rarity = rollRarity(rng, ['common', 'rare', 'epic', 'legendary'])
  }
  if (rarity !== 'common') save.pity = 0
  const candidates = items.filter((i) => i.rarity === rarity)
  const item = candidates[Math.floor(rng() * candidates.length)]
  const ownedList = save.owned[item.kind]
  const isNew = !ownedList.includes(item.id)
  let refund = 0
  if (isNew) ownedList.push(item.id)
  else { refund = REFUND[item.rarity]; save.coins += refund }
  return { item, isNew, refund, pityTriggered }
}

function rollRarity(rng: () => number, allowed: Rarity[]): Rarity {
  const total = allowed.reduce((a, r) => a + RARITY_WEIGHT[r], 0)
  let x = rng() * total
  for (const r of allowed) { x -= RARITY_WEIGHT[r]; if (x <= 0) return r }
  return allowed[allowed.length - 1]
}

export function rarityOf(id: string): Rarity { return RARITY_OF[id] ?? 'common' }
