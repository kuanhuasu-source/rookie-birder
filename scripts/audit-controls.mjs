// 控制盤查：PC 與觸控兩種模式，逐一觸發每個操作並確認效果
// 用法：先 npm run dev，再 node scripts/audit-controls.mjs（需要全域安裝 playwright 與 chromium）
import { chromium, devices } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const results = []
const check = (mode, name, ok, detail = '') => { results.push({ mode, name, ok, detail }); }

async function setup(touch) {
  const ctx = touch
    ? await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => check(touch ? 'touch' : 'pc', 'pageerror', false, e.message))
  await page.addInitScript(() => { try { localStorage.setItem('rookie-birder.tutorialDone', '1') } catch {} })
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForFunction(() => !!window.__game, null, { timeout: 20000 })
  await page.waitForTimeout(1200)
  return { ctx, page }
}
const frames = (page, n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }), n)
const g = (page, fn) => page.evaluate(fn)
const vis = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); return !el.classList.contains('hidden') && r.width > 0 && getComputedStyle(el).display !== 'none' }, sel)

// ---------- PC ----------
{
  const mode = 'pc'
  const { ctx, page } = await setup(false)
  const key = async (k) => { await page.keyboard.press(k); await frames(page, 2) }
  // 參數鍵
  let a = await g(page, () => window.__game.cam.settings.fNumber); await key('KeyE'); check(mode, 'E 光圈縮小', (await g(page, () => window.__game.cam.settings.fNumber)) > a)
  a = await g(page, () => window.__game.cam.settings.fNumber); await key('KeyQ'); check(mode, 'Q 光圈開大', (await g(page, () => window.__game.cam.settings.fNumber)) < a)
  a = await g(page, () => window.__game.cam.settings.shutterS); await key('KeyD'); check(mode, 'D 快門變快', (await g(page, () => window.__game.cam.settings.shutterS)) < a)
  a = await g(page, () => window.__game.cam.settings.shutterS); await key('KeyA'); check(mode, 'A 快門變慢', (await g(page, () => window.__game.cam.settings.shutterS)) > a)
  a = await g(page, () => window.__game.cam.settings.iso); await key('KeyC'); check(mode, 'C ISO 升', (await g(page, () => window.__game.cam.settings.iso)) > a)
  a = await g(page, () => window.__game.cam.settings.iso); await key('KeyZ'); check(mode, 'Z ISO 降', (await g(page, () => window.__game.cam.settings.iso)) < a)
  // 對焦鍵（按住）
  a = await g(page, () => window.__game.cam.settings.focusM); await page.keyboard.down('KeyW'); await frames(page, 6); await page.keyboard.up('KeyW'); check(mode, 'W 對焦變遠', (await g(page, () => window.__game.cam.settings.focusM)) > a)
  a = await g(page, () => window.__game.cam.settings.focusM); await page.keyboard.down('KeyS'); await frames(page, 6); await page.keyboard.up('KeyS'); check(mode, 'S 對焦變近', (await g(page, () => window.__game.cam.settings.focusM)) < a)
  // 滾輪變焦與 Shift 滾輪對焦（需在 canvas 上）
  await page.mouse.move(640, 400)
  a = await g(page, () => window.__game.cam.settings.focalMm); await page.mouse.wheel(0, 300); await frames(page, 2); check(mode, '滾輪變焦', (await g(page, () => window.__game.cam.settings.focalMm)) !== a)
  a = await g(page, () => window.__game.cam.settings.focusM); await page.keyboard.down('Shift'); await page.mouse.wheel(0, 200); await page.keyboard.up('Shift'); await frames(page, 2); check(mode, 'Shift+滾輪對焦', (await g(page, () => window.__game.cam.settings.focusM)) !== a)
  // Tab 全景
  await key('Tab'); check(mode, 'Tab 放下相機', Math.abs((await g(page, () => window.__game.camera.fov)) - 60) < 1); await key('Tab')
  // 相簿 / 圖鑑 / 裝備 開關
  await key('KeyG'); check(mode, 'G 相簿開', await vis(page, '.album')); await key('Escape'); check(mode, 'Esc 相簿關', !(await vis(page, '.album')))
  await key('KeyK'); check(mode, 'K 圖鑑開', await vis(page, '.guide')); await key('KeyK'); check(mode, 'K 圖鑑關', !(await vis(page, '.guide')))
  await key('KeyU'); check(mode, 'U 裝備開', await vis(page, '.gearview')); await page.click('.gearview .album-close'); await frames(page, 1); check(mode, '裝備 關閉鈕', !(await vis(page, '.gearview')))
  await key('KeyG'); await page.click('.album .album-close'); await frames(page, 1); check(mode, '相簿 關閉鈕', !(await vis(page, '.album')))
  // V 減晃、H 說明
  a = await g(page, () => localStorage.getItem('rookie-birder.reduceShake')); await key('KeyV'); check(mode, 'V 減晃切換', (await g(page, () => localStorage.getItem('rookie-birder.reduceShake'))) !== a); await key('KeyV')
  a = await vis(page, '.help'); await key('KeyH'); check(mode, 'H 說明切換', (await vis(page, '.help')) !== a)
  // 快門：滑鼠鎖定無法在無頭模式取得，改用遊戲內同路徑
  a = await g(page, async () => (await (await import('/src/photo/album.ts')).listPhotos()).length); await g(page, () => window.__game.shoot()); await page.waitForFunction(() => window.__game.capture.inFlight === 0); check(mode, '快門拍照（內部路徑）', (await g(page, async () => (await (await import('/src/photo/album.ts')).listPhotos()).length)) > a)
  // T 重上教學 → 黑板出現；教學中 G 仍可開相簿；跳過按鈕
  await key('KeyT'); check(mode, 'T 進入教學', await vis(page, '.chalkboard'))
  await key('KeyG'); check(mode, '教學中 G 相簿可開', await vis(page, '.album')); await key('Escape')
  await key('KeyE'); check(mode, '教學中鎖住的鍵有提示', await vis(page, '.toast'))
  await page.click('.chalk-skip'); await frames(page, 2); check(mode, '跳過教學按鈕', !(await g(page, () => window.__game.tutorial.active)))
  await ctx.close()
}

