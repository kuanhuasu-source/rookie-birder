import type { LevelDef, QuestDef } from './types'
import type { PhotoRecord } from '../photo/types'
import { slotForState } from '../progress/guide'

const inFrame = (p: PhotoRecord) => p.metrics.birdInFrame
const is = (p: PhotoRecord, id: string) => inFrame(p) && p.metrics.species === id
const slot = (p: PhotoRecord) => slotForState(p.metrics.birdState)

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
    species: { 'common-kingfisher': 0.3, 'white-wagtail': 0.4, 'little-egret': 0.3 },
    quests: [
      q('s1-kf', '拍到翠鳥停棲，三星以上', '牠會停很久，慢慢對眼睛', 25, (p) => is(p, 'common-kingfisher') && slot(p) === 'perched' && p.score.stars >= 3),
      q('s1-egret', '小白鷺白色羽毛不過曝，曝光 20 分以上', '白色主體要比相機以為的再暗一點', 25, (p) => is(p, 'little-egret') && p.score.exposure >= 20),
      q('s1-wag', '白鶺鴒的動作格，兩星以上', '牠一直走一直擺尾，快門要快', 20, (p) => is(p, 'white-wagtail') && slot(p) === 'action' && p.score.stars >= 2),
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
]

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]))

/** 第一關永遠開；之後的關卡要前一關至少完成一個任務。 */
export function isLevelUnlocked(level: LevelDef, questsDone: Set<string>): boolean {
  const idx = LEVELS.indexOf(level)
  if (idx <= 0) return true
  const prev = LEVELS[idx - 1]
  return prev.quests.some((qq) => questsDone.has(qq.id))
}
