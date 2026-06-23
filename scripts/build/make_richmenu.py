#!/usr/bin/env python3
"""陽気スポジョブのリッチメニュー画像(2500x843・左右2ボタン)を生成する。"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 2500, 843
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'spojob', 'richmenu.png')

img = Image.new('RGB', (W, H), '#2D5A8E')   # 左：濃いブルー
d = ImageDraw.Draw(img)
d.rectangle([W // 2, 0, W, H], fill='#4A8FD4')                 # 右：明るいブルー
d.rectangle([W // 2 - 3, 90, W // 2 + 3, H - 90], fill='#FFFFFF')  # 中央仕切り線

# 日本語フォントを探す（macOS標準のヒラギノ等）
candidates = [
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
]
fp = next((p for p in candidates if os.path.exists(p)), None)
if not fp:
    raise SystemExit('日本語フォントが見つかりません: ' + str(candidates))
big = ImageFont.truetype(fp, 170)
small = ImageFont.truetype(fp, 78)

def t(cx, cy, text, font):
    d.text((cx, cy), text, font=font, fill='#FFFFFF', anchor='mm')

# 左ボタン
t(W // 4, 350, '空きシフト', big)
t(W // 4, 520, 'を見る・応募する', small)
# 右ボタン
t(3 * W // 4, 350, 'マイページ', big)
t(3 * W // 4, 520, '登録・ボーナス確認', small)

img.save(OUT, 'PNG')
print('saved:', os.path.abspath(OUT), img.size)
