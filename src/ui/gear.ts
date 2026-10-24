import { gear } from '../data/gear'
import { gearSpec } from '../data/gear'
import type { SaveData } from '../progress/save'
import { pull, pool, rarityOf, RARITY_LABEL, PULL_COST, PITY_RARE_AT, type GearKind } from '../progress/gacha'

/** 器材貼紙圖的路徑（由 scripts/gen_gear.py 產生）。 */
export function gearImage(id: string): string { return `${import.meta.env.BASE_URL}gear/${id}.png` }

/** 裝備與扭蛋：紙做的扭蛋機與貼紙式的器材清單。 */
export class GearView {
  root: HTMLElement
  open = false

  constructor(private getSave: () => SaveData, private onEquip: () => void, private onClose: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'gearview hidden'
    this.root.innerHTML = `
      <div class="album-bar"><span class="tape"></span><strong>裝備與扭蛋</strong><span class="gear-coins"></span><button class="album-close">關閉 (Esc)</button></div>
      <div class="gear-cols">
        <div class="gacha">
          <div class="gacha-machine"><div class="gacha-dome"></div><div class="gacha-body"><button class="gacha-pull">轉一次<br><small>${PULL_COST} 代幣</small></button></div></div>
          <div class="gacha-note">${PITY_RARE_AT} 次內必出稀有以上 · 重複會退代幣</div>
          <div class="gacha-result hidden"></div>
        </div>
        <div class="gear-note"></div>
        <div class="gear-lists"></div>
      </div>
    `
    document.body.appendChild(this.root)
    this.root.querySelector('.album-close')!.addEventListener('click', () => this.hide())
    this.root.querySelector('.gacha-pull')!.addEventListener('click', () => this.doPull())
  }

  show(): void { this.open = true; this.root.classList.remove('hidden'); this.refresh() }
  hide(): void { this.open = false; this.root.classList.add('hidden'); this.onClose() }

  private doPull(): void {
    const save = this.getSave()
    const r = pull(save)
    const box = this.root.querySelector('.gacha-result') as HTMLElement
    box.classList.remove('hidden')
    if (!r) { box.innerHTML = `<div class="gacha-card">代幣不夠，去拍幾張好照片吧</div>`; return }
    box.innerHTML = `<div class="gacha-card r-${r.item.rarity}"><img class="gacha-img" src="${gearImage(r.item.id)}" alt=""><div class="gacha-rarity">${RARITY_LABEL[r.item.rarity]}${r.pityTriggered ? ' · 保底' : ''}</div><div class="gacha-name">${r.item.name}</div><div class="gacha-sub">${r.isNew ? '新裝備！到右邊換上' : `已經有了，退回 ${r.refund} 代幣`}</div></div>`
    this.onEquip()
    this.refresh()
  }

  refresh(): void {
    const save = this.getSave()
    ;(this.root.querySelector('.gear-coins') as HTMLElement).textContent = `代幣 ${save.coins}`
    const lists = this.root.querySelector('.gear-lists') as HTMLElement
    const kinds: { kind: GearKind; title: string; items: { id: string; name: string }[] }[] = [
      { kind: 'lens', title: '鏡頭', items: gear.lenses },
      { kind: 'body', title: '機身', items: gear.bodies },
      { kind: 'support', title: '支撐', items: gear.supports },
      { kind: 'accessory', title: '配件（可多選）', items: gear.accessories },
    ]
    const note = this.root.querySelector('.gear-note') as HTMLElement | null
    if (note) note.textContent = '換器材時快門、ISO、對焦距離都會保留；焦距與光圈夾進新鏡頭的範圍。定焦鏡滾輪不變焦。APS-C 機身的視角等於焦距 ×1.6。增距鏡只能裝一個。'
    const poolIds = new Set(pool().map((i) => i.id))
    lists.innerHTML = kinds.map((k) => `
      <div class="gear-col"><div class="gear-title">${k.title}</div>${k.items.map((it) => {
        const owned = save.owned[k.kind].includes(it.id)
        const eq = k.kind === 'accessory' ? save.equipped.accessories.includes(it.id) : save.equipped[k.kind] === it.id
        const r = rarityOf(it.id)
        const name = owned ? it.name : (poolIds.has(it.id) ? '？？？' : it.name)
        return `<button class="gear-item r-${r} ${owned ? 'owned' : 'locked'} ${eq ? 'equipped' : ''}" data-kind="${k.kind}" data-id="${it.id}" ${owned ? '' : 'disabled'}><img class="gear-img" src="${gearImage(it.id)}" alt=""><span class="gear-name">${name}</span><span class="gear-spec">${owned ? gearSpec(k.kind, it.id) : ''}</span><span class="gear-tag">${eq ? (k.kind === 'accessory' ? '已裝（點一下卸下）' : '使用中') : owned ? (k.kind === 'accessory' ? '裝上' : '換上') : RARITY_LABEL[r]}</span></button>`
      }).join('')}</div>`).join('')
    for (const b of lists.querySelectorAll<HTMLButtonElement>('.gear-item.owned')) {
      b.addEventListener('click', () => {
        const s = this.getSave()
        const kind = b.dataset.kind as GearKind
        const id = b.dataset.id!
        if (kind === 'accessory') {
          const list = s.equipped.accessories
          const i = list.indexOf(id)
          if (i >= 0) list.splice(i, 1)
          else {
            // 增距鏡只能裝一個
            const tc = ['A3', 'A4']
            if (tc.includes(id)) for (const t of tc) { const j = list.indexOf(t); if (j >= 0) list.splice(j, 1) }
            list.push(id)
          }
        } else s.equipped[kind] = id
        this.onEquip()
        this.refresh()
      })
    }
  }
}
