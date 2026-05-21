#!/usr/bin/env python3
"""
Тест wang-таблицы воды: остров суши в океане.

Алгоритм:
  - Карта 16×16, в центре круг суши, остальное вода.
  - Каждая клетка ВОДЫ получает wang-код по 4 углам:
      для каждого угла: смотрим 4 соседних центра клеток,
      угол = 'L' если ХОТЯ БЫ ОДИН из 4 = суша, иначе 'W'.
  - Берём тайл из water_wang.json[code], применяем transform.
  - Клетки суши — рисуем base grass-тайлом (tgrb000 из tilemap).
"""
import json
import random
from pathlib import Path
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
WANG = ROOT / "public/tiles/water_wang.json"
OUT = ROOT / "public/tiles/water_island_test.png"


def apply_tx(img, tx):
    if tx == "flipH":
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    if tx == "flipV":
        return img.transpose(Image.FLIP_TOP_BOTTOM)
    if tx == "rotate180":
        return img.transpose(Image.ROTATE_180)
    return img


def main():
    random.seed(11)
    wang = json.loads(WANG.read_text())

    W, H = 20, 14
    cx, cy = (W - 1) / 2, (H - 1) / 2
    # Карта биом-точек (W+1)×(H+1) — каждая точка = угол клетки.
    BW, BH = W + 1, H + 1
    is_land = [[((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < 4.5 for x in range(BW)] for y in range(BH)]

    canvas = Image.new("RGBA", (W * TILE, H * TILE), (40, 80, 110, 255))

    # Grass-тайл для суши
    grass_tiles = sorted((TILEMAP).glob("tgrb*.png"))
    grass_img = Image.open(grass_tiles[0]).convert("RGBA") if grass_tiles else None

    # Открытое море = ОДИН тайл всегда (watrtl24 — лучший self-stitch 50%/31%).
    # Остальные WWWW-варианты НЕ используем — у них кромки не совпадают между собой.
    SEAMLESS_OPEN_SEA = "watrtl24.png"
    wwww_variants = [{"name": SEAMLESS_OPEN_SEA, "transform": "none"}]

    miss = 0
    for ty in range(H):
        for tx in range(W):
            # Клетка-биом: суша или вода — определяется ЦЕНТРОМ клетки (т.е. is_land[ty][tx]).
            # Wang-код вычисляется по 4 углам: NW=(tx,ty), NE=(tx+1,ty), SW=(tx,ty+1), SE=(tx+1,ty+1).
            nw = "L" if is_land[ty][tx] else "W"
            ne = "L" if is_land[ty][tx + 1] else "W"
            sw = "L" if is_land[ty + 1][tx] else "W"
            se = "L" if is_land[ty + 1][tx + 1] else "W"
            code = f"{nw}{ne}{sw}{se}"

            if code == "LLLL":
                # Полностью суша — рисуем grass
                if grass_img:
                    canvas.paste(grass_img, (tx * TILE, ty * TILE))
                continue

            # Открытое море WWWW = всегда seamless-тайл, без рандома.
            if code == "WWWW":
                variants = wwww_variants
            else:
                variants = wang.get(code, [])
                if not variants:
                    # Диагонали WLLW/LWWL — fallback на seamless WWWW.
                    variants = wwww_variants
                    miss += 1

            v = random.choice(variants)
            src = BG / v["name"]
            if not src.exists():
                continue
            img = Image.open(src).convert("RGBA")
            img = apply_tx(img, v["transform"])
            canvas.paste(img, (tx * TILE, ty * TILE))

    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})  unmatched(diag fallback): {miss}")


if __name__ == "__main__":
    main()
