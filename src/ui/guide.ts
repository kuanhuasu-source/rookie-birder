import { SPECIES } from '../birds/species'
import { GUIDE_SLOTS, SLOT_LABEL, type SaveData } from '../progress/save'
import { guideCompletion } from '../progress/guide'
import { getPhoto } from '../photo/album'
import { starString } from '../photo/score'
import { LORE } from '../birds/lore'
import { RARITY_LABEL } from '../progress/gacha'
import { CHAPTER_NAME, chaptersOf } from '../levels/data'
import { playCall, unlockAudio } from '../audio/call'

/** 圖鑑：一本課本，每種鳥一頁四格，貼上最高分的照片。 */
export class GuideView {
  root: HTMLElement
  open = false
  private urls: string[] = []

  constructor(private getSave: () => SaveData, private onClose: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'guide hidden'
    this.root.innerHTML = `<div class="album-bar"><span class="tape"></span><strong>賞鳥圖鑑</strong><span class="guide-progress"></span><button class="album-close">關閉 (Esc)</button></div><div class="guide-pages"></div>`
    document.body.appendChild(this.root)
    this.root.querySelector('.album-close')!.addEventListener('click', () => this.hide())
  }

  async show(): Promise<void> {
    this.open = true
    this.root.classList.remove('hidden')
    await this.refresh()
  }

  hide(): void {
    this.open = false
    this.root.classList.add('hidden')
    for (const u of this.urls) URL.revokeObjectURL(u)
    this.urls = []
    this.onClose()
  }

  async refresh(): Promise<void> {
    const save = this.getSave()
    const c = guideCompletion(save, SPECIES.map((s) => s.id))
    ;(this.root.querySelector('.guide-progress') as HTMLElement).textContent = `${c.filled} / ${c.total} 格 · ${Math.round((c.filled / c.total) * 100)}%`
    const pages = this.root.querySelector('.guide-pages') as HTMLElement
    pages.innerHTML = ''
    for (const sp of SPECIES) {
      const entry = save.guide[sp.id] ?? {}
      const seen = Object.keys(entry).length > 0
      const page = document.createElement('div')
      page.className = 'guide-page' + (seen ? '' : ' unseen')
      const sticker = `${import.meta.env.BASE_URL}${sp.sprites.side.file}`
      const lore = LORE[sp.id]
      const where = chaptersOf(sp.id).map((c) => `第 ${c} 章 ${CHAPTER_NAME[c] ?? ''}`).join('、') || '尚未開放的章節'
      const tags = `<span class="guide-tag r-${sp.rarity}">${RARITY_LABEL[sp.rarity]}</span><span class="guide-tag">${lore ? `${lore.lengthCm} cm` : ''}</span><span class="guide-tag">${where}</span>`
      const info = lore ? (seen ? `
        <dl class="guide-info">
          <dt>狀態</dt><dd>${lore.status}</dd>
          <dt>棲地</dt><dd>${lore.habitat}</dd>
          <dt>特徵</dt><dd>${lore.features}</dd>
          <dt>習性</dt><dd>${lore.habits}</dd>
          <dt>聲音</dt><dd>${lore.voice} <button class="guide-call" type="button">▶ 聽叫聲</button></dd>
          <dt>小抄</dt><dd class="guide-tip">${lore.tip}</dd>
        </dl>` : `
        <dl class="guide-info">
          <dt>棲地</dt><dd>${lore.habitat}</dd>
          <dt>線索</dt><dd>${lore.voice}</dd>
          <dd class="guide-locked">拍到牠之後，特徵、習性與攝影小抄就會解鎖</dd>
        </dl>`) : ''
      page.innerHTML = `
        <div class="guide-head"><img class="guide-sticker" src="${sticker}"><div><div class="guide-name">${seen ? sp.nameZh : '？？？'}</div><div class="guide-latin">${seen ? `${sp.nameEn} · <i>${lore?.latin ?? ''}</i>` : '還沒拍到'}</div><div class="guide-tags">${tags}</div></div></div>
        <div class="guide-slots">${GUIDE_SLOTS.map((s) => `<div class="guide-slot" data-slot="${s}"><div class="guide-slot-img"></div><div class="guide-slot-cap">${SLOT_LABEL[s]}</div></div>`).join('')}</div>
        ${info}
      `
      pages.appendChild(page)
      page.querySelector('.guide-call')?.addEventListener('click', () => { unlockAudio(); playCall(sp) })
      for (const s of GUIDE_SLOTS) {
        const e = entry[s]
        const el = page.querySelector(`[data-slot="${s}"]`) as HTMLElement
        if (!e) { el.classList.add('empty'); continue }
        const p = await getPhoto(e.photoId)
        const img = el.querySelector('.guide-slot-img') as HTMLElement
        if (p) {
          const url = URL.createObjectURL(p.thumb)
          this.urls.push(url)
          img.style.backgroundImage = `url(${url})`
        }
        ;(el.querySelector('.guide-slot-cap') as HTMLElement).innerHTML = `${SLOT_LABEL[s]} <span class="stars">${starString(e.stars)}</span>`
      }
    }
  }
}
