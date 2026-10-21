import type { SessionSummary } from '../levels/session'
import { LEVEL_BY_ID } from '../levels/data'
import { getPhoto } from '../photo/album'
import { starString } from '../photo/score'

/** 收工結算：這一關拍了幾張、最佳照片、任務與代幣。 */
export class SummaryView {
  root: HTMLElement
  open = false
  private url: string | null = null

  constructor(private onAgain: () => void, private onLevels: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'summary hidden'
    this.root.innerHTML = `
      <div class="summary-card">
        <div class="summary-title">收工</div>
        <div class="summary-level"></div>
        <div class="summary-photo"><img></div>
        <div class="summary-stats"></div>
        <div class="summary-quests"></div>
        <div class="summary-actions"><button class="s-again">再來一次</button><button class="s-levels">回到關卡</button></div>
      </div>`
    document.body.appendChild(this.root)
    this.root.querySelector('.s-again')!.addEventListener('click', () => { this.hide(); this.onAgain() })
    this.root.querySelector('.s-levels')!.addEventListener('click', () => { this.hide(); this.onLevels() })
  }

  async show(s: SessionSummary): Promise<void> {
    this.open = true
    this.root.classList.remove('hidden')
    const q = (sel: string) => this.root.querySelector(sel) as HTMLElement
    q('.summary-level').textContent = LEVEL_BY_ID[s.levelId]?.title ?? s.levelId
    const img = this.root.querySelector('img') as HTMLImageElement
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    const p = s.bestPhotoId ? await getPhoto(s.bestPhotoId) : undefined
    if (p) { this.url = URL.createObjectURL(p.thumb); img.src = this.url; img.style.display = '' } else img.style.display = 'none'
    const mins = Math.floor(s.elapsedS / 60), secs = Math.round(s.elapsedS % 60)
    q('.summary-stats').innerHTML = `<div>拍了 ${s.photos} 張 · 最佳 ${s.bestStars ? starString(s.bestStars) : '—'} · ${mins} 分 ${secs} 秒</div><div class="summary-coins">+${s.coins} 代幣</div>`
    q('.summary-quests').innerHTML = s.questsCompleted.length
      ? s.questsCompleted.map((x) => `<div>✓ ${x.title} <span>+${x.reward}</span></div>`).join('')
      : '<div class="muted">這次沒完成任務，看看關卡頁的提示</div>'
  }

  hide(): void { this.open = false; this.root.classList.add('hidden') }
}
