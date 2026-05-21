#!/usr/bin/env python3
"""Уменьшенное превью карты Земли + 4 региональных crop'а с deталями."""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw"  # не нужен
FULL = ROOT / "public/tiles/earth_test.png"
PREV = ROOT / "public/tiles/earth_preview.png"
PREV_HQ = ROOT / "public/tiles/earth_preview_hq.png"
CROPS = ROOT / "public/tiles/earth_crops.png"

Image.MAX_IMAGE_PIXELS = None

img = Image.open(FULL).convert("RGBA")
print(f"full: {img.size}")

# Lo-res полная карта
prev = img.resize((1808, 908), Image.NEAREST)  # 8× даунскейл
prev.save(PREV, optimize=True)
print(f"✓ {PREV} ({prev.size})")

# Mid-res полная карта 2× даунскейл (детальнее)
mid = img.resize((3616, 1816), Image.NEAREST)
mid.save(PREV_HQ, optimize=True)
print(f"✓ {PREV_HQ} ({mid.size})")

# 4 региона crop в полном разрешении
W, H = img.size
regions = [
    ("nw_eurasia",     0,        H // 4,  W // 3,     H // 4 + 800),
    ("africa",         W // 3,   H // 4,  W // 2,     H // 4 + 800),
    ("americas",       W // 6,   H // 4,  W // 2,     H // 2),
    ("se_asia",        W // 2,   H // 4,  W * 3 // 4, H // 2),
]
# Стек crop'ов 2×2
cw = 800
ch = 500
result = Image.new("RGBA", (cw * 2, ch * 2 + 20 * 2), (20, 20, 20, 255))
for i, (name, x0, y0, x1, y1) in enumerate(regions):
    crop = img.crop((x0, y0, min(x1, W), min(y1, H)))
    crop.thumbnail((cw, ch), Image.NEAREST)
    rx = (i % 2) * cw
    ry = (i // 2) * (ch + 20) + 20
    result.paste(crop, (rx, ry))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(result)
    draw.text((rx + 4, ry - 14), name, fill=(255, 255, 200, 255))
result.save(CROPS, optimize=True)
print(f"✓ {CROPS} ({result.size})")
