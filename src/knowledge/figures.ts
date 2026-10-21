/** 攝影知識用的手繪風 SVG 圖。顏色用 currentColor（鉛筆灰）、橘（強調）、藍（光線）。 */
const P = '#4a4a4a'
const O = '#f26a1b'
const B = '#1d6fb8'
const C = '#fffdf7'

const wrap = (w: number, h: number, inner: string, caption: string) =>
  `<figure class="fig"><svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" font-size="13">${inner}</svg><figcaption>${caption}</figcaption></figure>`

/** 無反相機剖面：鏡頭群、光圈、快門簾、感光元件、電子觀景窗。 */
export const FIG_CAMERA_SECTION = wrap(640, 296, `
  <!-- 機身 -->
  <path d="M300 70 h300 q14 0 14 14 v150 q0 14 -14 14 h-300 z" fill="${C}" stroke="${P}" stroke-width="2.5"/>
  <path d="M430 70 v-18 h60 v18" fill="none" stroke="${P}" stroke-width="2.5"/>
  <!-- 鏡筒 -->
  <path d="M60 100 h240 v100 h-240 z" fill="${C}" stroke="${P}" stroke-width="2.5"/>
  <path d="M60 100 v100 M100 96 v108 M140 100 v100 M200 100 v100 M250 100 v100" stroke="${P}" stroke-width="1.2" stroke-dasharray="3 3"/>
  <!-- 鏡片群 -->
  <ellipse cx="80" cy="150" rx="8" ry="46" fill="${B}22" stroke="${B}" stroke-width="2"/>
  <ellipse cx="120" cy="150" rx="6" ry="36" fill="${B}22" stroke="${B}" stroke-width="2"/>
  <ellipse cx="170" cy="150" rx="7" ry="32" fill="${B}22" stroke="${B}" stroke-width="2"/>
  <ellipse cx="228" cy="150" rx="6" ry="34" fill="${B}22" stroke="${B}" stroke-width="2"/>
  <ellipse cx="270" cy="150" rx="7" ry="40" fill="${B}22" stroke="${B}" stroke-width="2"/>
  <!-- 光圈葉片 -->
  <path d="M195 108 v24 M195 192 v-24" stroke="${O}" stroke-width="5"/>
  <text x="178" y="98" fill="${O}" font-size="12">光圈</text>
  <!-- 快門簾與感光元件 -->
  <rect x="330" y="110" width="8" height="80" fill="${P}"/>
  <rect x="330" y="110" width="8" height="30" fill="${O}"/>
  <text x="318" y="208" font-size="12" fill="${P}">快門簾</text>
  <rect x="356" y="104" width="12" height="92" fill="${B}" stroke="${P}" stroke-width="2"/>
  <text x="350" y="222" font-size="12" fill="${P}">感光元件</text>
  <!-- 處理器與螢幕 -->
  <rect x="400" y="120" width="40" height="40" fill="none" stroke="${P}" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="404" y="145" font-size="11" fill="${P}">處理</text>
  <rect x="470" y="100" width="110" height="100" fill="${C}" stroke="${P}" stroke-width="2"/>
  <text x="484" y="155" font-size="12" fill="${P}">背面螢幕</text>
  <rect x="440" y="52" width="40" height="18" fill="${C}" stroke="${P}" stroke-width="2"/>
  <text x="428" y="44" font-size="11" fill="${P}">電子觀景窗</text>
  <!-- 光線 -->
  <path d="M20 120 L80 150 L356 150" fill="none" stroke="${O}" stroke-width="2"/>
  <path d="M20 180 L80 150" fill="none" stroke="${O}" stroke-width="2"/>
  <path d="M20 120 L120 118 L170 128 L228 134 L270 140 L356 150" fill="none" stroke="${O}" stroke-width="1.5" stroke-dasharray="5 4"/>
  <path d="M20 180 L120 182 L170 172 L228 166 L270 160 L356 150" fill="none" stroke="${O}" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="18" y="108" font-size="12" fill="${O}">來自鳥的光</text>
  <text x="40" y="282" font-size="12" fill="${P}">鏡頭：多片鏡片把光線收攏，光圈決定能通過多少　｜　機身：快門決定多久，感光元件把光變成數字</text>
`, '圖 1　無反相機的剖面（示意）：光線經過鏡片群與光圈，由快門控制時間，落在感光元件上。沒有反光鏡，觀景窗看的是感光元件的即時影像，所以曝光模擬是「所見即所得」。')