// ---------- 觸控 ----------
{
  const mode = 'touch'
  const { ctx, page } = await setup(true)
  const tap = async (sel) => { await page.tap(sel); await frames(page, 2) }
  check(mode, '觸控模式偵測', await g(page, () => document.body.classList.contains('touch')))
  let a
  a = await g(page, () => window.__game.cam.settings.fNumber); await tap('.trow-aperture button:last-child'); check(mode, '光圈 +', (await g(page, () => window.__game.cam.settings.fNumber)) > a)
  a = await g(page, () => window.__game.cam.settings.fNumber); await tap('.trow-aperture button:first-of-type'); check(mode, '光圈 −', (await g(page, () => window.__game.cam.settings.fNumber)) < a)
  a = await g(page, () => window.__game.cam.settings.shutterS); await tap('.trow-shutter button:last-child'); check(mode, '快門 +', (await g(page, () => window.__game.cam.settings.shutterS)) < a)
  a = await g(page, () => window.__game.cam.settings.shutterS); await tap('.trow-shutter button:first-of-type'); check(mode, '快門 −', (await g(page, () => window.__game.cam.settings.shutterS)) > a)
  a = await g(page, () => window.__game.cam.settings.iso); await tap('.trow-iso button:last-child'); check(mode, 'ISO +', (await g(page, () => window.__game.cam.settings.iso)) > a)
  a = await g(page, () => window.__game.cam.settings.iso); await tap('.trow-iso button:first-of-type'); check(mode, 'ISO −', (await g(page, () => window.__game.cam.settings.iso)) < a)
  a = await g(page, () => window.__game.shooting().cardLeft); await tap('.tshutter'); check(mode, '快門鈕拍照', (await g(page, () => window.__game.shooting().cardLeft)) < a)
  await tap('.tb-overview'); check(mode, '放下相機', Math.abs((await g(page, () => window.__game.camera.fov)) - 60) < 1); await tap('.tb-overview')
  await tap('.tb-album'); check(mode, '相簿鈕開', await vis(page, '.album')); await tap('.album .album-close'); check(mode, '相簿關閉鈕', !(await vis(page, '.album')))
  await tap('.tb-menu'); check(mode, '選單開', await vis(page, '.tmenu'))
  await tap('.tmenu [data-key="KeyK"]'); check(mode, '選單 圖鑑', await vis(page, '.guide')); await tap('.guide .album-close')
  await tap('.tmenu [data-key="KeyU"]'); check(mode, '選單 裝備', await vis(page, '.gearview')); await tap('.gearview .album-close')
  a = await g(page, () => localStorage.getItem('rookie-birder.reduceShake')); await tap('.tmenu [data-key="KeyV"]'); check(mode, '選單 減晃', (await g(page, () => localStorage.getItem('rookie-birder.reduceShake'))) !== a); await tap('.tmenu [data-key="KeyV"]')
  await tap('.tmenu .tmenu-close'); check(mode, '選單關', !(await vis(page, '.tmenu')))
  // 穩住：按住期間 hint 顯示
  const sh = await page.$('.tb-brace'); const bb = await sh.boundingBox()
  await page.touchscreen.tap(bb.x + 5, bb.y + 5) // tap 會立刻放開，改用合成事件
  await g(page, () => { const b = document.querySelector('.tb-brace'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true })) })
  await frames(page, 2); check(mode, '穩住按住有提示', (await g(page, () => document.querySelector('.hint')?.textContent || '')).includes('穩住'))
  await g(page, () => { const b = document.querySelector('.tb-brace'); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', bubbles: true })) })
  // 對焦刻度、單指拖曳、捏合
  a = await g(page, () => window.__game.cam.settings.focusM); const sc = await (await page.$('.focus-scale')).boundingBox(); await page.touchscreen.tap(sc.x + sc.width * 0.15, sc.y + sc.height / 2); await frames(page, 1); check(mode, '對焦刻度點選', (await g(page, () => window.__game.cam.settings.focusM)) !== a)
  const r = await g(page, () => { const c = document.getElementById('view'); const gg = window.__game; const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); const y0 = gg.rig.yaw; ev('pointerdown', 1, 400, 200); ev('pointermove', 1, 460, 200); ev('pointerup', 1, 460, 200); gg.rig.update(1/60); const y1 = gg.rig.yaw; const f0 = gg.cam.settings.focalMm; ev('pointerdown', 1, 300, 200); ev('pointerdown', 2, 540, 200); for (let k = 1; k <= 8; k++) { ev('pointermove', 1, 300 + k * 12, 200); ev('pointermove', 2, 540 - k * 12, 200) } ev('pointerup', 1, 396, 200); ev('pointerup', 2, 444, 200); return { yawMoved: Math.abs(y1 - y0) > 0.005, f0, f1: gg.cam.settings.focalMm } })
  check(mode, '單指拖曳轉雲台', r.yawMoved); check(mode, '雙指捏合變焦', r.f1 !== r.f0, `${r.f0}→${r.f1}`)
  // 教學中：相簿鈕可用、鎖住鈕有提示、跳過鈕
  await tap('.tmenu-close').catch(() => {})
  await g(page, () => window.__game.startTutorial()); await frames(page, 2)
  await tap('.tb-album'); check(mode, '教學中相簿鈕可開', await vis(page, '.album')); await tap('.album .album-close')
  await tap('.trow-aperture button:last-child'); check(mode, '教學中鎖住鈕有提示', await vis(page, '.toast'))
  check(mode, '跳過教學鈕可見', await vis(page, '.chalk-skip'))
  await tap('.chalk-skip'); check(mode, '跳過教學鈕', !(await g(page, () => window.__game.tutorial.active)))
  await ctx.close()
}
await browser.close()
const bad = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'OK ' : 'BAD'} [${r.mode}] ${r.name} ${r.detail}`)
console.log(`\n${results.length - bad.length}/${results.length} passed`)
