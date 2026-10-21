# 打鳥（暫名）原型技術規劃 v0.2

對應 GDD v0.2。目標是在每週兩天的投入下，約 6 週做出「教學加相機手感」的原型。

---

## 1. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 語言 | TypeScript | 型別對相機數學與資料結構很有幫助 |
| 建置 | Vite | 零設定、熱更新、靜態輸出可直接丟 GitHub Pages |
| 3D | three.js（r16x 以上） | 自訂後處理 pass 最自由，照片成像管線需要這個自由度 |
| 後處理 | three/addons EffectComposer + 自寫 ShaderPass | 內建 BokehPass 不是物理模型，自己寫 |
| UI | 原生 HTML/CSS 疊在 canvas 上 | 貼紙、和紙膠帶、手寫字型用 CSS 做最快；不引入 React |
| 儲存 | IndexedDB（idb-keyval） | localStorage 5MB 不夠放照片 |
| 模型 | Blender 匯出 glTF | 低多邊形場景與紙片鳥骨架 |
| 測試 | Vitest | 只測相機數學與評分公式，渲染不寫測試 |

不使用物理引擎。鳥的移動是腳本化路徑，場景碰撞只用 three.js Raycaster 做遮擋判斷。

---

## 2. 專案結構

```
bird-photo-game/
  docs/                  設計與技術文件
  public/
    models/              glTF
    textures/            紙張、色鉛筆、蠟筆紋理
    audio/               鳥鳴
  src/
    main.ts              進入點、遊戲狀態機（選單 / 拍攝 / 結算）
    core/
      loop.ts            固定時步更新 + 渲染
      input.ts           滑鼠、鍵盤、滾輪 → 動作
      time.ts
    camera/
      exposure.ts        EV、曝光倍率
      optics.ts          FOV、CoC、景深、安全快門
      shake.ts           手震模型（支撐 × 防手震）
      rig.ts             雲台：滑鼠 → 俯仰與水平角，含雲台阻尼
      body.ts            連拍、緩衝區、記憶卡、觀景窗延遲
      state.ts           目前參數（焦距、光圈、快門、ISO、對焦距離）
    render/
      composer.ts        組裝 live 與 photo 兩條管線
      passes/
        ToonOutlinePass  描邊 + 抖線
        PaperPass        紙張紋理、色鉛筆填色
        CocDofPass       物理景深
        MotionBlurPass   主體動態模糊 + 手震模糊
        ExposurePass     曝光倍率、色調曲線、ISO 噪點
      materials/         toon 材質、紙片鳥材質
    world/
      scene.ts           載入場景、機位、光線預設
      lighting.ts        時段 × 天氣 → 太陽方向、強度、色溫、霧
      hide.ts            機位定義
    birds/
      Bird.ts            五段狀態機、動畫驅動
      spawner.ts         出現機制
      species/           每種鳥的參數（JSON）
    photo/
      capture.ts         按快門 → 高解析渲染 → 讀回 → WebP
      score.ts           評分
      album.ts           IndexedDB 存取
    data/
      gear.json          鏡頭、機身、支撐、配件
      levels.json
      strings.zh-TW.json
    tutorial/
      steps.ts           第零課的步驟定義（提示、過關條件、開放的把手、輔助線）
      runner.ts          依序執行步驟、計時補提示、腳本化斑鳩
    ui/
      chalkboard.ts      黑板提示與輔助線
      viewfinder.ts      觀景窗 HUD
      result.ts          結算
      menu.ts
  tests/
    optics.test.ts
    exposure.test.ts
    score.test.ts
```

---

## 3. 相機數學模型

所有長度用 mm，角度用弧度。感光元件：全幅 36 × 24，APS-C 22.3 × 14.9（裁切 1.6）。

### 3.1 視角

```
vFov = 2 · atan( sensorH / (2 · f) )
```

直接給 three.js PerspectiveCamera.fov（度）。APS-C 的「等效焦距」不用另外算，
用較小的感光元件自然得到較窄的視角。

### 3.2 曝光

場景亮度用 EV100 表示，由時段與天氣查表：

| 情境 | EV100 |
|---|---|
| 晴天正午 | 15 |
| 晴天上午 / 黃昏前 | 13 |
| 晴天清晨 / 黃昏 | 11 |
| 陰天 | 12 |
| 林地陰影（晴） | 10 |
| 林地陰影（陰） | 8 |

