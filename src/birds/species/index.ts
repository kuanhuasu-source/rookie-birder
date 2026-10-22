import type { SpeciesDef, SpriteDef } from '../types'
import { spottedDove } from './spotted-dove'
import bulbulGen from './generated/light-vented-bulbul.json'
import sparrowGen from './generated/tree-sparrow.json'
import whiteEyeGen from './generated/swinhoes-white-eye.json'
import blackBulbulGen from './generated/black-bulbul.json'
import kingfisherGen from './generated/common-kingfisher.json'
import wagtailGen from './generated/white-wagtail.json'
import egretGen from './generated/little-egret.json'
import nightHeronGen from './generated/night-heron.json'
import stiltGen from './generated/black-winged-stilt.json'
import kiteGen from './generated/black-winged-kite.json'
import moorhenGen from './generated/common-moorhen.json'
import priniaGen from './generated/plain-prinia.json'
import muniaGen from './generated/scaly-breasted-munia.json'
import cisticolaGen from './generated/golden-headed-cisticola.json'
import shrikeGen from './generated/long-tailed-shrike.json'

interface GeneratedSprite { file: string; eyeUv: number[]; contentW: number; contentH: number; albedo: number; sizeM: number }
interface Generated { id: string; nameZh: string; nameEn: string; bodyLengthM: number; sprites: Record<'side' | '3q' | 'takeoff', GeneratedSprite> }

/** 把產圖腳本的 JSON 轉成 SpriteDef，角度由視角決定。 */
function sprites(g: Generated): SpeciesDef['sprites'] {
  const mk = (s: GeneratedSprite, view: SpriteDef['view'], angle: number): SpriteDef => ({
    file: s.file, view, eyeUv: [s.eyeUv[0], s.eyeUv[1]], contentW: s.contentW, contentH: s.contentH, sizeM: s.sizeM, viewAngleDeg: angle, albedo: s.albedo,
  })
  return { side: mk(g.sprites.side, 'side', 90), '3q': mk(g.sprites['3q'], '3q', 45), takeoff: mk(g.sprites.takeoff, 'takeoff', 90) }
}

/** 白頭翁：公園最常見，活潑，停留中等。 */
export const lightVentedBulbul: SpeciesDef = {
  id: 'light-vented-bulbul', nameZh: '白頭翁', nameEn: 'Light-vented Bulbul',
  bodyHeightM: 0.10, albedo: bulbulGen.sprites.side.albedo,
  sprites: sprites(bulbulGen as Generated),
  dwell: { min: 10, max: 26 }, interval: { min: 8, max: 20 },
  stateDurations: { S1: { min: 1.5, max: 4 }, S2: { min: 1, max: 3 }, S3: { min: 0.35, max: 0.6 } },
  transitions: { S1: { S2: 0.45, S3: 0.45, S4: 0.1 }, S2: { S1: 0.5, S3: 0.4, S4: 0.1 }, S3: { S1: 0.5, S2: 0.5 } },
  flightSpeedMs: 8, hopDistM: 0.5,
  call: { baseHz: 2300, notes: 4, noteS: 0.13, gapS: 0.07 },
  rarity: 'common',
  skittish: 0.8, flushDistM: 6,
}

/** 麻雀：小、動得快、停不久。 */
export const treeSparrow: SpeciesDef = {
  id: 'tree-sparrow', nameZh: '麻雀', nameEn: 'Eurasian Tree Sparrow',
  bodyHeightM: 0.075, albedo: sparrowGen.sprites.side.albedo,
  sprites: sprites(sparrowGen as Generated),
  dwell: { min: 7, max: 18 }, interval: { min: 6, max: 16 },
  stateDurations: { S1: { min: 0.8, max: 2.5 }, S2: { min: 0.8, max: 2 }, S3: { min: 0.3, max: 0.5 } },
  transitions: { S1: { S2: 0.35, S3: 0.55, S4: 0.1 }, S2: { S1: 0.4, S3: 0.5, S4: 0.1 }, S3: { S1: 0.5, S2: 0.5 } },
  flightSpeedMs: 9, hopDistM: 0.4,
  call: { baseHz: 3000, notes: 3, noteS: 0.1, gapS: 0.06 },
  rarity: 'common',
  skittish: 1.0, flushDistM: 5,
}

