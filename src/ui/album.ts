import { listPhotos, deletePhoto } from '../photo/album'
import type { PhotoRecord } from '../photo/types'
import { formatShutter } from '../camera/exposure'
import { starString } from '../photo/score'
import { speciesName } from '../birds/species'

function fmtAperture(n: number): string {
  return `f/${n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)}`
}

export function describe(p: PhotoRecord): string {
  const s = p.settings
  return `${Math.round(s.focalMm)}mm ${fmtAperture(s.fNumber)} ${formatShutter(s.shutterS)} ISO ${s.iso}`
}

export function metricsLine(p: PhotoRecord): string {
  const m = p.metrics
  if (!m.birdInFrame) return '鳥不在畫面內'
  const o = m.overStops
  return `${speciesName(m.species)} ${m.birdState ?? ''} · 鳥眼 ${m.distM.toFixed(1)}m · 模糊圈 ${m.cocPx.toFixed(1)}px · 動態 ${m.motionPx.toFixed(1)}px · 手震 ${m.shakePx.toFixed(1)}px · 總計 ${m.totalBlurPx.toFixed(1)}px · 曝光 ${o > 0 ? '+' : ''}${o.toFixed(1)} 格`
}

/** 相簿：縮圖格 + 單張檢視。 */
export class AlbumView {
  root: HTMLElement
  private grid: HTMLElement
  private viewer: HTMLElement
  private urls: string[] = []
  open = false

  constructor(private onClose: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'album hidden'
    this.root.innerHTML = `
      <div class="album-bar"><span class="tape"></span><strong>相簿</strong><span class="album-count"></span><button class="album-export">匯出紀錄</button><button class="album-close">關閉 (Esc)</button></div>
      <div class="album-grid"></div>
      <div class="album-viewer hidden"><div class="album-photo"><img></div><div class="album-info"></div><div class="album-actions"><button class="album-back">返回</button><button class="album-delete">刪除</button></div></div>
    `
    document.body.appendChild(this.root)
    this.grid = this.root.querySelector('.album-grid')!
    this.viewer = this.root.querySelector('.album-viewer')!
    this.root.querySelector('.album-close')!.addEventListener('click', () => this.hide())
    this.root.querySelector('.album-export')!.addEventListener('click', () => void this.exportJson())
    this.root.querySelector('.album-back')!.addEventListener('click', () => this.viewer.classList.add('hidden'))
  }

  async show(): Promise<void> {
    this.open = true
    this.root.classList.remove('hidden')
    this.viewer.classList.add('hidden')
    await this.refresh()
  }

  hide(): void {
    this.open = false
    this.root.classList.add('hidden')
    this.revoke()
    this.onClose()
  }

  /** 匯出所有照片的設定、量測與分數（不含圖片），給測試回饋用。 */
  async exportJson(): Promise<void> {
    const photos = await listPhotos()
    const data = {
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      tutorialDone: (() => { try { return localStorage.getItem('rookie-birder.tutorialDone') === '1' } catch { return null } })(),
      photos: photos.map(({ blob: _b, thumb: _t, ...rest }) => rest),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rookie-birder-${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  private revoke(): void {
    for (const u of this.urls) URL.revokeObjectURL(u)
    this.urls = []
  }

  async refresh(): Promise<void> {
    this.revoke()
    const photos = await listPhotos()
    ;(this.root.querySelector('.album-count') as HTMLElement).textContent = `${photos.length} 張`
    this.grid.innerHTML = ''
    for (const p of photos) {
      const url = URL.createObjectURL(p.thumb)
      this.urls.push(url)
      const card = document.createElement('div')
      card.className = 'album-card'
      card.innerHTML = `<img src="${url}"><div class="cap stars">${starString(p.score?.stars ?? 0)} <span>${Math.round(p.score?.total ?? 0)}</span></div><div class="cap">${p.metrics.birdInFrame ? speciesName(p.metrics.species) + ' · ' : ''}${describe(p)}</div><div class="cap small">${p.score?.advice ?? ''}</div>`
      card.addEventListener('click', () => this.view(p))
      this.grid.appendChild(card)
    }
  }

  private view(p: PhotoRecord): void {
    const url = URL.createObjectURL(p.blob)
    this.urls.push(url)
    ;(this.viewer.querySelector('img') as HTMLImageElement).src = url
    const sc = p.score
    const bar = (label: string, v: number, max: number) => `<div class="bar"><span class="bar-label">${label}</span><span class="bar-track"><span class="bar-fill" style="width:${(v / max) * 100}%"></span></span><span class="bar-val">${Math.round(v)}/${max}</span></div>`
    ;(this.viewer.querySelector('.album-info') as HTMLElement).innerHTML =
      (sc ? `<div class="score-card"><div class="score-stars">${starString(sc.stars)} <strong>${Math.round(sc.total)}</strong> 分</div>${bar('對焦與銳利度', sc.focus, 30)}${bar('曝光', sc.exposure, 25)}${bar('構圖與背景', sc.composition, 25)}${bar('姿態與時機', sc.moment, 20)}<div class="score-advice">${sc.advice}${sc.caps.length ? `（${sc.caps.join('、')}）` : ''}</div></div>` : '') +
      `<div>${describe(p)} · 對焦 ${p.settings.focusM.toFixed(1)}m · ${p.gear.lens} / ${p.gear.body} / ${p.gear.support}</div><div>${metricsLine(p)}</div><div>${p.lighting.time} · ${p.lighting.weather} · 場景 EV ${p.lighting.evScene} · ${new Date(p.takenAt).toLocaleString()}</div>`
    const del = this.viewer.querySelector('.album-delete') as HTMLButtonElement
    del.onclick = async () => { await deletePhoto(p.id); this.viewer.classList.add('hidden'); await this.refresh() }
    this.viewer.classList.remove('hidden')
  }
}