相機設定的 EV（折算到 ISO 100）：

```
evCam = log2( N² / t ) − log2( ISO / 100 )
overStops = evScene − evCam          // 正值過曝，負值欠曝
exposureMul = 2 ^ overStops
```

場景以「曝光正確時中灰為 0.18」的線性值渲染，乘上 exposureMul，再過色調曲線並夾到 0 到 1。
觀景窗即時套用同一條公式，這就是「曝光模擬」。

色調曲線用簡單的 filmic（例如 ACES 近似），高光會柔和地壓縮但超過約 1.5 就死白，
符合白鷺羽毛過曝的手感。

### 3.3 景深與模糊圈

對焦距離 s、物距 d、焦距 f、光圈值 N，模糊圈直徑：

```
coc = ( f / N ) · ( f / ( s − f ) ) · | d − s | / d        // mm
cocPx = coc / sensorW · imageW
```

檢查：500mm f/7.1 對焦在 10m，物體在 10.3m，全幅 6000px 寬，cocPx ≈ 18px。
打鳥的景深就是這麼薄，這個公式不用調。

超焦距與景深範圍只用於顯示對焦刻度，評分直接用鳥眼的 cocPx。

### 3.4 主體動態模糊

鳥相對相機的切向速度 v（m/s）、距離 d（m）、快門 t（s）：

```
blurMm = f · ( v / d ) · t
blurPx = blurMm / sensorW · imageW
```

檢查：翠鳥入水 5 m/s，10m，500mm，1/500 → 全幅 6000px 約 83px；1/4000 約 10px。

實作上不用解析速度，而是記錄鳥眼前一幀與這一幀的螢幕座標，除以幀時間得到像素速度，
再乘以快門時間。這樣轉頭、擺尾等局部動作也會自然算進去。

### 3.5 手震

手持的角速度用雜訊模型：

```
omega(t) = sigma · noise(t)          // rad/s，noise 為 1D Perlin，頻率約 2 到 6 Hz
shakeBlurPx = f · omega · t / sensorW · imageW
```

sigma 的來源是「安全快門 1/f」：令 t = 1/f 時模糊剛好等於 0.03mm，得 sigma ≈ 0.03 rad/s。

| 支撐 | sigma 倍率 |
|---|---|
| 手持 | 1.0 |
| 單腳架 | 0.5 |
| 三腳架 + 球型雲台 | 0.08 |
| 三腳架 + 油壓雲台 | 0.08 |
| 三腳架 + 懸臂雲台 | 0.05 |

防手震：sigma 再乘以 2^(−stops)。手持 500mm 配 5 格防手震，安全快門從 1/500 變成約 1/15。

這個 omega 同時用在兩個地方：觀景窗的畫面晃動（即時）與照片的模糊（按快門時取樣）。
鏡頭越長畫面晃得越明顯，玩家會自然體會到。

雲台轉動（玩家主動移動滑鼠）的角速度也加進 omega，追鳥時快門太慢一樣會糊。

### 3.6 ISO 噪點

```
sigmaNoise = 0.004 · kBody · sqrt( ISO / 100 )        // 線性空間，中灰處的標準差
```

| 機身 | kBody |
|---|---|
| B1 入門 | 1.6 |
| B2 中階 | 1.2 |
| B3 全幅 | 0.6 |
| B4 旗艦 | 0.5 |

B1 在 ISO 6400 約 0.05，明顯粗糙；B3 在 ISO 6400 約 0.019，乾淨。
噪點在曝光倍率之後、色調曲線之前加入，並依亮度乘以 sqrt(L + 0.02) 讓暗部噪點較明顯。

### 3.7 鏡頭銳利度

每顆鏡頭有「全開柔化」值（px），光圈縮小兩格內線性消失。
增距鏡額外加固定柔化。這個值直接加進鳥眼的總模糊量。

### 3.8 總模糊量（評分用）

```
totalBlurPx = sqrt( cocPx² + motionBlurPx² + shakeBlurPx² + lensSoftPx² )
```

以照片解析度為準（原型 1920 寬）。小於 1.5px 視為銳利，大於 12px 視為糊掉。

