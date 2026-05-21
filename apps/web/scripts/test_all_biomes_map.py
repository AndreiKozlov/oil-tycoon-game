#!/usr/bin/env python3
"""
Тест-карта по wang_table.json для нескольких биомов.
Генерирует 4 карты (grass, snow, swamp, volc) — круг в океане грязи.
"""
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
WANG = ROOT / "public/tiles/wang_table.json"
OUT = ROOT / "public/tiles/wang_multibiome_test.png"


def find_tile(name):
    for d in (BG, TILEMAP):
        if (d / name).exists():
            return d / name
    return None


def render_biome(wang, biome_name, fallback_color):
    random.seed(11)
    table = {int(k): v for k, v in wang[biome_name].items()}
    W, H = 12, 12
    cx, cy = (W - 1) / 2, (H - 1) / 2
    BW, BH = W + 1, H + 1
    is_own = [[((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < 4.5 for x in range(BW)] for y in range(BH)]

    canvas = Image.new("RGBA", (W * TILE, H * TILE), fallback_color + (255,))
    for ty in range(H):
        for tx in range(W):
            nw = 1 if is_own[ty][tx] else 0
            ne = 2 if is_own[ty][tx + 1] else 0
            sw = 4 if is_own[ty + 1][tx] else 0
            se = 8 if is_own[ty + 1][tx + 1] else 0
            mask = nw | ne | sw | se
            cands = table.get(mask, [])
            if not cands:
                # fallback по ближайшей маске
                for fb in (15, 0, 3, 12, 5, 10):
                    if table.get(fb):
                        cands = table[fb]
                        break
            if not cands:
                continue
            name = random.choice(cands)
            p = find_tile(name)
            if p:
                canvas.paste(Image.open(p).convert("RGBA"), (tx * TILE, ty * TILE))
    return canvas


def main():
    wang = json.loads(WANG.read_text())
    biomes_to_show = [
        ("grass", (110, 80, 50)),
        ("snow", (130, 100, 70)),
        ("swamp", (100, 80, 50)),
        ("volc", (60, 40, 35)),
        ("rough", (110, 80, 50)),
        ("dirt", (220, 200, 140)),
    ]
    cols = 3
    rows = (len(biomes_to_show) + cols - 1) // cols
    label_h = 16
    sub_w = 12 * TILE
    sub_h = 12 * TILE + label_h
    canvas = Image.new("RGBA", (cols * sub_w, rows * sub_h), (20, 20, 20, 255))
    draw = ImageDraw.Draw(canvas)
    for i, (name, fb) in enumerate(biomes_to_show):
        col = i % cols
        row = i // cols
        sub = render_biome(wang, name, fb)
        canvas.paste(sub, (col * sub_w, row * sub_h + label_h))
        draw.rectangle([col * sub_w, row * sub_h, (col + 1) * sub_w, row * sub_h + label_h], fill=(40, 40, 60, 255))
        draw.text((col * sub_w + 4, row * sub_h + 1), f"{name}", fill=(220, 220, 200, 255))
    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})")


if __name__ == "__main__":
    main()