/** 綠繡眼：很小、很活潑，需要長焦距。 */
export const swinhoesWhiteEye: SpeciesDef = {
  id: 'swinhoes-white-eye', nameZh: '綠繡眼', nameEn: "Swinhoe's White-eye",
  bodyHeightM: 0.06, albedo: whiteEyeGen.sprites.side.albedo,
  sprites: sprites(whiteEyeGen as Generated),
  dwell: { min: 6, max: 14 }, interval: { min: 10, max: 24 },
  stateDurations: { S1: { min: 0.6, max: 1.8 }, S2: { min: 0.6, max: 1.6 }, S3: { min: 0.25, max: 0.45 } },
  transitions: { S1: { S2: 0.3, S3: 0.6, S4: 0.1 }, S2: { S1: 0.3, S3: 0.6, S4: 0.1 }, S3: { S1: 0.4, S2: 0.6 } },
  flightSpeedMs: 9, hopDistM: 0.35,
  call: { baseHz: 4000, notes: 5, noteS: 0.08, gapS: 0.05 },
  rarity: 'common',
  skittish: 1.2, flushDistM: 5,
}

/** 紅嘴黑鵯：全黑，曝光的考題；停留較久。 */
export const blackBulbul: SpeciesDef = {
  id: 'black-bulbul', nameZh: '紅嘴黑鵯', nameEn: 'Black Bulbul',
  bodyHeightM: 0.12, albedo: blackBulbulGen.sprites.side.albedo,
  sprites: sprites(blackBulbulGen as Generated),
  dwell: { min: 12, max: 28 }, interval: { min: 15, max: 35 },
  stateDurations: { S1: { min: 2, max: 5 }, S2: { min: 1.2, max: 3 }, S3: { min: 0.4, max: 0.7 } },
  transitions: { S1: { S2: 0.5, S3: 0.4, S4: 0.1 }, S2: { S1: 0.6, S3: 0.3, S4: 0.1 }, S3: { S1: 0.6, S2: 0.4 } },
  flightSpeedMs: 8, hopDistM: 0.5,
  call: { baseHz: 1900, notes: 2, noteS: 0.25, gapS: 0.12 },
  rarity: 'rare',
  skittish: 1.0, flushDistM: 8,
}

/** 翠鳥：停很久、動作少，但離開前會突然俯衝；起飛是重頭戲。 */
export const commonKingfisher: SpeciesDef = {
  id: 'common-kingfisher', nameZh: '翠鳥', nameEn: 'Common Kingfisher',
  bodyHeightM: 0.09, albedo: kingfisherGen.sprites.side.albedo,
  sprites: sprites(kingfisherGen as Generated),
  dwell: { min: 20, max: 45 }, interval: { min: 18, max: 40 },
  stateDurations: { S1: { min: 4, max: 10 }, S2: { min: 1, max: 2.5 }, S3: { min: 0.3, max: 0.5 } },
  transitions: { S1: { S2: 0.6, S3: 0.25, S4: 0.15 }, S2: { S1: 0.75, S3: 0.15, S4: 0.1 }, S3: { S1: 0.7, S2: 0.3 } },
  flightSpeedMs: 11, hopDistM: 0.3,
  call: { baseHz: 5200, notes: 2, noteS: 0.09, gapS: 0.05 },
  rarity: 'rare',
  skittish: 1.3, flushDistM: 9,
}