---

## 4. 渲染管線

兩條管線共用場景，差別在解析度與開啟的 pass。

### 4.1 Live（觀景窗，每幀）

```
場景（toon 材質） → ToonOutline（描邊 + 抖線） → Paper（紙張紋理）
→ CocDof（低品質，固定 8 次取樣） → Exposure（曝光倍率、噪點、色調曲線）
→ 觀景窗紙框 UI（HTML）
```

- 解析度跟隨視窗，目標 60fps。
- 不做動態模糊（真實觀景窗也不會）。
- 觀景窗延遲：入門機身把相機姿態延後 N 幀再渲染（環形緩衝）。
- 連拍黑屏：入門機身在每張曝光時觀景窗黑 1 到 2 幀。
- 手震：每幀把 omega 積分成角度偏移加到相機旋轉。

### 4.2 Photo（按快門，一次）

```
場景 → ToonOutline → Paper
→ 速度緩衝（鳥眼與各鳥片的螢幕速度）
→ CocDof（高品質，Poisson disk 32 到 48 次取樣，依 cocPx 變半徑）
→ MotionBlur（主體方向模糊 + 全幀手震模糊）
→ Exposure（同 live，但噪點用固定種子）
→ 讀回像素 → OffscreenCanvas → WebP 0.85
```

- 解析度：3:2，原型 1920 × 1280。正式版可到 2400 × 1600。
- 一次渲染約 20 到 50ms，連拍 12fps 時會掉幀，用「緩衝區」的設定吸收：
  連拍期間只記錄每張的相機狀態與鳥狀態快照，結算時再逐張渲染。
  這同時正好模擬真實機身「緩衝區慢慢寫入記憶卡」的感覺。
- 同一次渲染額外輸出一張低解析度（240 × 160）的 ID 緩衝與深度緩衝，給評分用。

### 4.3 風格 pass 細節

**Toon 材質**：MeshToonMaterial 加三階 gradientMap，或自寫 shader 做 2 到 3 段量化。
紙片鳥用無光照材質（MeshBasicMaterial）貼色鉛筆紋理，再由 Paper pass 統一加紙張質感。

**ToonOutlinePass**：以深度與法線的邊緣偵測取輪廓，輪廓取樣座標用低頻雜訊位移產生抖線，
雜訊每 8 到 12 幀換一次種子讓線條像逐格手繪般輕微跳動。線寬依螢幕解析度固定 1.5 到 2.5px。

**PaperPass**：疊乘紙張紋理（螢幕空間，不隨相機移動），填色區域疊色鉛筆筆觸紋理，
並在描邊內側留 1 到 2px 的白邊模擬塗不滿。

這三個 pass 放在景深與曝光之前，所以照片會是「一張塗鴉被相機拍下來」：
失焦的塗鴉線條會糊、過曝的紙會白、高 ISO 的紙會有噪點。

---

## 5. 照片擷取與儲存

```ts
interface PhotoRecord {
  id: string
  levelId: string
  hideId: string
  takenAt: number
  settings: { focalMm: number; fNumber: number; shutterS: number; iso: number; focusM: number }
  gear: { body: string; lens: string; support: string; accessories: string[] }
  score: PhotoScore
  species?: string
  birdState?: 'S1' | 'S2' | 'S3' | 'S4' | 'S5'
  blob: Blob            // WebP
  thumb: Blob           // 320 寬
}
```

- IndexedDB 兩個 store：photos、saves。
- 相簿頁用縮圖，點開才讀原圖。
- 匯出：所有紀錄打包成 JSON 加 base64 圖片，供備份與未來雲端遷移。

---

## 6. 評分實作

評分輸入分兩類：**解析量**（由參數與場景狀態算出）與**影像量**（由 240 × 160 的小圖統計）。

### 6.1 需要從場景取得的資料

