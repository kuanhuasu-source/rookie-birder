/**
 * 平衡報告：不是單元測試，是跑一次就把數字寫到 docs/BALANCE.md 的腳本。
 * 執行：npx vitest run scripts/balance.test.ts
 */
import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { LEVELS, CHAPTER_NAME } from '../src/levels/data'
import { SPECIES_BY_ID } from '../src/birds/species'
import { buildScene } from '../src/world/scene'
import { lightingPreset } from '../src/world/lighting'
import { gear, maxApertureAt, type LensDef, type BodyDef, type SupportDef } from '../src/data/gear'
import { scorePhoto, coinsFor, expectedSubjectMean } from '../src/photo/score'
import { cocPx, lensSoftPx, shakeBlurPx, mmToPx, totalBlurPx, motionBlurPx } from '../src/camera/optics'
import { FIDGET_MS } from '../src/birds/types'
import { effectiveSigma } from '../src/camera/shake'
import { overStops, noiseSigma, SHUTTER_STEPS, ISO_STEPS } from '../src/camera/exposure'
import { pull, pool, PULL_COST } from '../src/progress/gacha'
import { defaultSave } from '../src/progress/save'
import { BONUS_NEW_SPECIES, BONUS_NEW_SLOT } from '../src/progress/guide'
import type { PhotoMetrics } from '../src/photo/types'

const PHOTO_W = 1920, PHOTO_H = 1280
const ctx = { imageW: PHOTO_W, imageH: PHOTO_H }

interface Kit { name: string; lens: LensDef; body: BodyDef; support: SupportDef }
const kit = (name: string, l: string, b: string, s: string): Kit => ({ name, lens: gear.lenses.find((x) => x.id === l)!, body: gear.bodies.find((x) => x.id === b)!, support: gear.supports.find((x) => x.id === s)! })
const KITS: Kit[] = [kit('起始 L1 B1 手持', 'L1', 'B1', 'S0'), kit('L2 B2 單腳架', 'L2', 'B2', 'S1'), kit('L3 B3 三腳架', 'L3', 'B3', 'S2'), kit('L5 B4 懸臂', 'L5', 'B4', 'S4')]