/** 白鶺鴒：一直走、一直擺尾，動作格的練習。 */
export const whiteWagtail: SpeciesDef = {
  id: 'white-wagtail', nameZh: '白鶺鴒', nameEn: 'White Wagtail',
  bodyHeightM: 0.08, albedo: wagtailGen.sprites.side.albedo,
  sprites: sprites(wagtailGen as Generated),
  dwell: { min: 8, max: 20 }, interval: { min: 8, max: 18 },
  stateDurations: { S1: { min: 0.6, max: 1.8 }, S2: { min: 0.8, max: 2 }, S3: { min: 0.35, max: 0.6 } },
  transitions: { S1: { S2: 0.3, S3: 0.6, S4: 0.1 }, S2: { S1: 0.3, S3: 0.6, S4: 0.1 }, S3: { S1: 0.4, S2: 0.6 } },
  flightSpeedMs: 9, hopDistM: 0.5,
  call: { baseHz: 3600, notes: 2, noteS: 0.1, gapS: 0.08 },
  rarity: 'common',
  skittish: 0.9, flushDistM: 6,
}

/** 小白鷺：大、慢、全白，曝光的考題。 */
export const littleEgret: SpeciesDef = {
  id: 'little-egret', nameZh: '小白鷺', nameEn: 'Little Egret',
  bodyHeightM: 0.45, albedo: egretGen.sprites.side.albedo,
  sprites: sprites(egretGen as Generated),
  dwell: { min: 20, max: 45 }, interval: { min: 15, max: 35 },
  stateDurations: { S1: { min: 3, max: 8 }, S2: { min: 1.5, max: 4 }, S3: { min: 0.8, max: 1.4 } },
  transitions: { S1: { S2: 0.5, S3: 0.4, S4: 0.1 }, S2: { S1: 0.6, S3: 0.3, S4: 0.1 }, S3: { S1: 0.6, S2: 0.4 } },
  flightSpeedMs: 6, hopDistM: 0.8,
  call: { baseHz: 700, notes: 1, noteS: 0.35, gapS: 0.1 },
  rarity: 'common',
  skittish: 1.1, flushDistM: 12,
}

/** 夜鷺：第三章的遠距離定點題，幾乎不動，但站得遠。 */
export const nightHeron: SpeciesDef = {
  id: 'night-heron', nameZh: '夜鷺', nameEn: 'Black-crowned Night Heron',
  bodyHeightM: 0.40, albedo: nightHeronGen.sprites.side.albedo,
  sprites: sprites(nightHeronGen as Generated),
  dwell: { min: 30, max: 60 }, interval: { min: 15, max: 35 },
  stateDurations: { S1: { min: 5, max: 12 }, S2: { min: 1.5, max: 4 }, S3: { min: 0.8, max: 1.4 } },
  transitions: { S1: { S2: 0.7, S3: 0.25, S4: 0.05 }, S2: { S1: 0.8, S3: 0.15, S4: 0.05 }, S3: { S1: 0.8, S2: 0.2 } },
  flightSpeedMs: 7, hopDistM: 0.6,
  call: { baseHz: 500, notes: 1, noteS: 0.25, gapS: 0.1 },
  rarity: 'common',
  skittish: 0.8, flushDistM: 14,
}

/** 高蹺鴴：一直在泥灘上走動覓食的動作題。 */
export const blackWingedStilt: SpeciesDef = {
  id: 'black-winged-stilt', nameZh: '高蹺鴴', nameEn: 'Black-winged Stilt',
  bodyHeightM: 0.36, albedo: stiltGen.sprites.side.albedo,
  sprites: sprites(stiltGen as Generated),
  dwell: { min: 20, max: 40 }, interval: { min: 12, max: 28 },
  stateDurations: { S1: { min: 1, max: 2.5 }, S2: { min: 1, max: 2.5 }, S3: { min: 0.9, max: 1.6 } },
  transitions: { S1: { S2: 0.3, S3: 0.65, S4: 0.05 }, S2: { S1: 0.2, S3: 0.75, S4: 0.05 }, S3: { S1: 0.3, S2: 0.3, S3: 0.4 } },
  flightSpeedMs: 9, hopDistM: 1.2,
  call: { baseHz: 2400, notes: 3, noteS: 0.08, gapS: 0.06 },
  rarity: 'common',
  skittish: 1.2, flushDistM: 12,
}