| 資料 | 來源 |
|---|---|
| 鳥眼世界座標 | 紙片鳥的 eye 節點 |
| 鳥眼螢幕座標與深度 | 投影 |
| 鳥眼螢幕速度 | 前一幀投影差 |
| 鳥的螢幕外框 | 投影骨架各節點 |
| 鳥頭朝向 | head 節點前向量與相機方向夾角 |
| 鳥到相機距離 | 直接算 |
| 遮擋比例 | ID 緩衝中鳥的像素數 ÷ 外框面積的預期值；另外從相機向鳥眼 raycast |
| 背景距離 | ID 緩衝外、外框周圍 1.5 倍區域的深度平均 |
| 背景雜亂 | 同區域小圖的亮度變異數與邊緣密度 |
| 主體亮度分佈 | ID 緩衝內像素的亮度：平均、>0.97 比例、<0.03 比例 |
| 太陽方向 | lighting |

### 6.2 四大項公式（初版，等原型調）

**對焦與銳利度（30）**

```
blur = totalBlurPx（第 3.8 節，以鳥眼計）
sharp = clamp( 1 − (blur − 1.5) / 10.5, 0, 1 )
detail = clamp( birdHeightPx / 300, 0, 1 )           // 鳥太小沒細節
focus = 30 · sharp · (0.6 + 0.4 · detail)
若 cocPx 單獨 > 12 → 封頂二星
```

**曝光（25）**

```
meanL = 主體平均亮度（色調曲線後）
target = 依鳥種反照率查表：白鷺 0.72、白頭翁 0.45、黑鵯 0.25
expo = 1 − min( |log2( meanL / target )| / 1.5, 1 )
clipPenalty = 主體 >0.97 的比例 · 2
crushPenalty = 主體 <0.03 的比例 · 1.5
noisePenalty = clamp( (sigmaNoise − 0.015) / 0.04, 0, 1 ) · 0.4
exposure = 25 · clamp( expo − clipPenalty − crushPenalty − noisePenalty, 0, 1 )
```

**構圖與背景（25）**

```
sizeRatio = birdHeightPx / imageH
size = 三角形函數：0.25 到 0.6 得滿分，0.1 以下與 0.9 以上零分
thirds = 1 − 鳥眼到最近三分點的距離 / (imageW · 0.25)，夾 0 到 1
lead = 視線方向那一側的留白比例，0.55 到 0.75 滿分
bgSep = clamp( ( bgDistance − birdDistance ) / birdDistance, 0, 1 )   // 背景越遠越好
bgClean = 1 − clamp( bgVariance / 0.08, 0, 1 )
eyeLevel = 1 − clamp( |相機俯仰 − 鳥眼方向俯仰| / 20°, 0, 1 )
occlusion = 遮擋比例（0 到 1）
composition = 25 · ( 0.25·size + 0.15·thirds + 0.15·lead + 0.2·bgSep + 0.15·bgClean + 0.1·eyeLevel )
              · ( 1 − occlusion )
若 occlusion > 0.5 → 封頂一星
```

**姿態與時機（20）**

```
stateScore = { S1: 0.4, S2: 0.55, S3: 0.7, S4: 0.9, S5: 1.0 }
facing = 頭朝向與相機夾角：60° 到 120°（側面）1.0，30° 到 60°（四分之三）1.0，
         正面 0.8，背面（>150°）0.2
catchlight = 太陽在相機這一側且與相機方向夾角 < 70° 且鳥眼面向相機 → 1，否則 0.6
moment = 20 · stateScore · facing · ( 0.7 + 0.3 · catchlight )
```

**實作備註（M4 已實作）**

- 影像統計在 480 × 320 的遮罩上做：無遮擋遮罩（只畫鳥）與有遮擋遮罩（場景黑色寫深度後再畫鳥）讀回 CPU，
  兩者像素數之比就是遮擋；鳥的紙片放在獨立的 layer，場景 pass 不畫它，避免同深度的 z-fighting 把遮罩打破。
- 主體亮度從最終照片的像素取，先用 ACES 反函數回到線性值再算格數；紙片經描邊與紙張顆粒後比貼圖反照率暗，
  實測增益 `RENDER_GAIN = 0.72`。曝光偏差四分之一格內不扣分，兩格歸零。
- 背景距離用 12 條射線沿鳥的外框外圈打到場景，取中位數；沒打到東西視為天空。
- 五星照片若仍有明顯失分項，建議會顯示該項而不是「漂亮」。

**總分與星等**

```
total = focus + exposure + composition + moment
stars = total ≥ 85 ? 5 : ≥70 ? 4 : ≥55 ? 3 : ≥40 ? 2 : 1
套用封頂規則
畫面中無鳥 → total 0
```

