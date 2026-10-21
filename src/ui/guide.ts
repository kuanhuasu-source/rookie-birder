import { SPECIES } from '../birds/species'
import { GUIDE_SLOTS, SLOT_LABEL, type SaveData } from '../progress/save'
import { guideCompletion } from '../progress/guide'
import { getPhoto } from '../photo/album'
import { starString } from '../photo/score'

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
      page.innerHTML = `
        <div class="guide-head"><img class="guide-sticker" src="${sticker}"><div><div class="guide-name">${seen ? sp.nameZh : '？？？'}</div><div class="guide-latin">${seen ? sp.nameEn : '還沒拍到'}</div></div></div>
        <div class="guide-slots">${GUIDE_SLOTS.map((s) => `<div class="guide-slot" data-slot="${s}"><div class="guide-slot-img"></div><div class="guide-slot-cap">${SLOT_LABEL[s]}</div></div>`).join('')}</div>
      `
      pages.appendChild(page)
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