/** 黑翅鳶：不停棲，在水面上空懸停，是飛行題的入門。 */
export const blackWingedKite: SpeciesDef = {
  id: 'black-winged-kite', nameZh: '黑翅鳶', nameEn: 'Black-winged Kite',
  bodyHeightM: 0.35, albedo: kiteGen.sprites.side.albedo,
  sprites: sprites(kiteGen as Generated),
  dwell: { min: 10, max: 18 }, interval: { min: 25, max: 50 },
  stateDurations: { S1: { min: 2, max: 4 }, S2: { min: 1, max: 2 }, S3: { min: 0.5, max: 0.9 } },
  transitions: { S1: { S2: 0.5, S3: 0.4, S4: 0.1 }, S2: { S1: 0.5, S3: 0.4, S4: 0.1 }, S3: { S1: 0.5, S2: 0.5 } },
  flightSpeedMs: 10, hopDistM: 0.5,
  call: { baseHz: 1800, notes: 2, noteS: 0.15, gapS: 0.1 },
  rarity: 'rare',
  skittish: 0.7, flushDistM: 20,
  hovers: true, hoverHeightM: 8,
}

/** 紅冠水雞：在水面邊慢慢游走，紅色額甲是對焦與曝光的好目標。 */
export const commonMoorhen: SpeciesDef = {
  id: 'common-moorhen', nameZh: '紅冠水雞', nameEn: 'Common Moorhen',
  bodyHeightM: 0.28, albedo: moorhenGen.sprites.side.albedo,
  sprites: sprites(moorhenGen as Generated),
  dwell: { min: 18, max: 36 }, interval: { min: 12, max: 26 },
  stateDurations: { S1: { min: 2, max: 5 }, S2: { min: 1.5, max: 3 }, S3: { min: 1.0, max: 1.8 } },
  transitions: { S1: { S2: 0.5, S3: 0.45, S4: 0.05 }, S2: { S1: 0.5, S3: 0.45, S4: 0.05 }, S3: { S1: 0.5, S2: 0.5 } },
  flightSpeedMs: 6, hopDistM: 0.9,
  call: { baseHz: 1200, notes: 1, noteS: 0.2, gapS: 0.1 },
  rarity: 'common',
  skittish: 1.0, flushDistM: 9,
}

/** 褐頭鷦鶯：停在芒草穗上跟著風晃，尾巴翹得高，停留不長。 */
export const plainPrinia: SpeciesDef = {
  id: 'plain-prinia', nameZh: '褐頭鷦鶯', nameEn: 'Plain Prinia',
  bodyHeightM: 0.07, albedo: priniaGen.sprites.side.albedo,
  sprites: sprites(priniaGen as Generated),
  dwell: { min: 8, max: 18 }, interval: { min: 8, max: 18 },
  stateDurations: { S1: { min: 1, max: 3 }, S2: { min: 0.8, max: 2 }, S3: { min: 0.3, max: 0.5 } },
  transitions: { S1: { S2: 0.5, S3: 0.4, S4: 0.1 }, S2: { S1: 0.5, S3: 0.4, S4: 0.1 }, S3: { S1: 0.5, S2: 0.5 } },
  flightSpeedMs: 6, hopDistM: 0.2,
  call: { baseHz: 4200, notes: 4, noteS: 0.06, gapS: 0.05 },
  rarity: 'common',
  skittish: 1.0, flushDistM: 4,
}

