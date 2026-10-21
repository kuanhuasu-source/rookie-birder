import { ARTICLES } from '../knowledge/articles'

/** 攝影知識：課本式閱讀頁，左邊目錄、右邊內文與圖。 */
export class KnowledgeView {
  root: HTMLElement
  open = false
  private current = ARTICLES[0].id

  constructor(private onClose: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'know hidden'
    this.root.innerHTML = `
      <div class="album-bar"><span class="tape"></span><strong>攝影知識</strong><span class="know-sub">從成像原理到野外實戰</span><button class="album-close">關閉 (Esc)</button></div>
      <div class="know-body"><nav class="know-nav"></nav><article class="know-article"></article></div>`
    document.body.appendChild(this.root)
    this.root.querySelector('.album-close')!.addEventListener('click', () => this.hide())
    const nav = this.root.querySelector('.know-nav') as HTMLElement
    const groups: Record<string, typeof ARTICLES> = {}
    for (const a of ARTICLES) (groups[a.level] ??= []).push(a)
    nav.innerHTML = Object.entries(groups).map(([lv, list]) => `<div class="know-group">${lv}</div>${list.map((a) => `<button data-id="${a.id}">${a.title}</button>`).join('')}`).join('')
    for (const b of nav.querySelectorAll<HTMLElement>('button')) b.addEventListener('click', () => this.showArticle(b.dataset.id!))
  }

  show(id?: string): void {
    this.open = true
    this.root.classList.remove('hidden')
    this.showArticle(id ?? this.current)
  }

  hide(): void { this.open = false; this.root.classList.add('hidden'); this.onClose() }

  showArticle(id: string): void {
    const a = ARTICLES.find((x) => x.id === id) ?? ARTICLES[0]
    this.current = a.id
    const idx = ARTICLES.indexOf(a)
    const art = this.root.querySelector('.know-article') as HTMLElement
    const prev = ARTICLES[idx - 1], next = ARTICLES[idx + 1]
    art.innerHTML = `<div class="know-level">${a.level} · 第 ${idx + 1} 篇</div><h2>${a.title}</h2>${a.html}
      <div class="know-pager">${prev ? `<button data-id="${prev.id}">← ${prev.title}</button>` : '<span></span>'}${next ? `<button data-id="${next.id}">${next.title} →</button>` : '<span></span>'}</div>`
    for (const b of art.querySelectorAll<HTMLElement>('.know-pager button')) b.addEventListener('click', () => this.showArticle(b.dataset.id!))
    for (const b of this.root.querySelectorAll<HTMLElement>('.know-nav button')) b.classList.toggle('active', b.dataset.id === a.id)
    art.scrollTop = 0
  }
}