function seeded(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

/** 理想技術下（對焦準、構圖好、曝光對、鳥靜止）這套器材在這個距離能拿幾分。 */
function bestShot(k: Kit, distM: number, bodyHeightM: number, albedo: number, evScene: number, state: 'S1' | 'S3' = 'S1') {
  const sensor = gear.sensors[k.body.sensor]
  const focal = k.lens.focalMax
  const fN = maxApertureAt(k.lens, focal)
  const sigma = effectiveSigma(k.support.shakeMul, k.lens.isStops)
  // 快門：挑最慢但手震 ≤ 1.2 px 的；再用 ISO 補曝光，超過機身上限就欠曝
  let best: { stars: number; total: number; shutter: number; iso: number; under: number; frac: number } | null = null
  for (const t of SHUTTER_STEPS) {
    const shake = shakeBlurPx(focal, sigma * 1.5, t, sensor, PHOTO_W)
    if (shake > 1.2) continue
    const needIso = 100 * Math.pow(2, Math.log2((fN * fN) / t) - evScene)
    const iso = ISO_STEPS.filter((i) => i <= k.body.isoMax).reduce((a, b) => (Math.abs(b - needIso) < Math.abs(a - needIso) ? b : a))
    const under = Math.min(0, overStops(evScene, fN, t, iso))
    const soft = lensSoftPx(k.lens.softWideOpenPx, fN, fN)
    const motion = Math.max(state === 'S3' ? 1.5 : 0.2, motionBlurPx(focal, FIDGET_MS[state], distM, t, sensor, PHOTO_W))
    const frac = ((bodyHeightM / distM) * mmToPx(focal, sensor, PHOTO_W)) / PHOTO_H
    const m: PhotoMetrics = {
      birdInFrame: true, distM, cocPx: 0.3, motionPx: motion, shakePx: shake, softPx: soft,
      totalBlurPx: totalBlurPx({ coc: 0.3, motion, shake, soft }),
      overStops: under, noiseSigma: noiseSigma(k.body.kNoise, iso),
      eyeX: 0.66, eyeY: 0.62, birdHeightFrac: frac, birdState: state, viewAngleDeg: 90, albedo, facing: -1, lightAngleDeg: 40, pitchDeg: 2,
      stats: { occlusion: 0, subjectMean: expectedSubjectMean(albedo) * Math.pow(2, under), clippedFrac: 0, crushedFrac: 0, bgVariance: 0.01, bgSep: 1 },
    }
    const s = scorePhoto(m, ctx)
    if (!best || s.total > best.total) best = { stars: s.stars, total: s.total, shutter: t, iso, under, frac }
  }
  return best!
}

const fmtShutter = (t: number) => (t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`)

it('writes docs/BALANCE.md', () => {
  const out: string[] = ['# 平衡報告（自動產生）', '', '由 `npx vitest run scripts/balance.test.ts` 產生。數字是理想技術下的上限，不是玩家的平均。', '']

  // ---- 1. 器材門檻：每關每種鳥，各套器材在「中位距離」能拿到的最高星數
  out.push('## 1. 器材門檻：理想技術下的最高星數', '', '距離取該關所有機位到所有停棲點的中位數。括號是鳥佔畫面高度的比例與要用的 ISO。', '')
  const pacing: string[] = []
  for (const lv of LEVELS) {
    const w = buildScene(lv.sceneId)
    const dists: number[] = []
    for (const h of w.hides) for (const p of w.perches) dists.push(new THREE.Vector3(...h.position).distanceTo(p.position))
    dists.sort((a, b) => a - b)
    const med = dists[Math.floor(dists.length / 2)]
    const ev = lightingPreset(lv.time, lv.weather, { sunAzDeg: lv.sunAzDeg, shadeEv: lv.shadeEv }).evScene
    out.push(`### ${lv.title}（第 ${lv.chapter} 章 ${CHAPTER_NAME[lv.chapter]}）`, '', `場景 EV ${ev}，距離 ${dists[0].toFixed(0)} 到 ${dists[dists.length - 1].toFixed(0)} m，中位 ${med.toFixed(0)} m。`, '')
    out.push('| 鳥 | ' + KITS.map((k) => k.name).join(' | ') + ' |', '|---|' + KITS.map(() => '---').join('|') + '|')
    for (const id of Object.keys(lv.species)) {
      const sp = SPECIES_BY_ID[id]
      const cells = KITS.map((k) => { const b = bestShot(k, med, sp.bodyHeightM, sp.albedo, ev); return `${'★'.repeat(b.stars)}${'☆'.repeat(5 - b.stars)} ${Math.round(b.total)} (${(b.frac * 100).toFixed(0)}%, ISO ${b.iso}${b.under < -0.3 ? `, 欠 ${(-b.under).toFixed(1)} 格` : ''}, ${fmtShutter(b.shutter)})` })
      out.push(`| ${sp.nameZh} | ${cells.join(' | ')} |`)
    }
    out.push('')
    // 出現節奏
    let nBirds = 0, tSum = 0
    const weights = lv.species
    const wsum = Object.values(weights).reduce((a, b) => a + b, 0)
    for (const [id, wgt] of Object.entries(weights)) {
      const sp = SPECIES_BY_ID[id]
      const cycle = ((sp.interval.min + sp.interval.max) / 2) * lv.intervalMul + (sp.dwell.min + sp.dwell.max) / 2 + 6
      tSum += (wgt / wsum) * cycle
    }
    nBirds = lv.durationS / tSum
    const rareId = Object.entries(weights).sort((a, b) => a[1] - b[1])[0]
    const pRare = 1 - Math.pow(1 - rareId[1] / wsum, nBirds)
    pacing.push(`| ${lv.title} | ${lv.durationS / 60} 分 | ${tSum.toFixed(0)} s | ${nBirds.toFixed(1)} 隻 | ${SPECIES_BY_ID[rareId[0]].nameZh} ${(rareId[1] / wsum * 100).toFixed(0)}% → 一關內看到的機率 ${(pRare * 100).toFixed(0)}% |`)
    w.dispose()
  }

  // ---- 2. 出現節奏
  out.push('## 2. 出現節奏', '', '每隻鳥的循環 = 間隔 × 關卡倍率 + 停留 + 飛進來的時間。', '', '| 關卡 | 時長 | 平均循環 | 一關看到幾隻 | 最稀有的鳥 |', '|---|---|---|---|---|', ...pacing, '')

  // ---- 3. 經濟：一次性收入 vs 扭蛋總成本
  const questTotal = LEVELS.reduce((a, l) => a + l.quests.reduce((b, q) => b + q.reward, 0), 0)
  const nSpecies = Object.keys(SPECIES_BY_ID).length
  const guideTotal = nSpecies * (BONUS_NEW_SPECIES + 4 * BONUS_NEW_SLOT)
  const guideRealistic = nSpecies * (BONUS_NEW_SPECIES + 2 * BONUS_NEW_SLOT)   // 停棲與動作好拿，起飛與飛行難
  // 蒙地卡羅：抽到池子裡每一件要幾抽、花多少
  const rng = seeded(2024)
  const items = pool().length
  let pullsSum = 0, costSum = 0, firstEpicSum = 0, firstRareSum = 0
  const N = 2000
  for (let i = 0; i < N; i++) {
    const s = defaultSave(); s.coins = 1e9
    let pulls = 0, firstEpic = 0, firstRare = 0
    while (Object.values(s.owned).reduce((a, b) => a + b.length, 0) - 3 < items) {
      const r = pull(s, rng)!; pulls++
      if (!firstRare && r.item.rarity !== 'common') firstRare = pulls
      if (!firstEpic && (r.item.rarity === 'epic' || r.item.rarity === 'legendary')) firstEpic = pulls
    }
    pullsSum += pulls; costSum += 1e9 - s.coins; firstEpicSum += firstEpic; firstRareSum += firstRare
  }
  // 升級路徑：拿到「任一支 ≥400mm 的鏡頭」要幾抽
  let lensPullSum = 0
  for (let i = 0; i < N; i++) {
    const s = defaultSave(); s.coins = 1e9
    let pulls = 0
    while (!s.owned.lens.some((l) => ['L2', 'L3', 'L4', 'L5'].includes(l))) { pull(s, rng); pulls++ }
    lensPullSum += pulls
  }
  const perLevelPhotos = 12
  const perLevelPhotoCoins = perLevelPhotos * (0.35 * coinsFor(3) + 0.4 * coinsFor(4) + 0.1 * coinsFor(5))
  out.push('## 3. 經濟', '',
    `- 任務一次性獎勵總和：**${questTotal}** 代幣（${LEVELS.length} 關）。`,
    `- 圖鑑獎勵：${nSpecies} 種鳥 × （新鳥 ${BONUS_NEW_SPECIES} + 四格各 ${BONUS_NEW_SLOT}）= 全收 **${guideTotal}**；只收停棲與動作兩格約 **${guideRealistic}**。`,
    `- 照片本身：三星 ${coinsFor(3)}、四星 ${coinsFor(4)}、五星 ${coinsFor(5)}；一關拍 ${perLevelPhotos} 張、三四五星各 35/40/10% 時約 **${perLevelPhotoCoins.toFixed(0)}** 代幣／關，可重複。`,
    `- 扭蛋：每抽 ${PULL_COST}，池子 ${items} 件。蒙地卡羅 ${N} 次：全收平均 **${(pullsSum / N).toFixed(1)} 抽、${(costSum / N).toFixed(0)} 代幣**（含重複退幣）；` +
    `第一件稀有以上平均第 ${(firstRareSum / N).toFixed(1)} 抽，第一件史詩以上第 ${(firstEpicSum / N).toFixed(1)} 抽；拿到任一支 400mm 以上的鏡頭平均 **${(lensPullSum / N).toFixed(1)} 抽（${(lensPullSum / N * PULL_COST).toFixed(0)} 代幣）**。`,
    `- 對照：一次性收入約 ${questTotal + guideRealistic}，加上每關 ${perLevelPhotoCoins.toFixed(0)} 的照片收入，全收扭蛋需要重玩約 **${Math.max(0, (costSum / N - questTotal - guideRealistic) / perLevelPhotoCoins).toFixed(0)}** 關。`, '')

  // ---- 4. 任務對器材的硬性要求
  out.push('## 4. 任務裡的硬性數值', '')
  out.push('| 關卡 | 任務 | 條件摘要 | 獎勵 |', '|---|---|---|---|')
  for (const lv of LEVELS) for (const q of lv.quests) out.push(`| ${lv.title} | ${q.title} | ${q.hint} | ${q.reward} |`)
  out.push('')
  // 光圈門檻：各鏡頭在最長焦距的最大光圈
  out.push('各鏡頭在最長焦的最大光圈：' + gear.lenses.map((l) => `${l.id} f/${maxApertureAt(l, l.focalMax).toFixed(1)}`).join('、') + '。', '')

  writeFileSync('docs/BALANCE.md', out.join('\n'), 'utf-8')
  console.log(out.join('\n'))
})
