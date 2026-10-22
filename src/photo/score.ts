import type { PhotoMetrics, PhotoScore } from './types'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** 與 ExposurePass 相同的 ACES 近似，用來把反照率換成照片上的目標亮度。 */
export function acesCurve(x: number): number {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
  return clamp01((x * (a * x + b)) / (x * (c * x + d) + e))
}

/** ACES 近似的反函數：由色調曲線後的值回推線性值。 */
export function acesInverse(y: number): number {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
  y = Math.min(0.985, Math.max(0.0005, y))
  const A = y * c - a, B = y * d - b, C = y * e
  const disc = Math.max(0, B * B - 4 * A * C)
  return (-B - Math.sqrt(disc)) / (2 * A)
}

/**
 * 紙片在照片上的實測增益：描邊、紙張顆粒與斜線會讓主體平均亮度比貼圖反照率低。
 * 以正確曝光的斑鳩實拍反推約 0.72（2026-10-21）。
 */
export const RENDER_GAIN = 0.72

/** 曝光正確時主體在照片上應有的平均亮度（色調曲線後）。 */
export function expectedSubjectMean(albedo: number): number {
  return acesCurve(0.8 * RENDER_GAIN * albedo)
}

const STATE_SCORE: Record<string, number> = { S1: 0.4, S2: 0.55, S3: 0.7, S4: 0.9, S5: 1.0 }

export interface ScoreContext { imageW: number; imageH: number }

/** 三角形函數：lo0 以下 0，lo1 到 hi1 滿分，hi0 以上 0。 */
function plateau(x: number, lo0: number, lo1: number, hi1: number, hi0: number): number {
  if (x <= lo0 || x >= hi0) return 0
  if (x < lo1) return (x - lo0) / (lo1 - lo0)
  if (x > hi1) return (hi0 - x) / (hi0 - hi1)
  return 1
}

