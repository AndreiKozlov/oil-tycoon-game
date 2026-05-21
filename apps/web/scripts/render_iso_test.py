#!/usr/bin/env python3
"""
Тестовый рендер изометрической карты из iso_crops.

Простой: классифицируем каждый ромб по доминирующему цвету (W/S/G/I),
и рисуем шахматную изо-карту с биомами по proceduralMap.

Размер карты: 100×100 ромбов. Изо-проекция: ромб 64×32, шаг по X = 32 (полширины),
шаг по Y = 16 (полвысоты). Итоговая картинка: ~100*32 + 32 = 3232 px ширина,
~100*16 + 32 = 1632 px высота.
"""
import math, random
from pathlib import Path
from PIL import Image
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
IN_DIR = ROOT / "public/tiles/iso_crops"
OUT = ROOT / "public/tiles/iso_earth_test.png"

TILE_W = 64
TILE_H = 32
HALF_W = TILE_W // 2
HALF_H = TILE_H // 2


def pixel_label(rgba):
    r, g, b, a = rgba
    if a < 100: return None
    if b > r + 15 and b > g - 5 and b > 80: return "W"
    if r > 200 and g > 200 and b > 200: return "I"
    if r > 160 and g > 130 and b > 60 and r > b + 30: return "S"
    if g > r and g > b and g > 50: return "G"
    return None


def dominant(tile):
    """Доминирующая категория ромба."""
    px = tile.load()
    cnt = defaultdict(int)
    for y in range(TILE_H):
        for x in range(TILE_W):
            # Только внутри ромба
            if abs(x - HALF_W) / HALF_W + abs(y - HALF_H) / HALF_H > 1: continue
            l = pixel_label(px[x, y])
            if l: cnt[l] += 1
    if not cnt: return None
    return max(cnt, key=cnt.get)


def load_classified():
    """Группируем тайлы по доминирующей категории."""
    by_cat = defaultdict(list)
    for f in sorted(IN_DIR.glob("*.png")):
        img = Image.open(f).convert("RGBA")
        cat = dominant(img)
        if cat:
            by_cat[cat].append((f.name, img))
    print(f"By category: { {k: len(v) for k, v in by_cat.items()} }")
    return by_cat


# === proceduralMap (тот же что раньше) ===
def hash01(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFFFF) / 4294967296.0
def smooth(t): return t*t*(3-2*t)
def vnoise(x, y, scale, seed):
    sx = x/scale; sy = y/scale
    ix = math.floor(sx); iy = math.floor(sy)
    fx = sx - ix; fy = sy - iy
    a = hash01(ix, iy, seed); b = hash01(ix+1, iy, seed)
    c = hash01(ix, iy+1, seed); d = hash01(ix+1, iy+1, seed)
    ux = smooth(fx); uy = smooth(fy)
    return (a + (b-a)*ux) + ((c + (d-c)*ux) - (a + (b-a)*ux)) * uy
def fbm(x, y, scale, octaves, seed):
    v = 0; amp = 1; maxamp = 0; s = scale
    for i in range(octaves):
        v += vnoise(x, y, s, seed + i*1000) * amp
        maxamp += amp; amp *= 0.5; s *= 0.5
    return v / maxamp

def biome_at(x, y, h):
    height = fbm(x, y, 30, 4, 42)
    if height < 0.56: return "W"
    elevation = (height - 0.56) / 0.44
    lat = (y / h) * 2 - 1
    temp = 1 - abs(lat)
    moist = fbm(x, y, 40, 3, 5042)
    if temp < 0.25: return "I"
    if temp > 0.55 and temp < 0.85 and moist < 0.38: return "S"
    return "G"


def main():
    random.seed(7)
    by_cat = load_classified()

    # Карта 80×80 ромбов
    MAP_W, MAP_H = 80, 80
    # Биомы на сетке
    biomes = [[biome_at(x, y, MAP_H) for x in range(MAP_W)] for y in range(MAP_H)]

    # Песчаный пояс
    def neighbors_water(x, y, r=2):
        for dy in range(-r, r+1):
            for dx in range(-r, r+1):
                nx, ny = x+dx, y+dy
                if 0 <= nx < MAP_W and 0 <= ny < MAP_H and biomes[ny][nx] == "W":
                    return True
        return False
    new_b = [row[:] for row in biomes]
    for y in range(MAP_H):
        for x in range(MAP_W):
            if biomes[y][x] == "G" and neighbors_water(x, y, 2):
                new_b[y][x] = "S"
    biomes = new_b

    # Изо-проекция: позиция ромба (gx, gy) в пикселях:
    #   px = (gx - gy) * HALF_W + offset_x
    #   py = (gx + gy) * HALF_H
    # gx, gy ∈ [0, MAP_W) × [0, MAP_H)
    # Размер канваса:
    canvas_w = (MAP_W + MAP_H) * HALF_W
    canvas_h = (MAP_W + MAP_H) * HALF_H + TILE_H
    offset_x = MAP_H * HALF_W  # сдвиг чтобы начать с x=0
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (15, 25, 50, 255))

    # Рисуем тайлы по диагональным линиям gx+gy=const (это правильный painter's order)
    for diag in range(MAP_W + MAP_H - 1):
        for gx in range(max(0, diag - MAP_H + 1), min(MAP_W, diag + 1)):
            gy = diag - gx
            cat = biomes[gy][gx]
            tiles = by_cat.get(cat, [])
            if not tiles:
                continue
            name, tile = random.choice(tiles)
            px = (gx - gy) * HALF_W + offset_x
            py = (gx + gy) * HALF_H
            canvas.alpha_composite(tile, (px, py))

    canvas.save(OUT, optimize=True)
    print(f"✓ {OUT} ({canvas.size})")


if __name__ == "__main__":
    main()
