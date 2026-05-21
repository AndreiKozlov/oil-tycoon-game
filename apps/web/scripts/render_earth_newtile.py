#!/usr/bin/env python3
"""
Финальный рендер карты Земли с newtile-тайлами.

Биомы:
  water → W
  grassland/forest/swamp/plain → G (трава)
  desert → S (песок)
  tundra/snow → I (лёд)
  mountain → G (пока — нет отдельных горных тайлов в этом наборе)

Логика как в render_earth_map.py, но с newtile_wang.json и без отдельной
sand_grass таблицы (тут всё в одном).
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILES_DIR = ROOT / "public/tiles/newtile_crops"
WANG_JSON = ROOT / "public/tiles/newtile_wang.json"
OUT_MAP = ROOT / "public/tiles/earth_newtile.png"
OUT_PREVIEW = ROOT / "public/tiles/earth_newtile_preview.png"

TILE = 32
CFG = {"width": 452, "height": 227, "seed": 42, "seaLevel": 0.56}

BIOME_TO_CAT = {
    "water":     "W",
    "forest":    "G",
    "grassland": "G",
    "mountain":  "G",
    "tundra":    "I",
    "desert":    "S",
    "swamp":     "G",
    "plain":     "G",
    "volcanic":  "G",
}


def apply_tx(img, tx):
    if tx == "flipH": return img.transpose(Image.FLIP_LEFT_RIGHT)
    if tx == "flipV": return img.transpose(Image.FLIP_TOP_BOTTOM)
    if tx == "rotate180": return img.transpose(Image.ROTATE_180)
    return img


# === Порт proceduralMap.ts ===
def hash01(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFFFF) / 4294967296.0


def smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(x, y, scale, seed):
    sx = x / scale; sy = y / scale
    ix = math.floor(sx); iy = math.floor(sy)
    fx = sx - ix; fy = sy - iy
    a = hash01(ix, iy, seed); b = hash01(ix + 1, iy, seed)
    c = hash01(ix, iy + 1, seed); d = hash01(ix + 1, iy + 1, seed)
    ux = smooth(fx); uy = smooth(fy)
    ab = a + (b - a) * ux
    cd = c + (d - c) * ux
    return ab + (cd - ab) * uy


def fbm(x, y, scale, octaves, seed):
    v = 0; amp = 1; maxamp = 0; s = scale
    for i in range(octaves):
        v += value_noise(x, y, s, seed + i * 1000) * amp
        maxamp += amp; amp *= 0.5; s *= 0.5
    return v / maxamp


def biome_at(x, y, height):
    h = fbm(x, y, 30, 4, CFG["seed"])
    if h < CFG["seaLevel"]: return "water"
    jitter = (value_noise(x, y, 3, CFG["seed"] + 22222) - 0.5) * 0.08
    elevation = (h - CFG["seaLevel"]) / (1 - CFG["seaLevel"]) + jitter
    ridge = fbm(x, y, 60, 3, CFG["seed"] + 11111)
    if elevation > 0.35 and ridge > 0.5: return "mountain"
    if elevation > 0.55: return "mountain"
    lat = (y / height) * 2 - 1
    temp = 1 - abs(lat)
    moist = fbm(x, y, 40, 3, CFG["seed"] + 5000) + jitter
    is_eq = temp > 0.85
    is_subt = 0.55 < temp < 0.85
    if temp < 0.25: return "tundra"
    if is_eq and moist > 0.45: return "forest"
    if is_subt and moist < 0.38: return "desert"
    if is_eq and moist < 0.3: return "desert"
    if elevation < 0.15 and moist > 0.65 and temp > 0.45: return "swamp"
    if moist > 0.55: return "forest"
    if moist > 0.35: return "grassland"
    return "plain"


def main():
    random.seed(7)
    wang = json.loads(WANG_JSON.read_text())
    W, H = CFG["width"], CFG["height"]

    BW, BH = W + 1, H + 1
    corners = [[None] * BW for _ in range(BH)]
    for y in range(BH):
        for x in range(BW):
            b = biome_at(min(x, W - 1), min(y, H - 1), H)
            corners[y][x] = BIOME_TO_CAT.get(b, "G")

    # Песчаный пояс: каждый G-узел с W в радиусе 2 → S.
    def has_water(x, y, r):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < BW and 0 <= ny < BH and corners[ny][nx] == "W":
                    return True
        return False

    new_c = [row[:] for row in corners]
    for y in range(BH):
        for x in range(BW):
            if corners[y][x] == "G" and has_water(x, y, 2):
                new_c[y][x] = "S"
    corners = new_c

    # Cache tile images
    tile_cache = {}
    def get_tile(name, tx):
        key = (name, tx)
        if key in tile_cache:
            return tile_cache[key]
        img = Image.open(TILES_DIR / name).convert("RGBA")
        img = apply_tx(img, tx)
        tile_cache[key] = img
        return img

    # Fallback приоритеты для каждой категории
    pure_fallback = {"W": "WWWW", "G": "GGGG", "S": "SSSS", "I": "IIII"}

    canvas = Image.new("RGBA", (W * TILE, H * TILE), (30, 40, 60, 255))
    stats = {"exact": 0, "fallback": 0, "miss": 0}

    for ty in range(H):
        for tx in range(W):
            nw = corners[ty][tx]
            ne = corners[ty][tx + 1]
            sw = corners[ty + 1][tx]
            se = corners[ty + 1][tx + 1]
            code = f"{nw}{ne}{sw}{se}"

            variants = wang.get(code)
            if variants:
                stats["exact"] += 1
            else:
                # Fallback: пытаемся найти ближайший код
                # 1) Большинство углов одного биома → берём чистый
                bset = [nw, ne, sw, se]
                most_common = max(set(bset), key=bset.count)
                fb_code = pure_fallback.get(most_common, "GGGG")
                variants = wang.get(fb_code)
                stats["fallback"] += 1
                if not variants:
                    stats["miss"] += 1
                    continue

            v = variants[(tx * 31 + ty * 17) % len(variants)]
            img = get_tile(v["name"], v["transform"])
            canvas.paste(img, (tx * TILE, ty * TILE))

    canvas.save(OUT_MAP, optimize=True)
    print(f"✓ {OUT_MAP}  ({canvas.size})")
    print(f"  exact wang match: {stats['exact']}")
    print(f"  fallback used:    {stats['fallback']}")
    print(f"  missing:          {stats['miss']}")

    # Preview 8× downscale
    prev = canvas.resize((W * TILE // 8, H * TILE // 8), Image.NEAREST)
    prev.save(OUT_PREVIEW, optimize=True)
    print(f"✓ {OUT_PREVIEW} ({prev.size})")


if __name__ == "__main__":
    main()
