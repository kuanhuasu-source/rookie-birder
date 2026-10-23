"""隱藏關的火車貼紙：一張側面圖，三個視角共用。眼睛 = 車頭駕駛室的窗。原圖存在 assets-src/trains/（不部署）。
用法：python3 -I scripts/gen_train.py <id> "<中文>" "<English>" "<外觀描述>" <車長m> [eyeX eyeY]
eye 是原圖 0 到 1 座標，預設 0.955 0.42。已有 public/birds/<id>-raw.png 就不重新產圖，只重新去背與定眼。"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_sprites import gen_image, keyout, STYLE  # noqa: E402

def main():
    sid, zh, en, look, body_len = sys.argv[1:6]
    body_len = float(body_len)
    ex, ey = (float(sys.argv[6]), float(sys.argv[7])) if len(sys.argv) >= 8 else (0.955, 0.42)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, 'public', 'birds')
    raw = os.path.join(root, 'assets-src', 'trains', f'{sid}-raw.png')
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    if os.path.exists(raw):
        png = open(raw, 'rb').read()
    else:
        prompt = (f"A {en} in exact full side profile, heading right with the driving cab at the right end, {look}, " + STYLE +
                  "but with accurate, realistic proportions and details like a railway reference photo: correct window spacing, doors, bogies with wheels, couplers, roof equipment. "
                  "The whole train fully visible and perfectly horizontal, filling the width of the image, no rails, no platform, no ground, nothing under the wheels, "
                  "no background: plain solid white background only. No text, no logos, no emblems.")
        print(f'[{sid}] generating...', flush=True)
        png = gen_image(prompt)
        open(raw, 'wb').write(png)
    img, info = keyout(png, (ex, ey))
    img.save(os.path.join(outdir, f'{sid}-side.png'))
    info['file'] = f'birds/{sid}-side.png'
    # 畫出來的車都偏短胖：高度定 4.2 m，再橫向拉 1.5 倍讓比例接近真車
    info['aspect'] = 1.5
    info['sizeM'] = round(4.2 / info['contentH'], 3)
    out = {'id': sid, 'nameZh': zh, 'nameEn': en, 'bodyLengthM': round(info['sizeM'] * 1.5 * info['contentW'], 1),
           'sprites': {'side': info, '3q': dict(info), 'takeoff': dict(info)}}
    gen_dir = os.path.join(root, 'src', 'birds', 'species', 'generated')
    with open(os.path.join(gen_dir, f'{sid}.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'[{sid}]', info, flush=True)

if __name__ == '__main__':
    main()
