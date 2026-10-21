import type { TutorialStep } from './types'

const inFrame = (c: { metrics: { birdInFrame: boolean } | null; overview: boolean }) => !!c.metrics?.birdInFrame && !c.overview

/** 第零課：十個步驟，每步只教一件事。提示只給方向，不給數值。 */
export const STEPS: TutorialStep[] = [
  {
    id: 'find', title: '找鳥',
    hint: ['{overview}放下相機，用眼睛找到那隻斑鳩，再{overview}舉起相機對準牠。', '長鏡頭的視野很窄，先用裸眼找，再舉相機。'],
    stuckHint: '牠在右前方的枝頭上。放下相機時視野很寬，看到牠之後{look}轉過去，再舉起相機。',
    unlocked: ['look', 'overview'],
    overlays: [],
    setup: (c) => { c.birdPlace(); c.setFocal(250); c.setFocus(10); c.setExposure(5.6, 1 / 500, 200); c.setLighting('morning', 'sunny'); c.aimOffset(0.18, 0.05) },
    done: (c) => inFrame(c),
    holdS: 0.8,
  },
  {
    id: 'zoom', title: '拉近',
    hint: ['{zoom}，把斑鳩拉到大約佔畫面高度三分之一。', '焦距決定鳥在畫面裡的大小，距離不變時只能靠焦距。', '畫面會晃是手持長鏡頭的手震，正常。{brace}；之後有防手震與腳架。'],
    stuckHint: '{zoomIn}。拉到牠的身體有畫面三分之一高就好，不用塞滿。',
    unlocked: ['look', 'overview', 'zoom'],
    overlays: [],
    setup: (c) => { c.setFocal(55) },
    done: (c) => inFrame(c) && c.metrics!.birdHeightFrac > 0.22 && c.metrics!.birdHeightFrac < 0.55,
    holdS: 0.8,
  },
  {
    id: 'focus', title: '對焦',
    hint: ['{focus}，直到斑鳩的眼睛清楚。', '長焦距的景深只有幾公分，差一點點眼睛就糊了。'],
    stuckHint: '{focusStuck}看牠的眼睛，不要看身體。',
    unlocked: ['look', 'overview', 'zoom', 'focus'],
    overlays: ['focusPoint'],
    setup: (c) => { c.setFocus(4) },
    done: (c) => inFrame(c) && c.metrics!.cocPx < 2,
    holdS: 0.8,
  },
  {
    id: 'bright', title: '太亮了',
    hint: ['畫面整個泛白，{shutterCtrl}調快門，直到看得見羽毛的細節。', '快門越快，進光越少。'],
    stuckHint: '{shutterFaster}。一次一格，看著畫面慢慢調，不用一次到位。',
    unlocked: ['look', 'shutter'],
    overlays: ['triangle'],
    setup: (c) => { c.setExposure(5.6, 1 / 30, 200) },
    done: (c) => Math.abs(c.metrics?.overStops ?? 9) < 0.6,
    holdS: 1,
  },
  {
    id: 'dark', title: '太暗了',
    hint: ['天色暗下來了，快門不能再慢，{apertureIso}，直到看得清楚。', '光圈、ISO 和快門是同一件事的三個把手。'],
    stuckHint: '{apertureIsoStuck}這顆鏡頭光圈很快就到底，剩下的靠 ISO。',
    unlocked: ['look', 'aperture', 'iso'],
    overlays: ['triangle'],
    setup: (c) => { c.setLighting('dusk', 'overcast'); c.setExposure(11, 1 / 500, 200) },
    done: (c) => Math.abs(c.metrics?.overStops ?? 9) < 0.6,
    holdS: 1,
  },
  {
    id: 'moving', title: '牠在動',
    hint: ['牠開始理毛了。快門太慢頭會糊，把快門調快，再{shoot}拍一張清楚的。', '動的東西要靠快門速度凍結。'],
    stuckHint: '先把快門調到比 1/250 快，再拍。拍完看上面的提示有沒有說「動態模糊」。',
    unlocked: ['look', 'zoom', 'focus', 'aperture', 'shutter', 'iso', 'shoot'],
    overlays: [],
    setup: (c) => { c.setLighting('morning', 'sunny'); c.setExposure(5.6, 1 / 60, 200); c.birdScript('S2') },
    done: (c) => c.photos.some((p) => p.metrics.birdInFrame && p.metrics.motionPx < 3 && p.settings.shutterS <= 1 / 250),
    holdS: 1.2,
  },
  {
    id: 'compose', title: '放對位置',
    hint: ['把鳥眼放到白線交叉點附近，牠面對的那一側多留一點空間，再拍一張。', '視線前方留白，照片才有呼吸的空間。'],
    stuckHint: '牠面向哪邊，就讓牠那一側的空間多一點。眼睛大約在左上或右上的交叉點。',
    unlocked: ['look', 'zoom', 'focus', 'aperture', 'shutter', 'iso', 'shoot'],
    overlays: ['thirds', 'leadArrow'],
    setup: (c) => { c.birdScript('S1'); c.setExposure(5.6, 1 / 500, 200) },
    done: (c) => c.photos.some((p) => p.metrics.birdInFrame && (p.score.detail.thirds ?? 0) > 0.5 && (p.score.detail.lead ?? 0) > 0.5),
    holdS: 1.2,
  },
  {
    id: 'score', title: '看懂分數',
    hint: ['{album}打開相簿，點一張照片，看四項分數與下面那句建議。', '每一句建議都對應一個可以改的設定。'],
    stuckHint: '{albumStuck}',
    unlocked: ['look', 'album'],
    overlays: [],
    done: (c) => c.albumOpened,
    holdS: 0.5,
  },
  {
    id: 'takeoff', title: '牠要飛了',
    hint: ['牠蹲低、張望，就是要飛了。{burst}，抓到起飛的瞬間。', '起飛只有半秒，連拍是你的保險。'],
    stuckHint: '聽到牠叫、看到牠蹲下就{burstStuck}不要放。錯過了牠會再飛回來一次。',
    unlocked: ['look', 'zoom', 'focus', 'aperture', 'shutter', 'iso', 'shoot'],
    overlays: [],
    setup: (c) => { c.setExposure(5.6, 1 / 1000, 400); c.birdScript('S3') },
    tick: (c) => {
      // 每 8 秒一輪：3 秒後起飛，離開後 5 秒再飛回來
      const t = c.elapsed % 9
      if (t > 3 && t < 3.1 && c.birdInScene && c.birdState !== 'S4' && c.birdState !== 'S5') c.birdTakeoff()
      if (t > 7.5 && t < 7.6 && !c.birdInScene) c.birdReenter()
    },
    done: (c) => c.photos.some((p) => p.metrics.birdInFrame && (p.metrics.birdState === 'S4' || p.metrics.birdState === 'S5')),
    holdS: 1.5,
  },
  {
    id: 'done', title: '下課',
    hint: ['第零課結束。你學會了找鳥、變焦、對焦、曝光三角、凍結動作、構圖與連拍。', '送你 30 枚代幣，剛好能{gacha}轉一次扭蛋。接下來自由拍攝：鳥會自己來，拍到的鳥會進{guide}圖鑑。'],
    unlocked: ['look', 'zoom', 'focus', 'aperture', 'shutter', 'iso', 'shoot', 'overview', 'album'],
    overlays: [],
    setup: (c) => { c.giveCoins(30) },
    done: (c) => c.elapsed > 6,
  },
]

