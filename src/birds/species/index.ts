import type { SpeciesDef, SpriteDef } from '../types'
import { spottedDove } from './spotted-dove'
import bulbulGen from './generated/light-vented-bulbul.json'
import sparrowGen from './generated/tree-sparrow.json'
import whiteEyeGen from './generated/swinhoes-white-eye.json'
import blackBulbulGen from './generated/black-bulbul.json'

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
}

export const SPECIES: SpeciesDef[] = [spottedDove, lightVentedBulbul, treeSparrow, swinhoesWhiteEye, blackBulbul]
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
