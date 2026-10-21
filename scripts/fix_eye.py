"""對已去背的貼圖重新標眼睛並更新 JSON。
用法：python3 -I scripts/fix_eye.py <id> <view>
"""
import json, os, sys
from io import BytesIO
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_sprites import locate_eye

sid, view = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
jp = os.path.join(root, 'src', 'birds', 'species', 'generated', f'{sid}.json')
d = json.load(open(jp, encoding='utf-8'))
sp = d['sprites'][view]
im = Image.open(os.path.join(root, 'public', sp['file'])).convert('RGBA')
bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
bg.alpha_composite(im)
buf = BytesIO(); bg.convert('RGB').save(buf, 'PNG')
x, y = locate_eye(buf.getvalue())
sp['eyeUv'] = [round(x, 4), round(1 - y, 4)]
json.dump(d, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(sid, view, 'eyeUv ->', sp['eyeUv'])
