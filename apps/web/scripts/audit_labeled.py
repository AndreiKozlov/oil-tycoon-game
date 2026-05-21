#!/usr/bin/env python3
"""
Аудит water_labeled_test.png: для каждой береговой клетки сравниваем
ОЖИДАЕМОЕ расположение суши (по wang-коду) с ФАКТИЧЕСКИМ (по цвету пикселей).

Если они не совпадают — это и есть ошибка classifier/transform.
"""
from pathlib import Path
from PIL import Image

TILE = 32
SCALE = 4
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public/tiles/water_labeled_test.png"


def pixel_label(rgba):
    r, g, b = rgba[0], rgba[1], rgba[2]
    if b > r + 10 and b > g + 5 and b > 70:
        return "W"
    if r > b + 5 or g > b + 5:
        return "L"
    return "?"


def quadrant_at(img, tx, ty, qx, qy):
    """Возвращает label квадранта для УВЕЛИЧЕННОГО тайла (TILE*SCALE).

    ВАЖНО: нижняя часть тайла закрыта подписью (label_bg ~28px). Поэтому
    для нижних квадрантов (qy=1) выбираем участок СВЕРХУ нижней половины,
    избегая зоны подписи.
    """
    px = img.load()
    big = TILE * SCALE
    half = big // 2
    qsize = 16
    x0 = tx * big + qx * half + (half - qsize) // 2
    if qy == 0:
        y0 = ty * big + (half - qsize) // 2
    else:
        # Нижний квадрант: берём участок СРАЗУ под центром тайла,
        # подальше от подписи (которая в самом низу)
        y0 = ty * big + half + 4  # 4px ниже центра, до подписи много места
    counts = {"W": 0, "L": 0, "?": 0}
    for y in range(y0, y0 + qsize):
        for x in range(x0, x0 + qsize):
            counts[pixel_label(px[x, y])] += 1
    if counts["W"] > counts["L"]:
        return "W"
    return "L"


def main():
    img = Image.open(IMG).convert("RGBA")
    big = TILE * SCALE
    W = img.size[0] // big
    H = img.size[1] // big
    print(f"Image grid {W}×{H} (tile={big}px)")

    # Логика повторяется из test_water_labeled: какой EXPECTED код для каждой клетки.
    cx, cy = (W - 1) / 2, (H - 1) / 2
    BW, BH = W + 1, H + 1
    biome_pt = [[None] * BW for _ in range(BH)]
    for y in range(BH):
        for x in range(BW):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d < 2.5:
                biome_pt[y][x] = "G"
            elif d < 3.5:
                biome_pt[y][x] = "S"
            else:
                biome_pt[y][x] = "W"

    print("\n=== Coast tiles audit (water/sand boundary) ===")
    errors = 0
    for ty in range(H):
        for tx in range(W):
            nw = biome_pt[ty][tx]
            ne = biome_pt[ty][tx + 1]
            sw = biome_pt[ty + 1][tx]
            se = biome_pt[ty + 1][tx + 1]
            corners = [nw, ne, sw, se]
            biomes = set(corners)
            # Только W+S переход
            if biomes != {"W", "S"}:
                continue

            # Ожидаемый код: L где S, W где W
            expected = "".join("L" if c == "S" else "W" for c in corners)
            # Фактический код по пикселям
            f_nw = quadrant_at(img, tx, ty, 0, 0)
            f_ne = quadrant_at(img, tx, ty, 1, 0)
            f_sw = quadrant_at(img, tx, ty, 0, 1)
            f_se = quadrant_at(img, tx, ty, 1, 1)
            actual = f"{f_nw}{f_ne}{f_sw}{f_se}"

            status = "✓" if actual == expected else "✗"
            if actual != expected:
                errors += 1
            print(f"  {status} ({tx:2d},{ty:2d}) expected={expected} actual={actual}")

    print(f"\nTotal coast errors: {errors}")


if __name__ == "__main__":
    main()