export function scorePhoto(m: PhotoMetrics, ctx: ScoreContext): PhotoScore {
  const detail: Record<string, number> = {}
  const caps: string[] = []
  const losses: { key: string; loss: number; advice: string }[] = []

  if (!m.birdInFrame) {
    return { focus: 0, exposure: 0, composition: 0, moment: 0, total: 0, stars: 0, advice: '畫面裡沒有鳥', caps: ['沒有鳥'], detail }
  }

  // ---- 對焦與銳利度（30）
  const blur = m.totalBlurPx
  const sharp = clamp01(1 - (blur - 1.5) / 10.5)
  const birdHeightPx = m.birdHeightFrac * ctx.imageH
  // 鳥在畫面上越小，可解析的細節越少：320 px 高以上才算滿分，8% 高只剩六成
  const detailF = clamp01(birdHeightPx / 320)
  const focus = 30 * sharp * (0.4 + 0.6 * detailF)
  detail.sharp = sharp; detail.detail = detailF
  if (m.cocPx > 12) caps.push('鳥眼完全脫焦')
  if (m.cocPx > 3) losses.push({ key: 'coc', loss: 30 * (1 - sharp) * (m.cocPx / Math.max(blur, 0.01)), advice: `焦點沒落在鳥眼上，模糊圈 ${m.cocPx.toFixed(0)}px，對焦環再轉一點` })
  if (m.motionPx > 3) losses.push({ key: 'motion', loss: 30 * (1 - sharp) * (m.motionPx / Math.max(blur, 0.01)), advice: `快門太慢，主體動態模糊 ${m.motionPx.toFixed(0)}px，試試更快的快門` })
  if (m.shakePx > 3) losses.push({ key: 'shake', loss: 30 * (1 - sharp) * (m.shakePx / Math.max(blur, 0.01)), advice: `手震 ${m.shakePx.toFixed(0)}px，快門至少 1/等效焦距，或換腳架` })
  if (m.softPx > 1 && blur < 4) losses.push({ key: 'soft', loss: 30 * (1 - sharp), advice: '鏡頭全開有點鬆，縮一到兩格光圈會更銳利' })
  if (detailF < 0.6) losses.push({ key: 'detail', loss: 30 * sharp * 0.6 * (1 - detailF), advice: '鳥在畫面裡太小，拉長焦距或等牠靠近' })

  // ---- 曝光（25）
  const albedo = m.albedo ?? 0.42
  const targetLin = 0.8 * RENDER_GAIN * albedo
  let signedDev: number
  if (m.stats && m.stats.subjectMean > 0) signedDev = Math.log2(acesInverse(m.stats.subjectMean) / targetLin)
  else signedDev = m.overStops
  const dev = Math.abs(signedDev)
  // 四分之一格以內不扣，兩格以外歸零
  const expo = 1 - clamp01((dev - 0.25) / 1.75)
  const clipped = m.stats?.clippedFrac ?? 0
  const crushed = m.stats?.crushedFrac ?? 0
  const clipPenalty = clipped * 2
  const crushPenalty = crushed * 1.5
  const noisePenalty = clamp01((m.noiseSigma - 0.015) / 0.04) * 0.4
  const exposure = 25 * clamp01(expo - clipPenalty - crushPenalty - noisePenalty)
  detail.expoDev = dev; detail.clipped = clipped; detail.crushed = crushed; detail.noise = noisePenalty
  if (dev > 0.5) {
    const over = signedDev > 0
    losses.push({ key: 'expo', loss: 25 * (1 - expo), advice: over ? `過曝約 ${dev.toFixed(1)} 格，快門快一點或 ISO 降低` : `欠曝約 ${dev.toFixed(1)} 格，快門慢一點、光圈開大或 ISO 拉高` })
  }
  if (clipped > 0.08) losses.push({ key: 'clip', loss: 25 * clipPenalty, advice: '亮部爆掉了，羽毛細節沒了，減一格曝光' })
  if (noisePenalty > 0.15) losses.push({ key: 'noise', loss: 25 * noisePenalty, advice: 'ISO 太高，噪點把細節吃掉了' })

  // ---- 構圖與背景（25）
  const size = plateau(m.birdHeightFrac, 0.08, 0.25, 0.6, 0.95)
  const aspect = ctx.imageH / ctx.imageW
  let thirdsD = Infinity
  for (const px of [1 / 3, 2 / 3]) for (const py of [1 / 3, 2 / 3]) {
    thirdsD = Math.min(thirdsD, Math.hypot(m.eyeX - px, (m.eyeY - py) * aspect))
  }
  const thirds = 1 - clamp01(thirdsD / 0.25)
  const facing = m.facing ?? 1
  const front = facing === 1 ? 1 - m.eyeX : m.eyeX
  const lead = plateau(front, 0.3, 0.55, 0.75, 0.95)
  const bgSep = m.stats?.bgSep ?? 0.5
  const bgClean = 1 - clamp01((m.stats?.bgVariance ?? 0.02) / 0.08)
  const eyeLevel = 1 - clamp01(Math.abs(m.pitchDeg ?? 0) / 20)
  const occlusion = m.stats?.occlusion ?? 0
  const compRaw = 0.25 * size + 0.15 * thirds + 0.15 * lead + 0.2 * bgSep + 0.15 * bgClean + 0.1 * eyeLevel
  const composition = 25 * compRaw * (1 - occlusion)
  Object.assign(detail, { size, thirds, lead, bgSep, bgClean, eyeLevel, occlusion })
  if (occlusion > 0.5) caps.push('鳥被遮住超過一半')
  const rawOcc = m.stats?.rawOcclusion ?? occlusion
  if (occlusion > 0.2) losses.push({ key: 'occ', loss: 25 * compRaw * occlusion, advice: rawOcc > occlusion + 0.1 ? '前景還不夠糊，擋到鳥了；光圈再開大、或離前景更近讓它化開' : '前景擋到鳥了，換個角度或等牠跳出來' })
  if (size < 0.6) losses.push({ key: 'size', loss: 25 * 0.25 * (1 - size), advice: m.birdHeightFrac < 0.25 ? '鳥佔畫面太小，拉近一點' : '太滿了，退一點焦距給牠留空間' })
  if (thirds < 0.5) losses.push({ key: 'thirds', loss: 25 * 0.15 * (1 - thirds), advice: '把鳥眼放到三分線的交點附近' })
  if (lead < 0.5) losses.push({ key: 'lead', loss: 25 * 0.15 * (1 - lead), advice: '視線前方留點空間，別讓牠看著畫框' })
  if (bgSep < 0.3) losses.push({ key: 'bgsep', loss: 25 * 0.2 * (1 - bgSep), advice: '背景離鳥太近，化不開；開大光圈或換機位' })
  if (bgClean < 0.5) losses.push({ key: 'bgclean', loss: 25 * 0.15 * (1 - bgClean), advice: '背景太雜，找個乾淨一點的背景' })
  if (eyeLevel < 0.5) losses.push({ key: 'eyelevel', loss: 25 * 0.1 * (1 - eyeLevel), advice: '試著跟鳥平視，仰角太大' })

  // ---- 姿態與時機（20）
  const state = STATE_SCORE[m.birdState ?? 'S1'] ?? 0.4
  const va = m.viewAngleDeg ?? 90
  const facingScore = va < 30 ? 0.8 : va > 150 ? 0.2 : 1
  const la = m.lightAngleDeg ?? 0
  const catchlight = la < 70 ? 1 : 0.6
  const moment = 20 * state * facingScore * (0.7 + 0.3 * catchlight)
  Object.assign(detail, { state, facingScore, catchlight })
  if (state < 0.6) losses.push({ key: 'state', loss: 20 * (1 - state), advice: '牠還很靜，等牠理毛、跳枝或起飛的瞬間分數更高' })
  if (catchlight < 1) losses.push({ key: 'light', loss: 20 * state * 0.3 * 0.4, advice: '逆光，眼睛沒有眼神光；清晨或黃昏換個順光的機位' })

  let total = focus + exposure + composition + moment
  let stars = total >= 85 ? 5 : total >= 70 ? 4 : total >= 55 ? 3 : total >= 40 ? 2 : 1
  if (caps.includes('鳥眼完全脫焦')) stars = Math.min(stars, 2)
  if (caps.includes('鳥被遮住超過一半')) stars = Math.min(stars, 1)
  total = Math.round(total * 10) / 10

  losses.sort((a, b) => b.loss - a.loss)
  // 五星也可以帶一句提示，只要有明顯的失分項
  const top = losses[0]
  const advice = top && top.loss >= 4 ? top.advice : stars >= 5 ? '漂亮，這張可以進圖鑑' : '不錯，再找更好的瞬間'
  return { focus: round1(focus), exposure: round1(exposure), composition: round1(composition), moment: round1(moment), total, stars, advice, caps, detail }
}

function round1(x: number): number { return Math.round(x * 10) / 10 }

export const COINS_PER_STAR = [0, 0, 2, 5, 10, 20]
export function coinsFor(stars: number): number { return COINS_PER_STAR[Math.max(0, Math.min(5, stars))] }
export function starString(stars: number): string { return '★'.repeat(stars) + '☆'.repeat(5 - stars) }