/** 斑文鳥：成群停在竹竿上，很安分，背後是整片田。 */
export const scalyBreastedMunia: SpeciesDef = {
  id: 'scaly-breasted-munia', nameZh: '斑文鳥', nameEn: 'Scaly-breasted Munia',
  bodyHeightM: 0.07, albedo: muniaGen.sprites.side.albedo,
  sprites: sprites(muniaGen as Generated),
  dwell: { min: 14, max: 30 }, interval: { min: 10, max: 22 },
  stateDurations: { S1: { min: 2, max: 5 }, S2: { min: 1, max: 2.5 }, S3: { min: 0.3, max: 0.5 } },
  transitions: { S1: { S2: 0.55, S3: 0.35, S4: 0.1 }, S2: { S1: 0.6, S3: 0.3, S4: 0.1 }, S3: { S1: 0.6, S2: 0.4 } },
  flightSpeedMs: 7, hopDistM: 0.3,
  call: { baseHz: 3000, notes: 2, noteS: 0.08, gapS: 0.1 },
  rarity: 'common',
  skittish: 0.9, flushDistM: 5,
}

/** 黃頭扇尾鶯：最小、最不安分，一直在草穗間跳。 */
export const goldenHeadedCisticola: SpeciesDef = {
  id: 'golden-headed-cisticola', nameZh: '黃頭扇尾鶯', nameEn: 'Golden-headed Cisticola',
  bodyHeightM: 0.06, albedo: cisticolaGen.sprites.side.albedo,
  sprites: sprites(cisticolaGen as Generated),
  dwell: { min: 6, max: 14 }, interval: { min: 12, max: 26 },
  stateDurations: { S1: { min: 0.6, max: 1.8 }, S2: { min: 0.6, max: 1.5 }, S3: { min: 0.25, max: 0.45 } },
  transitions: { S1: { S2: 0.35, S3: 0.55, S4: 0.1 }, S2: { S1: 0.3, S3: 0.6, S4: 0.1 }, S3: { S1: 0.4, S2: 0.3, S3: 0.3 } },
  flightSpeedMs: 6, hopDistM: 0.25,
  call: { baseHz: 5000, notes: 3, noteS: 0.05, gapS: 0.04 },
  rarity: 'rare',
  skittish: 1.1, flushDistM: 4,
}

/** 棕背伯勞：站在電線上守著，背後是近的樹籬，背景分離的考題。 */
export const longTailedShrike: SpeciesDef = {
  id: 'long-tailed-shrike', nameZh: '棕背伯勞', nameEn: 'Long-tailed Shrike',
  bodyHeightM: 0.14, albedo: shrikeGen.sprites.side.albedo,
  sprites: sprites(shrikeGen as Generated),
  dwell: { min: 16, max: 35 }, interval: { min: 14, max: 30 },
  stateDurations: { S1: { min: 2.5, max: 6 }, S2: { min: 1, max: 2.5 }, S3: { min: 0.5, max: 0.9 } },
  transitions: { S1: { S2: 0.5, S3: 0.4, S4: 0.1 }, S2: { S1: 0.6, S3: 0.3, S4: 0.1 }, S3: { S1: 0.6, S2: 0.4 } },
  flightSpeedMs: 9, hopDistM: 1.2,
  call: { baseHz: 2600, notes: 3, noteS: 0.1, gapS: 0.07 },
  rarity: 'common',
  skittish: 0.8, flushDistM: 7,
}

export const SPECIES: SpeciesDef[] = [spottedDove, lightVentedBulbul, treeSparrow, swinhoesWhiteEye, blackBulbul, commonKingfisher, whiteWagtail, littleEgret, nightHeron, blackWingedStilt, blackWingedKite, commonMoorhen, plainPrinia, scalyBreastedMunia, goldenHeadedCisticola, longTailedShrike]
export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]))

/** 第一章公園草地的出現權重。 */
export const PARK_WEIGHTS: Record<string, number> = {
  'spotted-dove': 0.22,
  'light-vented-bulbul': 0.3,
  'tree-sparrow': 0.25,
  'swinhoes-white-eye': 0.13,
  'black-bulbul': 0.1,
}

export function speciesName(id: string | undefined): string {
  return (id && SPECIES_BY_ID[id]?.nameZh) || ''
}
