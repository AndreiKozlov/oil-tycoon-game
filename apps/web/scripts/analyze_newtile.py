#!/usr/bin/env python3
"""
Анализ newtile.png: найти оптимальный размер тайла.

Tilemap 1024×1536. Если правильно разрезать на сетку N×N, соседние тайлы
из исходного изображения ВСЕГДА стыкуются (они уже стыкуются в самом
изображении). Это даёт «бесшовные» куски биома.

Алгоритм:
  1) Для каждого размера 32/48/64/96/128:
     - режем картинку на тайлы NxN
     - смотрим горизонтальные пары соседей (tile[i,j], tile[i+1,j]):
       сравниваем right_edge(left) vs left_edge(right) — должны быть РАВНЫ,
       потому что это один и тот же столбец пикселей в исходнике.
  2) Выводим описание содержимого каждого тайла:
     - средний цвет (по нему определяем био-категорию: water/sand/grass/dark)
"""
import json
from pathlib import Path
from PIL import Image
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/root/oil_tycoon_project/newtile.png")
OUT = ROOT / "public/tiles/newtile_analysis.txt"


def avg_rgb_block(img, x0, y0, w, h):
    px = img.load()
    r = g = b = a_alpha = 0
    n = 0
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            p = px[x, y]
            r += p[0]; g += p[1]; b += p[2]; a_alpha += p[3]; n += 1
    return (r/n, g/n, b/n, a_alpha/n)


def categorize(rgb):
    r, g, b, a = rgb
    if a < 100:
        return "."  # transparent
    # WATER: синий
    if b > r + 10 and b > g - 5 and b > 60:
        return "W"
    # SAND: светлый тёплый
    if r > 140 and g > 110 and b > 60 and r > b + 10:
        return "S"
    # GRASS: зелёный
    if g > r and g > b and g > 60:
        return "G"
    # DARK / forest / mountain
    if r < 100 and g < 100 and b < 100:
        return "F"  # forest/dark
    return "?"


def main():
    img = Image.open(SRC).convert("RGBA")
    W, H = img.size
    print(f"Tilemap: {W}×{H}")

    lines = []
    for size in [32, 48, 64, 96, 128]:
        if W % size != 0 or H % size != 0:
            lines.append(f"\n=== Size {size}: NOT divisible (W={W}%{size}={W%size}, H={H}%{size}={H%size})")
            continue
        cols = W // size
        rows = H // size
        lines.append(f"\n=== Size {size}: grid {cols}×{rows} = {cols*rows} tiles ===")

        # Категории тайлов (по среднему центру)
        cats = {}
        for ty in range(rows):
            for tx in range(cols):
                rgb = avg_rgb_block(img, tx * size + size // 4, ty * size + size // 4, size // 2, size // 2)
                cats[(tx, ty)] = categorize(rgb)

        # Печать сетки категорий
        lines.append("Category grid:")
        for ty in range(rows):
            row = []
            for tx in range(cols):
                row.append(cats[(tx, ty)])
            lines.append("  " + " ".join(row))

        cat_count = defaultdict(int)
        for c in cats.values():
            cat_count[c] += 1
        lines.append(f"Distribution: {dict(cat_count)}")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"✓ {OUT}")
    for line in lines:
        print(line)


if __name__ == "__main__":
    main()
