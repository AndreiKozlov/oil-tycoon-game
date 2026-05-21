#!/usr/bin/env python3
"""
Аудит earth_test.png: для каждой клетки проверить, что:
  1) Содержимое тайла соответствует ожидаемым углам (W/S/G детектируются)
  2) Нет соседей W↔G напрямую без S между ними.
  3) Береговые тайлы правильно ориентированы.
"""
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public/tiles/earth_test.png"


def pixel_label(rgba):
    r, g, b = rgba[0], rgba[1], rgba[2]
    # WATER: синий доминирует
    if b > r + 10 and b > g + 5 and b > 70:
        return "W"
    # SAND: светлый тёплый. Главный критерий — высокая яркость.
    if r > 140 and g > 100 and b > 70 and r > b + 25:
        return "S"
    # GRASS: чёткая зелень
    if g > r + 5 and g > b + 5 and g > 60:
        return "G"
    # ТЁМНО-КОРИЧНЕВЫЙ (камешек/dirt/тень) — это НЕ суша как биом, это деталь;
    # для целей stitch-аудита считаем '?' и не учитываем.
    return "?"


def quadrant_at(img, tx, ty, qx, qy):
    px = img.load()
    qsize = 8
    x0 = tx * TILE + qx * 16 + (16 - qsize) // 2
    y0 = ty * TILE + qy * 16 + (16 - qsize) // 2
    counts = {"W": 0, "G": 0, "S": 0, "?": 0}
    for y in range(y0, y0 + qsize):
        for x in range(x0, x0 + qsize):
            counts[pixel_label(px[x, y])] += 1
    counts.pop("?")
    if max(counts.values()) == 0:
        return "?"
    return max(counts, key=counts.get)


def main():
    img = Image.open(IMG).convert("RGBA")
    W = img.size[0] // TILE
    H = img.size[1] // TILE

    # Считаем сетку 2W × 2H угловых меток (по факту того что нарисовано)
    grid = [[None] * (2 * W) for _ in range(2 * H)]
    for ty in range(H):
        for tx in range(W):
            grid[2 * ty + 0][2 * tx + 0] = quadrant_at(img, tx, ty, 0, 0)
            grid[2 * ty + 0][2 * tx + 1] = quadrant_at(img, tx, ty, 1, 0)
            grid[2 * ty + 1][2 * tx + 0] = quadrant_at(img, tx, ty, 0, 1)
            grid[2 * ty + 1][2 * tx + 1] = quadrant_at(img, tx, ty, 1, 1)

    # Проверка 1: соседние квадранты внутри одного тайла должны стыковаться
    # с соседними квадрантами соседнего тайла. Если они оба не "?" и разные —
    # это потенциальная нестыковка.
    bad_h_corners = 0
    bad_v_corners = 0
    for y in range(2 * H):
        for x in range(2 * W - 1):
            a = grid[y][x]; b = grid[y][x + 1]
            if a and b and a != "?" and b != "?":
                # Соседние квадранты в одном тайле (между чётной и нечётной x)
                if x % 2 == 1:  # между двумя тайлами
                    if a != b: bad_h_corners += 1

    for y in range(2 * H - 1):
        for x in range(2 * W):
            a = grid[y][x]; b = grid[y + 1][x]
            if a and b and a != "?" and b != "?":
                if y % 2 == 1:  # между двумя тайлами
                    if a != b: bad_v_corners += 1

    # Проверка 2: нет ли пропущенных тайлов (фон-цвет (30,40,60) канваса).
    bg = (30, 40, 60)
    missing = 0
    px = img.load()
    for ty in range(H):
        for tx in range(W):
            # Берём центральный пиксель
            c = px[tx * TILE + 16, ty * TILE + 16]
            if c[0] == bg[0] and c[1] == bg[1] and c[2] == bg[2]:
                missing += 1

    # Проверка 3: прямой W↔G в соседних тайлах (без S прокладки)
    direct_wg = 0
    for ty in range(H):
        for tx in range(W - 1):
            # right column of tile (tx, ty) vs left column of (tx+1, ty)
            r0 = grid[2*ty + 0][2*tx + 1]
            r1 = grid[2*ty + 1][2*tx + 1]
            l0 = grid[2*ty + 0][2*tx + 2]
            l1 = grid[2*ty + 1][2*tx + 2]
            sides = (r0, r1, l0, l1)
            has_w = "W" in sides; has_g = "G" in sides; has_s = "S" in sides
            if has_w and has_g and not has_s:
                direct_wg += 1

    print(f"Map: {W}×{H}, total cells: {W*H}")
    print(f"Missing tiles (bg color visible): {missing}")
    print(f"Bad horizontal corner stitches: {bad_h_corners} / {2*H*(W-1)}")
    print(f"Bad vertical corner stitches:   {bad_v_corners} / {2*W*(H-1)}")
    print(f"Direct W↔G stitches (no sand):  {direct_wg}")


if __name__ == "__main__":
    main()