/** 依裝置把提示裡的操作說法換掉。 */
export const CONTROL_WORDS: Record<string, [string, string]> = {
  overview: ['按 Tab ', '點左邊的「放下相機」'],
  look: ['', '單指拖動畫面'],
  zoom: ['用滾輪變焦', '雙指捏合變焦'],
  zoomIn: ['滾輪往前是拉近', '雙指張開是拉近'],
  brace: ['按住 Shift 可以穩住', '按住左邊的「穩住」可以穩住'],
  focus: ['按住 W 或 S 轉對焦環（Shift 加滾輪、右鍵拖曳也行）', '左右拖動下方的對焦刻度'],
  focusStuck: ['W 是對遠處，S 是對近處，按住不放會一直轉。', '刻度往右是對遠處，往左是對近處。'],
  shutterCtrl: ['用 A / D ', '用左下角快門旁的 − + '],
  shutterFaster: ['D 是把快門調快', '快門旁的 + 是調快'],
  apertureIso: ['用 Q / E 開大光圈、Z / C 拉高 ISO', '用右上光圈旁的 − 開大光圈、右下 ISO 旁的 + 拉高 ISO'],
  apertureIsoStuck: ['Q 是開大光圈，C 是拉高 ISO。', '光圈數字越小光圈越大。'],
  shoot: ['按左鍵', '按右邊的橘色快門鈕'],
  album: ['按 G ', '點左邊的「相簿」'],
  albumShort: ['按 G ', '點「相簿」'],
  albumStuck: ['按 G。看完按 Esc 回來。', '點左邊的「相簿」。看完點「關閉」回來。'],
  burst: ['按住左鍵連拍', '按住橘色快門鈕連拍'],
  burstStuck: ['按住左鍵', '按住快門鈕'],
  restart: ['按 T 可以重上這一課', '選單（⋯）裡可以重上這一課'],
  gacha: ['按 U ', '在選單（⋯）裡'],
  guide: ['（按 K 看）', '（選單裡看）'],
}

export function wordsFor(text: string, touch: boolean): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => CONTROL_WORDS[k]?.[touch ? 1 : 0] ?? '')
}
