import type { LevelDef, QuestDef } from './types'
import type { PhotoRecord } from '../photo/types'

export interface SessionSummary {
  levelId: string
  photos: number
  coins: number
  questsCompleted: QuestDef[]
  bestPhotoId: string | null
  bestStars: number
  elapsedS: number
}

/** 一關的進行狀態：計時、任務判定、統計。 */
export class LevelSession {
  elapsedS = 0
  photos = 0
  coins = 0
  bestPhotoId: string | null = null
  bestStars = 0
  bestTotal = -1
  completed: QuestDef[] = []
  ended = false

  constructor(readonly level: LevelDef, private questsDone: Set<string>) {}

  get remainingS(): number { return Math.max(0, this.level.durationS - this.elapsedS) }
  get timeUp(): boolean { return this.elapsedS >= this.level.durationS }

  update(dt: number): void {
    if (!this.ended) this.elapsedS += dt
  }

  /** 回傳這張照片新完成的任務（已在存檔裡完成的不重複給）。 */
  onPhoto(p: PhotoRecord, coinsFromPhoto: number): QuestDef[] {
    this.photos++
    this.coins += coinsFromPhoto
    if (p.metrics.birdInFrame && p.score.total > this.bestTotal) { this.bestTotal = p.score.total; this.bestStars = p.score.stars; this.bestPhotoId = p.id }
    const fresh: QuestDef[] = []
    for (const q of this.level.quests) {
      if (this.questsDone.has(q.id)) continue
      if (q.check(p)) { this.questsDone.add(q.id); this.completed.push(q); this.coins += q.reward; fresh.push(q) }
    }
    return fresh
  }

  addCoins(n: number): void { this.coins += n }

  end(): SessionSummary {
    this.ended = true
    return { levelId: this.level.id, photos: this.photos, coins: this.coins, questsCompleted: this.completed, bestPhotoId: this.bestPhotoId, bestStars: this.bestStars, elapsedS: this.elapsedS }
  }
}