結算頁要把四大項各自顯示出來，並附一句話的建議（「快門太慢，主體動態模糊 23px」），
這是教學的主要通道。

---

## 7. 鳥：狀態機與動畫

```ts
type BirdState = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

interface SpeciesDef {
  id: string
  heightM: number                 // 體型，用來算像素高度
  albedo: number                  // 曝光目標
  perchPoints: string[]           // 場景裡可停的點
  dwell: { min: number; max: number }        // 停留秒數
  interval: { min: number; max: number }     // 出現間隔秒數
  transitions: Record<BirdState, Partial<Record<BirdState, number>>>  // 轉移機率
  stateDurations: Record<BirdState, { min: number; max: number }>
  flightSpeedMs: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  callAudio: string
  alertness?: unknown             // 保留給驚嚇系統
}
```

- 狀態機每個狀態有持續時間與轉移表。S4 是固定長度的過場（起飛或降落）。
- 動畫：紙片鳥的 head、body、wingL、wingR、tail 節點用程式驅動，
  S2 是頭部小幅旋轉與偶爾低頭，S3 加跳枝位移，S4/S5 是翅膀週期擺動加路徑移動。
  不用 Blender 動畫，程式動畫對原型更快，也容易把速度交給動態模糊計算。
- 紙片翻面：依相機到鳥的方向與鳥的前向量夾角，切換正面、側面、四分之三面三張貼圖並做鏡像。
- 出現：spawner 依 interval 抽下一次出現時間，先播鳴叫，2 到 3 秒後從場景邊緣以 S5 飛入。

---

## 7.1 教學系統

教學不是獨立系統，而是一個特殊關卡加一個步驟執行器。

```ts
interface TutorialStep {
  id: string
  title: string                    // 課本頁名
  hint: [string, string?]          // 一句做什麼、一句為什麼
  stuckHint?: string               // 卡住 20 秒後的圖解
  unlocked: ('zoom' | 'focus' | 'aperture' | 'shutter' | 'iso' | 'shoot' | 'burst' | 'overview')[]
  overlays: ('focusPoint' | 'thirds' | 'leadArrow' | 'exposureTriangle')[]
  setup?: (ctx: TutorialCtx) => void          // 例如把相機預設成過曝、把場景切到陰影
  done: (ctx: TutorialCtx) => boolean         // 過關條件，讀相機狀態與評分的中間量
  birdScript?: BirdState[]                    // 這一步斑鳩的固定狀態序列
}
```

- `done` 直接重用評分模組的中間量（鳥眼模糊圈、主體亮度、三分距離），不另外寫判斷。
- 教學關的 spawner 關閉，斑鳩由 `birdScript` 驅動，狀態切換由步驟觸發。
- 輔助線畫在 HTML 層，不進渲染管線，所以照片裡不會有三分線。
- 進度存在 saves，首次進入遊戲若未完成教學就直接進入第零課。

## 8. 輸入對應

| 動作 | 輸入 |
|---|---|
| 雲台轉動 | 滑鼠移動（Pointer Lock） |
| 變焦 | 滾輪 |
| 對焦距離 | 右鍵按住拖曳 |
| 光圈 | Q / E |
| 快門 | A / D |
| ISO | Z / C |
| 半按快門 | 空白鍵 |
| 拍攝 / 連拍 | 左鍵 / 按住 |
| 放下相機看全景 | Tab（切換） |
| 收工 | Esc → 確認 |

雲台阻尼依支撐不同：手持無阻尼，油壓雲台有一階低通與最大角速度，懸臂雲台低通但不限速。

---

## 9. 資料結構

