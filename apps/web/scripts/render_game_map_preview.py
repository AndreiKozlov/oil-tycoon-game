#!/usr/bin/env python3
"""
Серверный preview карты — повторяет ту же логику, что и игровой рендер.

  1. Грузит wang_table.json и atlas.png
  2. Реализует тот же fbm-генератор биомов что в proceduralMap.ts (seed=42)
  3. Для каждой клетки 452×227: вычисляет hbiome, маску 4 углов, выбирает тайл
  4. Сохраняет полную карту PNG, чтобы оценить стыковку.
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
ATLAS_PNG = ROOT / "public/tiles/atlas.png"
ATLAS_JSON = ROOT / "public/tiles/atlas.json"
OUT = ROOT / "public/tiles/preview_world.png"

CFG = {
    "width": 100,         # уменьшенная превью, не вся карта 452x227
    "height": 50,
    "seed": 42,
    "seaLevel": 0.56,
}

BIOME_TO_HBIOME = {
    "forest": "swamp",
    "grassland": "grass",
    "mountain": "rough",
    "tundra": "snow",
    "desert": "sand",
    "swamp": "swamp",
    "plain": "dirt",
    "volcanic": "volc",
    "water": None,
}

# --- порт fbm / hash из proceduralMap.ts ---


def hash01(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFFFF) / 4294967296.0


def smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(x, y, scale, seed):
    sx = x / scale
    sy = y / scale
    ix = math.floor(sx)
    iy = math.floor(sy)
    fx = sx - ix
    fy = sy - iy
    a = hash01(ix, iy, seed)
    b = hash01(ix + 1, iy, seed)
    c = hash01(ix, iy + 1, seed)
    d = hash01(ix + 1, iy + 1, seed)
    ux = smooth(fx)
    uy = smooth(fy)
    ab = a + (b - a) * ux
    cd = c + (d - c) * ux
    return ab + (cd - ab) * uy


def fbm(x, y, scale, octaves, seed):
    v = 0
    amp = 1
    maxamp = 0
    s = scale
    for i in range(octaves):
        v += value_noise(x, y, s, seed + i * 1000) * amp
        maxamp += amp
        amp *= 0.5
        s *= 0.5
    return v / maxamp


def biome_at(x, y):
    h = fbm(x, y, 30, 4, CFG["seed"])
    if h < CFG["seaLevel"]:
        return "water"
    jitter = (value_noise(x, y, 3, CFG["seed"] + 22222) - 0.5) * 0.08
    elevation = (h - CFG["seaLevel"]) / (1 - CFG["seaLevel"]) + jitter
    ridge = fbm(x, y, 60, 3, CFG["seed"] + 11111)
    if elevation > 0.35 and ridge > 0.5:
        return "mountain"
    if elevation > 0.55:
        return "mountain"
    lat_norm = (y / CFG["height"]) * 2 - 1
    temperature = 1 - abs(lat_norm)
    moisture = fbm(x, y, 40, 3, CFG["seed"] + 5000) + jitter
    is_equator = temperature > 0.85
    is_subtropic = 0.55 < temperature < 0.85
    if temperature < 0.25:
        return "tundra"
    if is_equator and moisture > 0.45:
        return "forest"
    if is_subtropic and moisture < 0.38:
        return "desert"
    if is_equator and moisture < 0.3:
        return "desert"
    if elevation < 0.15 and moisture > 0.65 and temperature > 0.45:
        return "swamp"
    if moisture > 0.55:
        return "forest"
    if moisture > 0.35:
        return "grassland"
    return "plain"


def compute_corner_mask(cx, cy, own_hb, sample):
    def same(x, y):
        return sample(x, y) == own_hb
    m = 0
    if same(cx - 1, cy - 1) or same(cx, cy - 1) or same(cx - 1, cy) or same(cx, cy):
        m |= 1
    if same(cx, cy - 1) or same(cx + 1, cy - 1) or same(cx, cy) or same(cx + 1, cy):
        m |= 2
    if same(cx - 1, cy) or same(cx, cy) or same(cx - 1, cy + 1) or same(cx, cy + 1):
        m |= 4
    if same(cx, cy) or same(cx + 1, cy) or same(cx, cy + 1) or same(cx + 1, cy + 1):
        m |= 8
    return m


def main():
    meta = json.loads(ATLAS_JSON.read_text())
    atlas = Image.open(ATLAS_PNG).convert("RGBA")
    cols = meta["atlas"]["cols"]

    W, H = CFG["width"], CFG["height"]
    # Pre-compute biome map
    bm = [[biome_at(x, y) for x in range(W)] for y in range(H)]

    def sample_hb(x, y):
        if 0 <= x < W and 0 <= y < H:
            return BIOME_TO_HBIOME.get(bm[y][x])
        return None

    canvas = Image.new("RGBA", (W * TILE, H * TILE), (50, 80, 110, 255))

    fallback_order = [None, 15, 0, 3, 12, 5, 10, 7, 11, 13, 14]

    for y in range(H):
        for x in range(W):
            b = bm[y][x]
            hb = BIOME_TO_HBIOME.get(b)
            if hb is None:
                # вода — рисуем плоским цветом для превью
                from PIL import ImageDraw
                ImageDraw.Draw(canvas).rectangle(
                    [x * TILE, y * TILE, (x + 1) * TILE - 1, (y + 1) * TILE - 1],
                    fill=(50, 80, 110, 255),
                )
                continue
            mask = compute_corner_mask(x, y, hb, sample_hb)
            table = meta["wang"][hb]
            # fallback chain как в TS
            chain = [mask] + [fb for fb in fallback_order if fb is not None]
            tile_idx = None
            for m in chain:
                cand = table.get(str(m))
                if cand:
                    tile_idx = cand[(x * 374761393 + y * 668265263 + m * 1274126177) & 0xFFFFFFFF % len(cand) if cand else 0]
                    # фикс: hash mod len
                    h = ((x * 374761393 + y * 668265263 + m * 1274126177) & 0xFFFFFFFF)
                    tile_idx = cand[h % len(cand)]
                    break
            if tile_idx is None:
                continue
            sx = (tile_idx % cols) * TILE
            sy = (tile_idx // cols) * TILE
            tile = atlas.crop((sx, sy, sx + TILE, sy + TILE))
            canvas.paste(tile, (x * TILE, y * TILE))

    canvas.save(OUT, optimize=True)
    print(f"✓ {OUT}  ({canvas.size})")


if __name__ == "__main__":
    main()
