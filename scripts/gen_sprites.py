"""用 Gemini 產生一種鳥的三張紙片貼圖（側面、四分之三面、起飛），去背、標眼睛、算反照率。

用法：python3 -I scripts/gen_sprites.py <id> "<英文名>" "<中文名>" "<學名>" "<辨識特徵>" <身長公尺>
輸出：public/birds/<id>-{side,3q,takeoff}.png 與 src/birds/species/generated/<id>.json
需要環境能連到 generativelanguage.googleapis.com（此專案的雲端環境已由代理注入金鑰）。
"""
import base64, json, os, ssl, sys, urllib.request
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

MODEL_IMG = 'gemini-3.1-flash-image'
MODEL_TXT = 'gemini-2.5-flash'
API = 'https://generativelanguage.googleapis.com/v1beta/models/'

ctx = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt') if os.path.exists('/root/.ccr/ca-bundle.crt') else ssl.create_default_context()
proxy = os.environ.get('HTTPS_PROXY')
opener = urllib.request.build_opener(urllib.request.ProxyHandler({'https': proxy}) if proxy else urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=ctx))

def call(model, parts, modalities):
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": modalities}}
    req = urllib.request.Request(API + model + ':generateContent', data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with opener.open(req, timeout=240) as r:
        return json.load(r)

def gen_image(prompt, ref_png=None):
    parts = []
    if ref_png is not None:
        parts.append({"inlineData": {"mimeType": "image/png", "data": base64.b64encode(ref_png).decode()}})
    parts.append({"text": prompt})
    for attempt in range(3):
        d = call(MODEL_IMG, parts, ["IMAGE"])
        for p in d.get('candidates', [{}])[0].get('content', {}).get('parts', []):
            if 'inlineData' in p:
                return base64.b64decode(p['inlineData']['data'])
    raise RuntimeError('no image returned')

def content_bbox(png):
    """近白背景以外的內容外框（0 到 1）。"""
    from io import BytesIO
    a = np.array(Image.open(BytesIO(png)).convert('RGB')).astype(int)
    h, w = a.shape[:2]
    nw = (a.min(axis=2) > 228) & ((a.max(axis=2) - a.min(axis=2)) < 18)
    ys, xs = np.nonzero(~nw)
    return xs.min() / w, ys.min() / h, xs.max() / w, ys.max() / h

def eye_plausible(pt, bbox):
    """側面面向右：眼睛應在內容右半部、上半部。"""
    x, y = pt
    x0, y0, x1, y1 = bbox
    u = (x - x0) / max(1e-6, x1 - x0)
    v = (y - y0) / max(1e-6, y1 - y0)
    return 0.45 <= u <= 1.0 and 0.0 <= v <= 0.55

def locate_eye(png):
    """請 Gemini 指出眼睛位置，回傳 0 到 1 的 (x, y)，左上為原點。不合理就重問，仍失敗就退回頭部位置的估計。"""
    bbox = content_bbox(png)
    prompts = [
        "Point to the center of the bird's visible eye (the eyeball, not the eye ring). Answer with JSON only: {\"point\": [y, x]} using coordinates normalized to 0-1000 where [0,0] is top-left.",
        "Where is the bird's eye in this picture? The bird faces right, so the eye is on the head near the right side. Reply with JSON only: {\"point\": [y, x]}, 0-1000, top-left origin.",
        "Give the bounding box of the bird's eye as JSON only: {\"box_2d\": [ymin, xmin, ymax, xmax]} in 0-1000 coordinates.",
    ]
    for prompt in prompts:
        try:
            parts = [{"inlineData": {"mimeType": "image/png", "data": base64.b64encode(png).decode()}}, {"text": prompt}]
            d = call(MODEL_TXT, parts, ["TEXT"])
            txt = ''.join(p.get('text', '') for p in d['candidates'][0]['content']['parts'])
            obj = json.loads(txt[txt.find('{'): txt.rfind('}') + 1])
            if 'box_2d' in obj:
                y0, x0, y1, x1 = obj['box_2d']
                cand = [((x0 + x1) / 2000, (y0 + y1) / 2000)]
            else:
                y, x = obj['point']
                cand = [(x / 1000, y / 1000), (y / 1000, x / 1000)]   # 也試試 x y 顛倒
            for pt in cand:
                if eye_plausible(pt, bbox):
                    return pt
            print('  eye candidate rejected:', cand, flush=True)
        except Exception as e:
            print('  eye query failed:', e, flush=True)
    # 退回：內容外框右上角往內的估計
    x0, y0, x1, y1 = bbox
    print('  eye fallback estimate used', flush=True)
    return x0 + (x1 - x0) * 0.82, y0 + (y1 - y0) * 0.22

def keyout(png_bytes, eye_norm, size=1024, pad=40):
    from io import BytesIO
    im = Image.open(BytesIO(png_bytes)).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(int)
    near_white = (rgb.min(axis=2) > 228) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 18)
    outside = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    a[..., 3] = np.array(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    out = Image.fromarray(a)
    bbox = Image.fromarray(a[..., 3]).getbbox()
    out = out.crop(bbox)
    cw, ch = out.size
    side = max(cw, ch) + pad
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    ox, oy = (side - cw) // 2, (side - ch) // 2
    canvas.paste(out, (ox, oy))
    final = canvas.resize((size, size), Image.LANCZOS)
    ex, ey = eye_norm[0] * w - bbox[0] + ox, eye_norm[1] * h - bbox[1] + oy
    eye_uv = (round(ex / side, 4), round(1 - ey / side, 4))
    # 反照率：不透明像素的平均線性亮度
    f = np.array(final).astype(float) / 255
    m = f[..., 3] > 0.5
    c = f[..., :3][m]
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    albedo = float((lin @ np.array([0.2126, 0.7152, 0.0722])).mean())
    return final, {'eyeUv': list(eye_uv), 'contentW': round(cw / side, 3), 'contentH': round(ch / side, 3), 'albedo': round(albedo, 3)}

STYLE = ("drawn as a hand-drawn paper cutout sticker for a children's picture book: wobbly pencil outline, "
         "colored-pencil fill with visible strokes and slight white gaps at the edges, flat shading, ")
REF_STYLE = ("Keep exactly the same character, art style, colors, pencil outline, colored-pencil fill and sticker white border "
             "as the reference image. No branch, no perch, nothing under the feet. Plain solid white background, whole bird fully visible, no text.")

def main():
    sid, en, zh, latin, features, body_len = sys.argv[1:7]
    body_len = float(body_len)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, 'public', 'birds')
    os.makedirs(outdir, exist_ok=True)
    side_prompt = (f"A {en} ({zh}, {latin}) in full side profile, facing right, perched with feet visible, {STYLE}"
                   f"accurate plumage ({features}). Whole bird fully visible, centered, no branch, no perch, nothing under the feet, "
                   "no background: plain solid white background only. No text.")
    print(f'[{sid}] side...', flush=True)
    side_png = gen_image(side_prompt)
    print(f'[{sid}] 3q...', flush=True)
    q_png = gen_image(f"Draw the same {en} from a three-quarter front view, body angled toward the viewer, head turned slightly toward the viewer, standing with feet visible. {REF_STYLE}", side_png)
    print(f'[{sid}] takeoff...', flush=True)
    t_png = gen_image(f"Draw the same {en} at the instant of take-off: wings fully spread upward, tail fanned, legs pushing off, side view facing right. {REF_STYLE}", side_png)
    out = {'id': sid, 'nameZh': zh, 'nameEn': en, 'bodyLengthM': body_len, 'sprites': {}}
    for view, png, scale in (('side', side_png, 1.0), ('3q', q_png, 0.95), ('takeoff', t_png, 1.45)):
        print(f'[{sid}] eye {view}...', flush=True)
        eye = locate_eye(png)
        img, info = keyout(png, eye)
        fn = f'{sid}-{view}.png'
        img.save(os.path.join(outdir, fn))
        info['file'] = 'birds/' + fn
        info['sizeM'] = round(body_len * scale / info['contentW'], 3)
        out['sprites'][view] = info
        print(f'[{sid}] {view}: {info}', flush=True)
    gen_dir = os.path.join(root, 'src', 'birds', 'species', 'generated')
    os.makedirs(gen_dir, exist_ok=True)
    with open(os.path.join(gen_dir, f'{sid}.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'[{sid}] done', flush=True)

if __name__ == '__main__':
    main()