```ts
interface LensDef {
  id: string; name: string
  focalMin: number; focalMax: number
  apertureAtMin: number; apertureAtMax: number   // 變焦鏡光圈隨焦距線性插值（以 stop 為單位）
  minFocusM: number
  afSpeed: number          // 合焦每公尺需要的秒數，0 表示僅手動
  isStops: number
  softWideOpenPx: number
}

interface BodyDef {
  id: string; name: string
  sensor: 'FF' | 'APSC'
  kNoise: number
  isoMax: number
  fps: number
  bufferFrames: number
  cardWriteFps: number      // 緩衝區滿後的速度
  evfLagFrames: number
  blackout: boolean
  afTier: 0 | 1 | 2 | 3     // 0 手動、1 單點、2 連續、3 鳥眼
  modes: ('M' | 'Av' | 'Tv' | 'P')[]
}

interface SupportDef { id: string; name: string; shakeMul: number; panDamping: number; panMaxRadS: number }

interface AccessoryDef {
  id: string; name: string
  focalMul?: number; apertureStops?: number; afSpeedMul?: number; softPx?: number
  dwellMul?: number; spawnMul?: number
  bufferMul?: number; cardCapacity?: number
}

interface HideDef { id: string; position: [number, number, number]; yaw: number; description: string }

interface LevelDef {
  id: string; sceneId: string
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'dusk'
  weather: 'sunny' | 'overcast' | 'windy'
  evScene: number
  hides: string[]
  species: { id: string; spawnMul?: number }[]
  quests: QuestDef[]
  durationS: number
  cardCapacity: number
}
```

---

## 10. 效能注意

- 景深 pass 是最貴的。Live 用 8 次取樣加半解析度；Photo 才用高取樣。
- 紙片鳥的數量少（一關同時最多 3 隻），場景三角形控制在 10 萬以內。
- 描邊 pass 需要法線緩衝，用 MRT 或第二次渲染；原型先用第二次渲染，之後再優化。
- 連拍時不即時渲染照片，只存快照（相機狀態、各鳥節點的世界矩陣、omega 樣本），
  結算時逐張渲染並顯示「寫入記憶卡中」的進度條。
- WebP 編碼用 OffscreenCanvas.convertToBlob，在主執行緒外完成。

---

## 11. 原型里程碑（每週兩天）

| 里程碑 | 內容 | 預估 |
|---|---|---|
| M0 骨架 | Vite + TS + three，載入一個低多邊形場景，滑鼠轉視角，toon 材質 | 0.5 天 |
| M1 相機 | 焦距 / 光圈 / 快門 / ISO / 對焦距離可調，曝光模擬，景深即時預覽，觀景窗 HUD，手震 | 2 天 |
| M2 成像 | 按快門高解析渲染、高品質景深、動態模糊、噪點、描邊與紙張 pass、存入 IndexedDB、相簿頁 | 2.5 天 |
| M3 鳥 | 紙片白頭翁（三個角度塗鴉）、五段狀態機、出現與離開循環、鳴叫提示 | 2 天 |
| M4 評分 | 四大項計算、結算頁、星等、一句話建議 | 1.5 天 |
| M5 教學 | 步驟執行器、黑板提示、輔助線、腳本化斑鳩、十個步驟 | 1.5 天 |
| M6 調整 | 數值調整、一個機位、三個任務、代幣計數 | 1 天 |

合計約 11 天，約 6 週。M2 完成就可以先感受「真的拍出一張照片」，建議在那時停下來評估手感。

---

## 12. 風險

| 風險 | 對策 |
|---|---|
| 景深 pass 效能不夠 | Live 降品質，Photo 離線渲染，必要時照片解析度降到 1600 寬 |
| 手震太晃讓人暈 | sigma 可調，觀景窗加輕微阻尼；提供「減少晃動」的無障礙選項但評分照舊 |
| 評分公式與直覺不符 | 結算頁顯示每一項的原始量（模糊 px、過曝比例），用數字對照感受來調 |
| 紙片鳥在景深裡看起來像卡片 | 給紙片 2 到 3mm 厚度與多層（頭、身、翅）在深度上錯開，散景會自然分層 |
| 描邊在失焦時看起來怪 | 描邊 pass 放在景深之前，讓線條和填色一起被糊掉，這是對的順序 |
| 瀏覽器讀回像素慢 | 只在按快門時讀回，連拍改用快照延後渲染 |

---

## 13. 第一步

```
npm create vite@latest bird-photo-game -- --template vanilla-ts
cd bird-photo-game
npm i three idb-keyval
npm i -D @types/three vitest
```

然後從 `src/camera/optics.ts` 與 `src/camera/exposure.ts` 開始，先把第 3 節的公式寫成純函式並寫測試，
再接到 three.js 的相機與 pass。公式對了，之後所有的器材差異都只是 JSON 數值。
