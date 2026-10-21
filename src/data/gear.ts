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

export interface GearData {
  sensors: Record<SensorId, SensorDef>
  lenses: LensDef[]
  bodies: BodyDef[]
  supports: SupportDef[]
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
