"""用 Gemini 產生器材的紙片貼紙插畫（無品牌標誌），去背後存到 public/gear/<id>.png。
用法：python3 -I scripts/gen_gear.py [id ...]（不給 id 就全部）
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_sprites import gen_image, keyout

STYLE = ("drawn as a hand-drawn paper cutout sticker for a children's picture book: wobbly pencil outline, "
         "colored-pencil fill with visible strokes and slight white gaps at the edges, flat shading, sticker white border. "
         "No brand names, no logos, no text. Object fully visible, centered, plain solid white background only.")

ITEMS = {
    'L1': "a small compact black plastic telephoto zoom lens for a mirrorless camera, 55-250mm class, lens hood off",
    'L2': "a mid-size black telephoto zoom lens 100-400mm class with a zoom ring and a small lens hood",
    'L3': "a professional white-barrel telephoto zoom lens 100-500mm class with a tripod collar and red ring accent, lens hood on",
    'L4': "a large white super-telephoto prime lens 500mm f/4 with a deep lens hood and tripod foot, seen from the side",
    'L5': "a huge white super-telephoto prime lens 600mm f/4 with a very deep lens hood and tripod foot, seen from the side",
    'B1': "a small entry-level mirrorless camera body without lens, front view, simple grip, pop-up flash",
    'B2': "a mid-size APS-C mirrorless camera body without lens, front view, deep grip, two dials on top",
    'B3': "a full-frame mirrorless camera body without lens, front view, deep grip, electronic viewfinder hump",
    'B4': "a flagship professional mirrorless camera body with integrated vertical battery grip, without lens, front view",
    'S0': "a pair of human hands holding a long telephoto lens camera steadily, elbows tucked in, side view, no face",
    'S1': "a single carbon-fiber monopod with a small tilt head, standing",
    'S2': "a carbon-fiber tripod with a ball head on top, standing",
    'S3': "a tripod with a fluid video head with a long pan handle, standing",
    'S4': "a sturdy tripod with a gimbal head (a swinging arm cradle for a big lens) on top, standing",
}

def main():
    ids = sys.argv[1:] or list(ITEMS)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, 'public', 'gear')
    os.makedirs(outdir, exist_ok=True)
    for sid in ids:
        print(f'[{sid}] ...', flush=True)
        png = gen_image(f"{ITEMS[sid]}, {STYLE}")
        img, info = keyout(png, (0.5, 0.5))
        img.save(os.path.join(outdir, f'{sid}.png'))
        print(f'[{sid}] done {info["contentW"]}x{info["contentH"]}', flush=True)

if __name__ == '__main__':
    main()