/** 光圈葉片與 f 值。 */
export const FIG_APERTURE = wrap(640, 220, `
  ${[['f/2.8', 70, 46], ['f/5.6', 220, 30], ['f/11', 370, 17], ['f/22', 520, 9]].map(([label, cx, r]) => `
    <circle cx="${cx}" cy="100" r="60" fill="${C}" stroke="${P}" stroke-width="2.5"/>
    ${Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2; const a2 = a + 0.9; const x1 = +cx + Math.cos(a) * 60, y1 = 100 + Math.sin(a) * 60, x2 = +cx + Math.cos(a2) * +r, y2 = 100 + Math.sin(a2) * +r; return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${P}" stroke-width="2"/>` }).join('')}
    <circle cx="${cx}" cy="100" r="${r}" fill="${O}" stroke="${P}" stroke-width="2"/>
    <text x="${+cx - 20}" y="190" font-size="16" fill="${P}">${label}</text>`).join('')}
  <text x="40" y="22" font-size="13" fill="${P}">光圈值 N = 焦距 ÷ 光圈直徑。數字越小，開口越大，進光越多，景深越薄。每一格（×1.4）進光量差兩倍。</text>
`, '圖 2　光圈葉片。f/2.8 到 f/5.6 差兩格，進光量差四倍；500mm f/4 的開口直徑是 125mm，這就是大砲鏡頭又粗又重的原因。')

/** 景深：焦平面前後、模糊圈。 */
export const FIG_DOF = wrap(640, 240, `
  <path d="M30 200 h580" stroke="${P}" stroke-width="2"/>
  <rect x="40" y="150" width="30" height="50" fill="${C}" stroke="${P}" stroke-width="2"/>
  <text x="34" y="222" font-size="12" fill="${P}">相機</text>
  <!-- 鳥在焦平面 -->
  <line x1="330" y1="60" x2="330" y2="200" stroke="${O}" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="300" y="52" font-size="12" fill="${O}">對焦平面</text>
  <ellipse cx="330" cy="140" rx="22" ry="14" fill="${C}" stroke="${P}" stroke-width="2"/>
  <circle cx="346" cy="132" r="3" fill="${P}"/>
  <!-- 景深範圍 -->
  <rect x="312" y="90" width="42" height="110" fill="${B}22" stroke="none"/>
  <text x="296" y="84" font-size="11" fill="${B}">清楚的範圍（景深）</text>
  <!-- 前後的樹枝模糊 -->
  <circle cx="180" cy="130" r="18" fill="${B}22" stroke="${B}" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="150" y="110" font-size="11" fill="${B}">前景：模糊圈</text>
  <circle cx="520" cy="120" r="30" fill="${B}22" stroke="${B}" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="488" y="84" font-size="11" fill="${B}">背景：更大的模糊圈</text>
  <!-- 光線錐 -->
  <path d="M70 150 L330 140 L520 120" fill="none" stroke="${O}" stroke-width="1.2"/>
  <path d="M70 175 L330 140 L520 110" fill="none" stroke="${O}" stroke-width="1.2"/>
  <text x="40" y="236" font-size="12" fill="${P}">景深 ≈ 2 × N × c × 距離² ÷ 焦距²　（c 為可接受的模糊圈，全幅約 0.03mm）。500mm f/7.1 在 10 公尺只有約 17 公分。</text>
`, '圖 3　只有對焦平面附近是清楚的。離焦平面越遠，光線在感光元件上散成的「模糊圈」越大。長焦距與大光圈都讓景深變薄。')

/** 快門簾與時間。 */
export const FIG_SHUTTER = wrap(640, 200, `
  ${[['1/60', 60, 0.95], ['1/250', 210, 0.6], ['1/1000', 360, 0.3], ['1/4000', 510, 0.12]].map(([label, x, open]) => `
    <rect x="${x}" y="30" width="90" height="120" fill="${C}" stroke="${P}" stroke-width="2.5"/>
    <rect x="${x}" y="30" width="90" height="${120 * (1 - +open)}" fill="${P}"/>
    <rect x="${x}" y="${30 + 120 * (1 - +open)}" width="90" height="${120 * +open}" fill="${O}66"/>
    <text x="${+x + 20}" y="178" font-size="15" fill="${P}">${label}</text>`).join('')}
  <text x="30" y="18" font-size="13" fill="${P}">快門速度決定感光元件「看」多久。每慢一格，進光量兩倍，但移動中的東西在畫面上拖得更長。</text>
`, '圖 4　快門時間與動態模糊。鳥的移動在畫面上拖出的長度 = 焦距 × 角速度 × 快門時間。翠鳥入水 5 公尺/秒、10 公尺外、500mm：1/500 拖 83 像素，1/4000 只剩 10 像素。')

/** 感光元件尺寸與視角。 */
export const FIG_SENSOR = wrap(640, 220, `
  <rect x="60" y="40" width="180" height="120" fill="${C}" stroke="${P}" stroke-width="2.5"/>
  <text x="66" y="178" font-size="13" fill="${P}">全幅 36 × 24 mm</text>
  <rect x="98" y="66" width="112" height="75" fill="${O}22" stroke="${O}" stroke-width="2.5"/>
  <text x="102" y="60" font-size="12" fill="${O}">APS-C 22.3 × 14.9 mm</text>
  <!-- 視角 -->
  <path d="M330 100 L600 40 M330 100 L600 160" fill="none" stroke="${P}" stroke-width="2"/>
  <path d="M330 100 L600 70 M330 100 L600 130" fill="none" stroke="${O}" stroke-width="2"/>
  <circle cx="330" cy="100" r="5" fill="${P}"/>
  <text x="440" y="30" font-size="12" fill="${P}">全幅 + 400mm：視角 3.4°</text>
  <text x="440" y="190" font-size="12" fill="${O}">APS-C + 250mm：視角 3.4°（等效 400mm）</text>
  <text x="330" y="212" font-size="12" fill="${P}">視角 = 2 × atan(感光元件高 ÷ 2 焦距)</text>
`, '圖 5　感光元件越小，同一顆鏡頭的視角越窄，等效焦距越長。APS-C 的 1.6 倍裁切是入門拍鳥的優勢，代價是高 ISO 的噪點較多。')

/** 太陽方位與順逆光。 */
export const FIG_LIGHT = wrap(640, 270, `
  <circle cx="320" cy="150" r="90" fill="none" stroke="${P}" stroke-width="1.5" stroke-dasharray="4 4"/>
  <ellipse cx="320" cy="150" rx="16" ry="11" fill="${C}" stroke="${P}" stroke-width="2"/>
  <circle cx="332" cy="146" r="2.5" fill="${P}"/>
  <text x="304" y="178" font-size="12" fill="${P}">鳥</text>
  <rect x="306" y="40" width="28" height="18" fill="${C}" stroke="${P}" stroke-width="2"/>
  <text x="298" y="32" font-size="12" fill="${P}">相機</text>
  <!-- 太陽位置 -->
  <circle cx="320" cy="20" r="0" />
  <g font-size="12">
    <circle cx="150" cy="60" r="12" fill="${O}"/><text x="90" y="40" fill="${P}">順光：眼神光、羽色飽和</text>
    <circle cx="500" cy="150" r="12" fill="${O}"/><text x="470" y="184" fill="${P}">側光：立體、羽毛紋理</text>
    <circle cx="240" cy="246" r="12" fill="${O}" opacity="0.6"/><text x="40" y="266" fill="${P}">逆光：剪影、邊光，眼睛沒有亮點</text>
  </g>
  <path d="M150 60 L320 150" stroke="${O}" stroke-width="1.5"/>
  <path d="M500 150 L320 150" stroke="${O}" stroke-width="1.5"/>
  <path d="M240 246 L320 150" stroke="${O}" stroke-width="1.5" stroke-dasharray="4 3"/>
`, '圖 6　太陽、鳥、相機的相對位置決定光質。太陽在相機背後約 70 度以內，鳥的眼睛才會出現眼神光。清晨與黃昏的低角度側光最立體。')

/** 懸臂雲台原理。 */
export const FIG_GIMBAL = wrap(640, 230, `
  <g transform="translate(150 0)">
    <path d="M120 200 h360" stroke="${P}" stroke-width="2"/>
    <rect x="300" y="170" width="40" height="30" fill="${C}" stroke="${P}" stroke-width="2"/>
    <path d="M320 170 v-110 h90 v70" fill="none" stroke="${P}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="340" y="118" width="150" height="26" rx="6" fill="${C}" stroke="${P}" stroke-width="2.5"/>
    <rect x="330" y="112" width="24" height="38" fill="${C}" stroke="${P}" stroke-width="2.5"/>
    <circle cx="320" cy="170" r="8" fill="${O}"/>
    <circle cx="410" cy="130" r="8" fill="${O}"/>
    <path d="M410 130 m0 -22 a 22 22 0 0 1 22 22" fill="none" stroke="${O}" stroke-width="2"/>
    <path d="M320 170 m-22 0 a 22 22 0 0 1 22 -22" fill="none" stroke="${O}" stroke-width="2"/>
    <text x="398" y="92" font-size="11" fill="${O}">俯仰軸</text>
    <text x="252" y="190" font-size="11" fill="${O}">水平軸</text>
    <text x="430" y="166" font-size="12" fill="${P}">鏡頭腳架環</text>
  </g>
  <g font-size="13" fill="${P}">
    <text x="20" y="50">懸臂雲台把鏡頭的重心</text>
    <text x="20" y="72">放在兩個轉軸的交點上，</text>
    <text x="20" y="94">幾公斤的大砲用一根手指</text>
    <text x="20" y="116">就能跟著飛鳥轉，放手也不倒。</text>
    <text x="20" y="150">球型雲台鎖死才穩，追焦會卡；</text>
    <text x="20" y="172">油壓雲台平順但有阻尼，</text>
    <text x="20" y="194">追快速飛行跟不上。</text>
  </g>
`, '圖 7　懸臂雲台：重心落在轉軸上，大砲鏡頭變成「無重量」，這是打鳥的終極支撐。')

/** 曝光三角。 */
export const FIG_TRIANGLE = wrap(640, 240, `
  <polygon points="320,30 560,210 80,210" fill="${C}" stroke="${P}" stroke-width="2.5"/>
  <text x="290" y="22" font-size="15" fill="${O}">光圈</text>
  <text x="40" y="232" font-size="15" fill="${O}">快門</text>
  <text x="560" y="232" font-size="15" fill="${O}">ISO</text>
  <text x="196" y="110" font-size="12" fill="${B}" transform="rotate(-37 196 110)">副作用：景深變薄</text>
  <text x="330" y="196" font-size="12" fill="${B}">副作用：動態模糊 ↔ 噪點</text>
  <text x="430" y="110" font-size="12" fill="${B}" transform="rotate(37 430 110)">副作用：噪點增加</text>
  <text x="250" y="130" font-size="14" fill="${P}">同樣的亮度</text>
  <text x="236" y="150" font-size="12" fill="${P}">三個把手互相交換</text>
`, '圖 8　曝光三角。任何一個把手開一格，另一個就要收一格，亮度不變，但副作用不同。打鳥的順序通常是：先定快門（凍結動作），再開光圈（通常全開），最後用 ISO 補亮度。')
