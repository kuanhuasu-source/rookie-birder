import raw from './gear.json'

export type SensorId = 'FF' | 'APSC'

export interface SensorDef { widthMm: number; heightMm: number; cocMm: number }

export interface LensDef {
  id: string; name: string
  focalMin: number; focalMax: number
  apertureAtMin: number; apertureAtMax: number
  minFocusM: number
  afSpeed: number
  isStops: number
  softWideOpenPx: number
}

export interface BodyDef {
  id: string; name: string
  sensor: SensorId
  kNoise: number
  isoMax: number
  fps: number
  bufferFrames: number
  cardWriteFps: number
  evfLagFrames: number
  blackout: boolean
  afTier: 0 | 1 | 2 | 3
  modes: ('M' | 'Av' | 'Tv' | 'P')[]
}

export interface SupportDef { id: string; name: string; shakeMul: number; panDamping: number; panMaxRadS: number }

export interface AccessoryDef {
  id: string; name: string
  alertMul?: number
  intervalMul?: number
  focalMul?: number
  apertureStops?: number
  afSpeedMul?: number
  softPx?: number
}

export interface GearData {
  sensors: Record<SensorId, SensorDef>
  lenses: LensDef[]
  bodies: BodyDef[]
  supports: SupportDef[]
  accessories: AccessoryDef[]
}

export const gear = raw as unknown as GearData

export function lensById(id: string): LensDef {
  const l = gear.lenses.find((x) => x.id === id)
  if (!l) throw new Error(`unknown lens ${id}`)
  return l
}
export function bodyById(id: string): BodyDef {
  const b = gear.bodies.find((x) => x.id === id)
  if (!b) throw new Error(`unknown body ${id}`)
  return b
}
export function supportById(id: string): SupportDef {
  const s = gear.supports.find((x) => x.id === id)
  if (!s) throw new Error(`unknown support ${id}`)
  return s
}

export function accessoryById(id: string): AccessoryDef {
  const a = gear.accessories.find((x) => x.id === id)
  if (!a) throw new Error(`unknown accessory ${id}`)
  return a
}

/** 變焦鏡的最大光圈隨焦距變化，以 stop 為單位在對數焦距上線性插值。 */
export function maxApertureAt(lens: LensDef, focalMm: number): number {
  if (lens.focalMax === lens.focalMin) return lens.apertureAtMin
  const t = (Math.log(focalMm) - Math.log(lens.focalMin)) / (Math.log(lens.focalMax) - Math.log(lens.focalMin))
  const tc = Math.min(1, Math.max(0, t))
  const stopMin = Math.log2(lens.apertureAtMin * lens.apertureAtMin)
  const stopMax = Math.log2(lens.apertureAtMax * lens.apertureAtMax)
  const stop = stopMin + (stopMax - stopMin) * tc
  return Math.sqrt(Math.pow(2, stop))
}

/** 裝備頁上的一行規格說明。 */
export function gearSpec(kind: 'lens' | 'body' | 'support' | 'accessory', id: string): string {
  if (kind === 'lens') {
    const l = lensById(id)
    const af = l.afSpeed <= 0.3 ? '極快' : l.afSpeed <= 0.4 ? '快' : l.afSpeed <= 0.7 ? '中等' : '慢'
    const prime = l.focalMax === l.focalMin
    return `${prime ? '定焦' : '變焦'} · 最近 ${l.minFocusM} m · 防手震 ${l.isStops ? `${l.isStops} 格` : '無'} · 對焦${af} · 全開${l.softWideOpenPx >= 1 ? '偏鬆' : l.softWideOpenPx >= 0.5 ? '尚可' : '銳利'}`
  }
  if (kind === 'body') {
    const b = bodyById(id)
    const af = ['手動對焦', 'AF-S 單點', 'AF-C 追焦', '鳥眼 AF'][b.afTier] ?? ''
    return `${b.sensor === 'FF' ? '全幅' : 'APS-C ×1.6'} · ISO 上限 ${b.isoMax} · 噪點 ${b.kNoise} · ${b.fps} fps · 緩衝 ${b.bufferFrames} 張 · ${af}${b.blackout ? ' · 連拍黑屏' : ''}${b.evfLagFrames ? ` · 延遲 ${b.evfLagFrames} 幀` : ''}`
  }
  if (kind === 'support') {
    const s = supportById(id)
    return `手震 ×${s.shakeMul}${s.panDamping ? ` · 雲台阻尼 ${s.panDamping}` : ''}${s.panMaxRadS ? ` · 轉速上限 ${s.panMaxRadS} rad/s` : ''}`
  }
  const a = accessoryById(id)
  const parts: string[] = []
  if (a.focalMul) parts.push(`焦距 ×${a.focalMul}`)
  if (a.apertureStops) parts.push(`光圈少 ${a.apertureStops} 格`)
  if (a.afSpeedMul) parts.push(`對焦慢 ${a.afSpeedMul} 倍`)
  if (a.softPx) parts.push(`柔化 +${a.softPx} px`)
  if (a.alertMul) parts.push(`警戒 ×${a.alertMul}`)
  if (a.intervalMul) parts.push(`鳥更常來 ×${a.intervalMul}`)
  return parts.join(' · ')
}
