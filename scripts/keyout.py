"""把 Gemini 生成的白底貼紙去背、裁切、放進正方形畫布。
用法：python3 -I scripts/keyout.py input.png output.png [eye_x eye_y]
eye_x eye_y 為原圖上的眼睛像素座標，會印出換算後的 uv。
"""
import sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

def keyout(src: str, dst: str, eye=None, size=1024, pad=40):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(int)
    near_white = (rgb.min(axis=2) > 228) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 18)
    outside = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x]: outside[y, x] = True; q.append((y, x))
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
    canvas.resize((size, size), Image.LANCZOS).save(dst)
    info = {'contentW': round(cw / side, 3), 'contentH': round(ch / side, 3)}
    if eye:
        ex, ey = eye[0] - bbox[0] + ox, eye[1] - bbox[1] + oy
        info['eyeUv'] = (round(ex / side, 4), round(1 - ey / side, 4))
    print(info)

if __name__ == '__main__':
    eye = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else None
    keyout(sys.argv[1], sys.argv[2], eye)
