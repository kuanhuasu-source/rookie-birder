import { LEVELS, isLevelUnlocked, CHAPTER_NAME } from '../levels/data'
import type { LevelDef, HideDef } from '../levels/types'
import { buildScene } from '../world/scene'

/** 關卡選擇：課本的章節頁；選了關卡再選機位。 */
export class LevelView {
  root: HTMLElement
  open = false
  private picked: LevelDef | null = null

  constructor(private questsDone: () => Set<string>, private onStart: (level: LevelDef, hide: HideDef) => void, private onMenu: (what: 'guide' | 'gear' | 'tutorial' | 'knowledge') => void) {
    this.root = document.createElement('div')
    this.root.className = 'levels hidden'
    this.root.innerHTML = `
      <div class="album-bar"><span class="tape"></span><strong class="levels-title">小白打鳥</strong><span class="levels-sub"></span>
        <div class="levels-menu"><button data-menu="guide">賞鳥圖鑑</button><button data-menu="gear">裝備與扭蛋</button><button data-menu="knowledge">攝影知識</button><button data-menu="tutorial">重上第零課</button><button class="levels-back hidden">回上一頁</button></div>
      </div>
      <div class="levels-body"></div>`
    document.body.appendChild(this.root)
    this.root.querySelector('.levels-back')!.addEventListener('click', () => { this.picked = null; this.render() })
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-menu]')) b.addEventListener('click', () => this.onMenu(b.dataset.menu as 'guide' | 'gear' | 'tutorial' | 'knowledge'))
  }

  show(): void { this.open = true; this.picked = null; this.root.classList.remove('hidden'); this.render() }
  hide(): void { this.open = false; this.root.classList.add('hidden') }

  private render(): void {
    const body = this.root.querySelector('.levels-body') as HTMLElement
    const back = this.root.querySelector('.levels-back') as HTMLElement
    const title = this.root.querySelector('.levels-title') as HTMLElement
    const sub = this.root.querySelector('.levels-sub') as HTMLElement
    const done = this.questsDone()
    if (!this.picked) {
      back.classList.add('hidden')
      title.textContent = '小白打鳥'
      sub.textContent = '選一關出發。完成前一關的任何一個任務就能解鎖下一關'
      const chapters = [...new Set(LEVELS.map((l) => l.chapter))]
      body.innerHTML = chapters.map((c) => `
        <div class="chapter"><div class="chapter-title">第 ${c} 章 ${CHAPTER_NAME[c] ?? ''}</div>
        <div class="level-grid">${LEVELS.filter((l) => l.chapter === c).map((l) => {
          const unlocked = isLevelUnlocked(l, done)
          const qd = l.quests.filter((q) => done.has(q.id)).length
          return `<button class="level-card ${unlocked ? '' : 'locked'}" data-id="${l.id}" ${unlocked ? '' : 'disabled'}>
            <div class="level-name">${l.title}</div><div class="level-sub">${unlocked ? l.subtitle : '還沒解鎖'}</div>
            <div class="level-quests">${l.quests.map((q) => `<div class="${done.has(q.id) ? 'done' : ''}">${done.has(q.id) ? '✓' : '○'} ${q.title} <span>+${q.reward}</span></div>`).join('')}</div>
            <div class="level-progress">任務 ${qd} / ${l.quests.length}</div></button>`
        }).join('')}</div></div>`).join('')
      for (const b of body.querySelectorAll<HTMLButtonElement>('.level-card:not(.locked)')) {
        b.addEventListener('click', () => { this.picked = LEVELS.find((l) => l.id === b.dataset.id)!; this.render() })
      }
    } else {
      back.classList.remove('hidden')
      title.textContent = this.picked.title
      sub.textContent = '選一個機位。描述是中性的，光線與距離要自己判斷'
      const world = buildScene(this.picked.sceneId)
      const hides = world.hides
      world.dispose()
      body.innerHTML = `<div class="hide-grid">${hides.map((h) => `<button class="hide-card" data-id="${h.id}"><div class="hide-name">${h.name}</div><div class="hide-desc">${h.description}</div><div class="hide-go">出發</div></button>`).join('')}</div>`
      for (const b of body.querySelectorAll<HTMLButtonElement>('.hide-card')) {
        b.addEventListener('click', () => { const h = hides.find((x) => x.id === b.dataset.id)!; this.hide(); this.onStart(this.picked!, h) })
      }
    }
  }
}
