import type { LevelDef, QuestDef } from './types'
import type { PhotoRecord } from '../photo/types'
import { slotForState } from '../progress/guide'
import { TRAIN_IDS } from '../birds/species'

const inFrame = (p: PhotoRecord) => p.metrics.birdInFrame
const is = (p: PhotoRecord, id: string) => inFrame(p) && p.metrics.species === id
const slot = (p: PhotoRecord) => slotForState(p.metrics.birdState)
const isTrain = (p: PhotoRecord) => p.metrics.birdInFrame && !!p.metrics.species && TRAIN_IDS.has(p.metrics.species)

function q(id: string, title: string, hint: string, reward: number, check: (p: PhotoRecord) => boolean): QuestDef {
  return { id, title, hint, reward, check }
}

/** 每個任務點名一個攝影觀念。 */
export const LEVELS: LevelDef[] = [
  {
    id: 'park-morning', chapter: 1, title: '公園草地 · 上午', subtitle: '晴，光線充足，從這裡開始',
    sceneId: 'park', time: 'morning', weather: 'sunny',
    species: { 'spotted-dove': 0.25, 'light-vented-bulbul': 0.35, 'tree-sparrow': 0.3, 'swinhoes-white-eye': 0.1 },
    quests: [
      q('p1-bulbul', '拍到白頭翁停棲，三星以上', '焦距拉夠、對焦在眼睛', 20, (p) => is(p, 'light-vented-bulbul') && slot(p) === 'perched' && p.score.stars >= 3),
      q('p1-freeze', '用 1/1000 以上凍結任何鳥的起飛或飛行', '聽到叫聲就把快門調快，按住連拍', 25, (p) => inFrame(p) && (slot(p) === 'takeoff' || slot(p) === 'flight') && p.settings.shutterS <= 1 / 1000 && p.score.stars >= 2),
      q('p1-compose', '一張構圖 20 分以上的照片', '鳥眼放在三分點，視線前方留白', 20, (p) => inFrame(p) && p.score.composition >= 20),
    ],
    durationS: 480, cardCapacity: 60, intervalMul: 0.8,
  },
  {
    id: 'park-dusk', chapter: 1, title: '公園草地 · 黃昏', subtitle: '晴，光線變弱、變暖',
    sceneId: 'park', time: 'dusk', weather: 'sunny',
    species: { 'spotted-dove': 0.2, 'light-vented-bulbul': 0.3, 'tree-sparrow': 0.2, 'swinhoes-white-eye': 0.1, 'black-bulbul': 0.2 },
    quests: [
      q('p2-black', 'ISO 3200 以下拍到紅嘴黑鵯，曝光 15 分以上', '黑色的鳥容易死黑，光圈開大、快門別太快', 25, (p) => is(p, 'black-bulbul') && p.settings.iso <= 3200 && p.score.exposure >= 15),
      q('p2-front', '順光拍到任何鳥，姿態分 10 以上', '太陽在你背後時眼睛才有眼神光', 20, (p) => inFrame(p) && (p.metrics.lightAngleDeg ?? 180) < 70 && p.score.moment >= 10),
      q('p2-small', '綠繡眼佔畫面高度 25% 以上', '牠很小，焦距拉到底、等牠靠近', 25, (p) => is(p, 'swinhoes-white-eye') && p.metrics.birdHeightFrac >= 0.25 && p.score.stars >= 2),
    ],
    durationS: 480, cardCapacity: 60, intervalMul: 0.9,
  },
  {
    id: 'stream-dawn', chapter: 2, title: '溪流 · 清晨', subtitle: '晴，低角度的光，水邊有霧氣',
    sceneId: 'stream', time: 'dawn', weather: 'sunny',
    species: { 'common-kingfisher': 0.28, 'white-wagtail': 0.3, 'little-egret': 0.22, 'taiwan-whistling-thrush': 0.2 },
    quests: [
      q('s1-kf', '拍到翠鳥停棲，三星以上', '牠會停很久，慢慢對眼睛', 25, (p) => is(p, 'common-kingfisher') && slot(p) === 'perched' && p.score.stars >= 3),
      q('s1-egret', '小白鷺白色羽毛不過曝，曝光 20 分以上', '白色主體要比相機以為的再暗一點', 25, (p) => is(p, 'little-egret') && p.score.exposure >= 20),
      q('s1-wag', '白鶺鴒的動作格，兩星以上', '牠一直走一直擺尾，快門要快', 20, (p) => is(p, 'white-wagtail') && slot(p) === 'action' && p.score.stars >= 2),
      q('s1-thrush', '台灣紫嘯鶇不死黑，曝光 18 分以上', '深藍黑的鳥在暗處，少給半格保住光澤，別讓石頭過曝', 25, (p) => is(p, 'taiwan-whistling-thrush') && p.score.exposure >= 18),
    ],
    durationS: 480, cardCapacity: 60, intervalMul: 0.9,
  },
  {
    id: 'stream-overcast', chapter: 2, title: '溪流 · 上午', subtitle: '陰，光線平，考驗 ISO 的取捨',
    sceneId: 'stream', time: 'morning', weather: 'overcast',
    species: { 'common-kingfisher': 0.35, 'white-wagtail': 0.35, 'little-egret': 0.3 },
    quests: [
      q('s2-kfflight', '翠鳥起飛或飛行，兩星以上', '牠離開前會先蹲低，按住連拍', 30, (p) => is(p, 'common-kingfisher') && (slot(p) === 'takeoff' || slot(p) === 'flight') && p.score.stars >= 2),
      q('s2-bokeh', 'f/6.3 以下拍到任何鳥，背景分離', '陰天光圈全開，背景遠一點就化開', 20, (p) => inFrame(p) && p.settings.fNumber <= 6.3 && (p.score.detail.bgSep ?? 0) >= 0.6 && p.score.stars >= 2),
      q('s2-iso', 'ISO 6400 以下拍到四星', '陰天不要硬拉 ISO，用光圈與快門換', 30, (p) => inFrame(p) && p.settings.iso <= 6400 && p.score.stars >= 4),
    ],
    durationS: 480, cardCapacity: 60, intervalMul: 0.9,
  },
  {
    id: 'wetland-noon', chapter: 3, title: '濕地 · 正午', subtitle: '晴，硬光、遠距離，天空很大',
    sceneId: 'wetland', time: 'noon', weather: 'sunny',
    species: { 'night-heron': 0.25, 'black-winged-stilt': 0.27, 'black-winged-kite': 0.12, 'common-moorhen': 0.15, 'little-grebe': 0.15, 'crested-serpent-eagle': 0.06 },
    quests: [
      q('w1-heron', '拍到夜鷺停棲，三星以上', '牠不太動，但很遠，焦距要夠', 25, (p) => is(p, 'night-heron') && slot(p) === 'perched' && p.score.stars >= 3),
      q('w1-stilt', '高蹺鴴的動作格，兩星以上', '牠一直在走，快門要跟上腳步', 25, (p) => is(p, 'black-winged-stilt') && slot(p) === 'action' && p.score.stars >= 2),
      q('w1-kite', '黑翅鳶懸停的飛行格，兩星以上', '牠在空中定住的時候最好拍', 30, (p) => is(p, 'black-winged-kite') && slot(p) === 'flight' && p.score.stars >= 2),
    ],
    durationS: 540, cardCapacity: 60, intervalMul: 0.85,
  },
  {
    id: 'wetland-dusk', chapter: 3, title: '濕地 · 黃昏', subtitle: '晴，逆光、剪影與邊光',
    sceneId: 'wetland', time: 'dusk', weather: 'sunny', sunAzDeg: 350,
    species: { 'night-heron': 0.3, 'black-winged-stilt': 0.25, 'black-winged-kite': 0.15, 'common-moorhen': 0.15, 'little-grebe': 0.15 },
    quests: [
      q('w2-silhouette', '逆光拍到任何鳥，構圖 18 分以上', '剪影要靠輪廓，把牠放在乾淨的天空或水面前', 25, (p) => inFrame(p) && (p.metrics.lightAngleDeg ?? 0) > 110 && p.score.composition >= 18),
      q('w2-kite', '用 1/2000 以上拍到黑翅鳶，三星以上', '懸停時翅膀還是在動，快門不能省', 35, (p) => is(p, 'black-winged-kite') && p.settings.shutterS <= 1 / 2000 && p.score.stars >= 3),
      q('w2-iso', 'ISO 1600 以下拍到三星', '黃昏光弱，光圈開到底、穩住再拍', 30, (p) => inFrame(p) && p.settings.iso <= 1600 && p.score.stars >= 3),
      q('w2-grebe', '小鸊鷉浮上來甩水的動作格，兩星以上', '牠潛下去就先對好那片水面，等牠冒出來', 30, (p) => is(p, 'little-grebe') && slot(p) === 'action' && p.score.stars >= 2),
    ],
    durationS: 540, cardCapacity: 60, intervalMul: 0.85,
  },
  {
    id: 'field-morning', chapter: 4, title: '田野草叢 · 上午', subtitle: '晴，前景的草與背後的樹籬',
    sceneId: 'field', time: 'morning', weather: 'sunny',
    species: { 'plain-prinia': 0.32, 'scaly-breasted-munia': 0.28, 'long-tailed-shrike': 0.22, 'golden-headed-cisticola': 0.1, 'crested-serpent-eagle': 0.08 },
    quests: [
      q('f1-prinia', '拍到褐頭鷦鶯，沒被草擋住（遮擋 10% 以下），三星以上', '牠停的草穗一直在晃，等牠晃到空隙裡', 25, (p) => is(p, 'plain-prinia') && (p.metrics.stats?.occlusion ?? 1) <= 0.1 && p.score.stars >= 3),
      q('f1-munia', 'f/6.3 以下拍斑文鳥，背景分離 0.8 以上', '竹竿背後是整片田，光圈開到底就化開了；變焦鏡要退一點焦距光圈才開得大', 25, (p) => is(p, 'scaly-breasted-munia') && p.settings.fNumber <= 6.3 && (p.metrics.stats?.bgSep ?? 0) >= 0.8),
      q('f1-shrike', '拍到棕背伯勞，構圖 17 分以上', '電線後面的樹籬很近，想辦法讓背景乾淨', 30, (p) => is(p, 'long-tailed-shrike') && p.score.composition >= 17),
      q('f1-eagle', '大冠鷲盤旋的飛行格，三星以上', '牠在高空繞大圈，追焦跟著圓弧走；背景是天空，曝光往上加一格', 40, (p) => is(p, 'crested-serpent-eagle') && slot(p) === 'flight' && p.score.stars >= 3),
    ],
    durationS: 540, cardCapacity: 60, intervalMul: 0.9,
  },
  {
    id: 'field-dusk', chapter: 4, title: '田野草叢 · 黃昏', subtitle: '晴，前景虛化與低光',
    sceneId: 'field', time: 'dusk', weather: 'sunny',
    species: { 'plain-prinia': 0.3, 'scaly-breasted-munia': 0.25, 'long-tailed-shrike': 0.25, 'golden-headed-cisticola': 0.2 },
    quests: [
      q('f2-through', '隔著前景的草拍：草擋住 25% 以上但糊到幾乎看不見（有效遮擋 15% 以下），三星', '趴低、貼近前景、光圈開到底，草就化成一層顏色', 35, (p) => inFrame(p) && (p.metrics.stats?.rawOcclusion ?? 0) >= 0.25 && (p.metrics.stats?.occlusion ?? 1) <= 0.15 && p.score.stars >= 3),
      q('f2-cisticola', '黃頭扇尾鶯的動作格，兩星以上', '牠最小也最不安分，先對好草穗等牠', 30, (p) => is(p, 'golden-headed-cisticola') && slot(p) === 'action' && p.score.stars >= 2),
      q('f2-iso', 'ISO 3200 以下拍到四星', '黃昏在草叢裡光很弱，支撐和光圈都要用上', 30, (p) => inFrame(p) && p.settings.iso <= 3200 && p.score.stars >= 4),
    ],
    durationS: 540, cardCapacity: 60, intervalMul: 0.9,
  },
  {
    id: 'forest-morning', chapter: 5, title: '林地 · 上午', subtitle: '樹冠下很暗，光斑會輪流照到停棲點',
    sceneId: 'forest', time: 'morning', weather: 'sunny', shadeEv: 9,
    species: { 'taiwan-barbet': 0.32, 'taiwan-yuhina': 0.3, 'black-naped-monarch': 0.22, 'taiwan-blue-magpie': 0.13, 'fairy-pitta': 0.03 },
    quests: [
      q('l1-barbet', '拍到五色鳥停棲，三星以上', '牠在果樹上，顏色很多，眼睛周圍的紅斑是對焦目標', 25, (p) => is(p, 'taiwan-barbet') && slot(p) === 'perched' && p.score.stars >= 3),
      q('l1-spot', '在光斑裡拍到任何鳥，曝光 20 分以上', '光斑裡的鳥比周圍亮兩格，要替牠減曝光，背景暗沒關係', 30, (p) => inFrame(p) && !!p.metrics.sunlit && p.score.exposure >= 20),
      q('l1-iso', 'ISO 6400 以上拍到三星', '樹冠下光很少，高 ISO 的噪點是必要的代價，穩住就好', 30, (p) => inFrame(p) && p.settings.iso >= 6400 && p.score.stars >= 3),
    ],
    durationS: 600, cardCapacity: 60, intervalMul: 1.1,
  },
  {
    id: 'forest-dusk', chapter: 5, title: '林地 · 黃昏', subtitle: '更暗，稀有的鳥要等',
    sceneId: 'forest', time: 'dusk', weather: 'sunny', shadeEv: 7,
    species: { 'taiwan-barbet': 0.22, 'taiwan-yuhina': 0.25, 'black-naped-monarch': 0.22, 'taiwan-blue-magpie': 0.23, 'fairy-pitta': 0.08 },
    quests: [
      q('l2-magpie', '拍到台灣藍鵲，三星以上', '尾巴很長，構圖要留位置給牠的尾巴', 30, (p) => is(p, 'taiwan-blue-magpie') && p.score.stars >= 3),
      q('l2-monarch', '黑枕藍鶲的動作格，兩星以上', '牠在枝間飛來飛去抓蟲，等牠回到枯枝的瞬間', 30, (p) => is(p, 'black-naped-monarch') && slot(p) === 'action' && p.score.stars >= 2),
      q('l2-pitta', '拍到八色鳥', '傳說中的鳥，先聽到聲音才會出現；牠在倒木旁的地面，耐心等', 60, (p) => is(p, 'fairy-pitta')),
    ],
    durationS: 600, cardCapacity: 60, intervalMul: 1.1,
  },
  {
    id: 'rail-dusk', chapter: 6, title: '鐵道 · 黃昏', subtitle: '隱藏關：火車橫向通過，考的是準備與按下快門的時機', hidden: true, alwaysUnlocked: true,
    sceneId: 'rail', time: 'dusk', weather: 'sunny', sunAzDeg: 300,
    species: { 'local-train': 0.35, 'classic-express': 0.25, 'blue-ordinary': 0.2, 'tilting-express': 0.2 },
    quests: [
      q('r-first', '拍到任何一列火車，三星以上', '先聽到汽笛，車在畫面裡只有一兩秒：焦距退到裝得下車高，焦點預先放在鐵軌上', 40, (p) => isTrain(p) && p.score.stars >= 3),
      q('r-lead', '車頭前面留行進空間，構圖 20 分以上', '車頭放在後三分之一，前面留空讓它「開進畫面」', 40, (p) => isTrain(p) && p.score.composition >= 20),
      q('r-freeze', '1/2000 以上凍結車身，對焦 27 分以上', '每秒十幾二十公尺的車，快門不夠快就是一道色塊', 50, (p) => isTrain(p) && p.settings.shutterS <= 1 / 2000 && p.score.focus >= 27),
      q('r-express', '拍到傾斜式快車，三星以上', '時速一百二，從汽笛到車頭進畫面不到三秒；一切都要先準備好', 60, (p) => p.metrics.species === 'tilting-express' && p.score.stars >= 3),
    ],
    durationS: 420, cardCapacity: 60, intervalMul: 1.0,
  },
]

/** 章節名稱 */
export const CHAPTER_NAME: Record<number, string> = { 1: '公園草地', 2: '溪流', 3: '濕地', 4: '田野草叢', 5: '林地', 6: '鐵道（隱藏關）' }

/** 這種鳥會出現在哪些章節。 */
export function chaptersOf(speciesId: string): number[] {
  return [...new Set(LEVELS.filter((l) => (l.species[speciesId] ?? 0) > 0).map((l) => l.chapter))]
}

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]))

/** 第一關永遠開；之後的關卡要前一關至少完成一個任務。 */
export function isLevelUnlocked(level: LevelDef, questsDone: Set<string>): boolean {
  if (level.alwaysUnlocked) return true
  const idx = LEVELS.indexOf(level)
  if (idx <= 0) return true
  const prev = LEVELS[idx - 1]
  return prev.quests.some((qq) => questsDone.has(qq.id))
}
