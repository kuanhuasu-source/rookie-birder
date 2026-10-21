# 鳥類美術管線：用 Gemini 生成紙片貼圖

結論：Gemini 圖像模型用在**開發期產生素材**，不在遊戲執行時呼叫。
一次實驗（2026-10-21）用 `gemini-3.1-flash-image` 生成珠頸斑鳩的側面、四分之三面、起飛三張，
以第一張當參考圖，角色、筆觸、貼紙白邊都保持一致。原圖在 `docs/concept/`。

## 為什麼不在遊戲裡即時生成

- 每張要數秒，拍鳥的節奏是毫秒級。
- 結果不可控：眼睛位置、頭的朝向、翅膀狀態都是評分輸入，必須事先知道。
- 景深、動態模糊、曝光本來就由相機管線渲染，生成的只是「紙片」本身。
- 離線也要能玩。

## 需要幾張

每種鳥一組貼圖，對應五段狀態與三個視角：

| 用途 | 視角 | 張數 |
|---|---|---|
| S1 靜止、S2 小動作 | 側面、四分之三面、正面 | 3（頭部另外切出來做轉頭） |
| S3 活動（跳枝、步行） | 側面 | 1 |
| S4 起飛 / 降落 | 側面翅膀全張 | 1 |
| S5 飛行 | 側面滑翔、下方仰視 | 2 |
| 特殊行為（入水、啄洞、捕食） | 依鳥種 | 0 到 2 |

左右用鏡像。22 種鳥約 180 張，一張幾秒，產圖本身一天內可完成；清理與標記眼睛是主要工時。

## 腳本

```
python3 -I scripts/gen_sprites.py <id> "<英文名>" "<中文名>" "<學名>" "<辨識特徵>" <身長公尺>
python3 -I scripts/fix_eye.py <id> <view>      # 眼睛標錯時重問
```

一種鳥約 2 分鐘：三張圖、三次眼睛定位、去背與反照率，輸出 `public/birds/<id>-*.png` 與 `src/birds/species/generated/<id>.json`。
眼睛由 Gemini 指出，腳本會檢查「面向右的鳥，眼睛應在內容右半部、上半部」，不合理就換個問法重問。
第一批四種鳥 12 張裡有 5 張第一次標錯，重問後全部正確，所以每批跑完還是要看一次標記圖。

## 流程

1. **第一張**：純文字提示，要求側面、面向右、完整可見、純白背景、無樹枝、無文字，並指明物種的辨識特徵（例如珠頸斑鳩的黑底白點頸斑、紅腳）。
2. **其餘角度與姿態**：把第一張當參考圖一起送，提示寫「同一個角色、同一種畫風、同樣的貼紙白邊」，只改視角或動作。
   注意要重申「無樹枝」，否則四分之三面那張會自己長出一根樹枝。
3. **去背**：從四角 flood fill 近白像素當背景，保留貼紙白邊；邊緣高斯 0.8px 柔化。
   腳本見 `scripts/keyout.py`（由實驗腳本整理而來）。
4. **裁切與標記**：裁到內容外框、放進正方形畫布，記錄「內容寬高佔比」與「眼睛 uv」。
   眼睛位置目前手動量，之後可以用深紅/深黑圓點偵測半自動化。
5. **切件**：頭、翅膀、尾巴各自切成獨立紙片以便程式動畫；第一版先用整張，M3 再切。
6. **資料化**：每種鳥一個 JSON，列出每張貼圖的檔名、視角、狀態、眼睛 uv、內容佔比、實際身長。

## 提示詞模板

```
A {species} ({中文名}, {學名}) in full side profile, facing right, perched,
drawn as a hand-drawn paper cutout sticker for a children's picture book:
wobbly pencil outline, colored-pencil fill with visible strokes and slight white gaps at the edges,
flat shading, accurate plumage ({辨識特徵}).
Whole bird fully visible, centered, no branch, no background: plain solid white background only. No text.
```

參考圖版本在前面加：
```
Keep exactly the same character, art style, colors, pencil outline, colored-pencil fill and sticker white border
as the reference image. {視角或動作描述}. No branch. Plain solid white background, whole bird fully visible, no text.
```

## 真實感從哪裡來

畫面的「像照片」感來自相機管線，不是鳥的 3D 程度：薄景深把紙片與背景分開、動態模糊讓起飛有速度、噪點與過曝讓光線有重量。
紙片鳥要做的只有兩件事：輪廓正確、角度切換自然。
若未來想要完整 3D 鳥，可以用這些貼圖當 image-to-3D 服務的輸入再重新上 toon 貼圖，但目前的風格與玩法不需要。

## 授權備忘

Gemini 生成圖的使用條款需在正式發行前確認，物種特徵也需對照真實圖鑑校對。
