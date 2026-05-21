#!/usr/bin/env python3
"""
Финальный тест: генерация карты grass+dirt по 4-corner wang таблице.

Алгоритм:
  Карта 16×16 биомов. Биом каждой клетки: grass или dirt.
  Для каждой клетки вычисляем 4-битную маску углов:
    NW-corner — общий угол с тайлами (x-1,y-1), (x,y-1), (x-1,y), (x,y)
    Уголок угла = 'grass' если ХОТЯ БЫ ОДИН из 4 соседних центров — grass.
  Берём случайный тайл из grass_corners_map.json[mask].

  Это даёт правильную стыковку: каждая сторона тайла A совпадает с противоположной
  стороной соседнего тайла B, потому что оба используют общую границу-угол.
"""
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
CORNERS_JSON = ROOT / "public/tiles/grass_corners_map.json"
OUT = ROOT / "public/tiles/atlas_wang_test.png"


def find_tile(name):
    for d in (BG, TILEMAP):
        if (d / name).exists():
            return d / name
    return None


def main():
    random.seed(7)
    corners = json.loads(CORNERS_JSON.read_text())
    # Преобразуем строковые ключи в int
    corners = {int(k): v for k, v in corners.items()}

    # Карта: круг травы внутри океана грязи (15×15)
    W, H = 15, 15
    cx, cy = (W - 1) / 2, (H - 1) / 2
    is_grass = [[((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 < 5 for x in range(W)] for y in range(H)]

    # Для тайла (x,y) угол — между 4 центрами клеток. Если хотя бы ОДИН из 4 центров,
    # участвующих в этом углу, является нужным биомом — этот угол считаем своим.
    # Угловой бит для тайла (tx,ty):
    #   NW (bit 0): max(is_grass at (tx-1,ty-1), (tx,ty-1), (tx-1,ty), (tx,ty))
    # Но это для версии "tile=cell". У нас тайлы кладутся в клетки 1:1, поэтому проще:
    # центр клетки определяет биом, а маска углов = биомы 4 СОСЕДНИХ клеток-углов.
    # Используем правило: угол клетки (x,y) у уголка NW = биом самой клетки + 3 диагональных.
    #
    # Самый предсказуемый вариант: тайл (x,y) с маской углов:
    #   NW(bit0) = is_grass[y][x]   ← это сам центр клетки
    #   NE(bit1) = is_grass[y][x+1] если есть, иначе own
    #   SW(bit2) = is_grass[y+1][x]
    #   SE(bit3) = is_grass[y+1][x+1]
    # То есть тайл в позиции (x,y) описывает квадратный СТЫК между 4 клетками биом-карты.
    # Тогда биом-карта должна быть (W+1)×(H+1).

    # Перестрою: биом-карта (W+1)×(H+1) клеток-углов; тайл рисуется в стыке между ними.
    # Граф 4 углов = индексы биом-карты [y][x], [y][x+1], [y+1][x], [y+1][x+1].
    BW, BH = W + 1, H + 1
    cx2, cy2 = (BW - 1) / 2, (BH - 1) / 2
    grass_grid = [[((x - cx2) ** 2 + (y - cy2) ** 2) ** 0.5 < 5.5 for x in range(BW)] for y in range(BH)]

    canvas = Image.new("RGBA", (W * TILE, H * TILE), (90, 60, 40, 255))

    miss = 0
    for ty in range(H):
        for tx in range(W):
            nw = 1 if grass_grid[ty][tx] else 0
            ne = 2 if grass_grid[ty][tx + 1] else 0
            sw = 4 if grass_grid[ty + 1][tx] else 0
            se = 8 if grass_grid[ty + 1][tx + 1] else 0
            mask = nw | ne | sw | se

            candidates = corners.get(mask, [])
            if not candidates:
                # fallback: маска 9 пуста → берём ближайшую (3 или 12)
                for fb in (15 if mask == 9 else 0, 0, 15):
                    if corners.get(fb):
                        candidates = corners[fb]
                        break
                miss += 1
            name = random.choice(candidates)
            path = find_tile(name)
            if path is None:
                continue
            tile = Image.open(path).convert("RGBA")
            canvas.paste(tile, (tx * TILE, ty * TILE))

    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})  unmatched masks: {miss}")


if __name__ == "__main__":
    main()
