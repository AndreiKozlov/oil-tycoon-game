#!/usr/bin/env python3
"""
Аудит water_island_test.png: проверяем стыковку каждой пары соседних тайлов.

Для каждой пары (A, B) горизонтально соседних в собранной картинке:
  - сравниваем правый край A (32 пикселя) с левым краем B (32 пикселя)
  - считаем % совпадающих пикселей (точное равенство RGB)
  - если несовпадение > 30% — это ВИДИМЫЙ шов.

Аналогично для вертикальных пар.

Также сравниваем найденный wang-код каждой клетки с тем что был назначен
скриптом test_water_wang.py — может быть классификатор ошибся.
"""
import json
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public/tiles/water_island_test.png"
WANG = ROOT / "public/tiles/water_wang.json"
SRC_DIR = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"


def pixel_label(rgba):
    """Те же правила что в classify_water_tiles."""
    r, g, b = rgba[0], rgba[1], rgba[2]
    if b > r + 10 and b > g + 5 and b > 70:
        return "W"
    if r > b + 5 or g > b + 5:
        return "L"
    return "?"


def quadrant_label(img, qx, qy, x0, y0):
    """qx, qy ∈ {0,1}; (x0, y0) — позиция тайла в большом изображении."""
    px = img.load()
    counts = {"W": 0, "L": 0, "?": 0}
    for y in range(y0 + qy * 16 + 4, y0 + qy * 16 + 12):
        for x in range(x0 + qx * 16 + 4, x0 + qx * 16 + 12):
            counts[pixel_label(px[x, y])] += 1
    if counts["W"] > counts["L"]:
        return "W"
    return "L"


def code_at(img, tx, ty):
    x0 = tx * TILE
    y0 = ty * TILE
    nw = quadrant_label(img, 0, 0, x0, y0)
    ne = quadrant_label(img, 1, 0, x0, y0)
    sw = quadrant_label(img, 0, 1, x0, y0)
    se = quadrant_label(img, 1, 1, x0, y0)
    return f"{nw}{ne}{sw}{se}"


def edge_diff(img, x1, y1, side1, x2, y2, side2):
    """Сравнить кромку тайла на (x1,y1) сторону side1 с тайлом (x2,y2) стороной side2.
       side ∈ {top, bottom, left, right}.
       Возвращает (matches, total)."""
    px = img.load()

    def get_edge(x0, y0, side):
        if side == "right":
            return [px[x0 * TILE + 31, y0 * TILE + i] for i in range(TILE)]
        if side == "left":
            return [px[x0 * TILE + 0, y0 * TILE + i] for i in range(TILE)]
        if side == "bottom":
            return [px[x0 * TILE + i, y0 * TILE + 31] for i in range(TILE)]
        if side == "top":
            return [px[x0 * TILE + i, y0 * TILE + 0] for i in range(TILE)]

    e1 = get_edge(x1, y1, side1)
    e2 = get_edge(x2, y2, side2)
    matches = 0
    for a, b in zip(e1, e2):
        # Точное совпадение по RGB
        if a[0] == b[0] and a[1] == b[1] and a[2] == b[2]:
            matches += 1
    return matches, len(e1)


def main():
    img = Image.open(IMG).convert("RGBA")
    W = img.size[0] // TILE
    H = img.size[1] // TILE
    print(f"Image: {img.size}, grid {W}×{H}")

    # 1. Найти все коды клеток и сравнить с тем что таблица говорит
    print("\n=== Mismatches in classification ===")
    # Какие коды должны быть по логике карты-биом?
    cx, cy = (W - 1) / 2, (H - 1) / 2
    BW, BH = W + 1, H + 1
    is_land = [[((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < 4.5 for x in range(BW)] for y in range(BH)]

    mismatch_count = 0
    for ty in range(H):
        for tx in range(W):
            nw = "L" if is_land[ty][tx] else "W"
            ne = "L" if is_land[ty][tx + 1] else "W"
            sw = "L" if is_land[ty + 1][tx] else "W"
            se = "L" if is_land[ty + 1][tx + 1] else "W"
            expected = f"{nw}{ne}{sw}{se}"
            actual = code_at(img, tx, ty)
            if actual != expected:
                # Это норма для LLLL (там рисуется grass-тайл) и для diag fallback'ов.
                if expected == "LLLL":
                    continue
                mismatch_count += 1
                if mismatch_count <= 25:
                    print(f"  ({tx:2d},{ty:2d}) expected={expected} actual={actual}")
    print(f"Total mismatches: {mismatch_count} / {W*H}")

    # 2. Edge audit: для каждой пары соседних тайлов посчитать совпадение пикселей
    print("\n=== Bad horizontal stitches (right(A) vs left(B)) ===")
    bad_h = 0
    for ty in range(H):
        for tx in range(W - 1):
            m, t = edge_diff(img, tx, ty, "right", tx + 1, ty, "left")
            ratio = m / t
            if ratio < 0.70:
                bad_h += 1
                if bad_h <= 15:
                    code_a = code_at(img, tx, ty)
                    code_b = code_at(img, tx + 1, ty)
                    print(f"  ({tx:2d},{ty:2d}) {code_a} → ({tx+1:2d},{ty:2d}) {code_b}  match={ratio*100:.0f}%")
    print(f"Total bad horizontal: {bad_h} / {W*(H-0)}")

    print("\n=== Bad vertical stitches (bottom(A) vs top(B)) ===")
    bad_v = 0
    for ty in range(H - 1):
        for tx in range(W):
            m, t = edge_diff(img, tx, ty, "bottom", tx, ty + 1, "top")
            ratio = m / t
            if ratio < 0.70:
                bad_v += 1
                if bad_v <= 15:
                    code_a = code_at(img, tx, ty)
                    code_b = code_at(img, tx, ty + 1)
                    print(f"  ({tx:2d},{ty:2d}) {code_a} ↓ ({tx:2d},{ty+1:2d}) {code_b}  match={ratio*100:.0f}%")
    print(f"Total bad vertical: {bad_v}")

    # 3. Куда конкретно тайлы попадают
    print("\n=== Code distribution ===")
    by_code = defaultdict(int)
    for ty in range(H):
        for tx in range(W):
            by_code[code_at(img, tx, ty)] += 1
    for code in sorted(by_code):
        print(f"  {code}: {by_code[code]}")


if __name__ == "__main__":
    main()
