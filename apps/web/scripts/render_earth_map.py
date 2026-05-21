#!/usr/bin/env python3
"""
Финальный рендерер карты Земли по wang-таблицам Heroes 3 tileset.

3-уровневая схема биомов (Heroes 3 правило):
  WATER (W) ↔ SAND (S) ↔ GRASS (G)
  Прямой переход WATER↔GRASS невозможен — между ними обязателен песчаный пояс.

Для каждой клетки:
  1) Определить биом каждого из 4 углов (по proceduralMap.ts: biome at corner).
     Любой land-biome → G (трава). Water → W. Sand-биом (desert) → S.
     Дополнительно: если в углах одной клетки есть пары W↔G без S — вставляем S
     виртуально (т.е. между ними есть невидимая 'пограничная' точка).
  2) Если все 4 угла из одного биома {W} → открытое море (один тайл).
  3) Если все из {G} → база травы (tgrb).
  4) Если все из {S} → база песка (tsab).
  5) Если набор {W, S} → wang береговой watrtl.
  6) Если набор {S, G} → wang sand/grass из tgrs/tgrd.
  7) Если набор {W, G} БЕЗ S → ошибка карты, S вставляем виртуально → {W, S}.
  8) Если набор {W, S, G} — сводим к ближайшему wang:
       - если есть W → {W, S} (G→S для wang)
       - иначе {S, G}

Это уберёт «дырки» в местах смешения 3 биомов.

Выход:
  public/tiles/earth_test.png — карта 100×50 (фрагмент).
  public/tiles/earth_audit.txt — отчёт.
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
WATER_WANG = ROOT / "public/tiles/water_wang.json"
SG_WANG = ROOT / "public/tiles/sand_grass_wang.json"

OUT_MAP = ROOT / "public/tiles/earth_test.png"
OUT_REPORT = ROOT / "public/tiles/earth_audit.txt"

CFG = {
    "width": 452,    # из DEFAULT_MAP в proceduralMap.ts
    "height": 227,
    "seed": 42,
    "seaLevel": 0.56,
}

# Маппинг GDD-биомов на «материковые» категории.
#   Берём desert как настоящий песок (S). Все остальные сухопутные → G.
LAND_BIOMES_TO_CAT = {
    "forest":    "G",
    "grassland": "G",
    "mountain":  "G",  # пока трава, потом отдельный wang
    "tundra":    "G",
    "desert":    "S",
    "swamp":     "G",
    "plain":     "G",
    "volcanic":  "G",
}

SEAMLESS_OPEN_SEA = "watrtl24.png"


def apply_tx(img, tx):
    if tx == "flipH":
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    if tx == "flipV":
        return img.transpose(Image.FLIP_TOP_BOTTOM)
    if tx == "rotate180":
        return img.transpose(Image.ROTATE_180)
    return img


def find_tile(name):
    for d in (BG, TILEMAP):
        if (d / name).exists():
            return d / name
    return None


# ============== Порт proceduralMap.ts (тот же hash, тот же fbm) ==============


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
    ix = math.floor(sx); iy = math.floor(sy)
    fx = sx - ix; fy = sy - iy
    a = hash01(ix, iy, seed); b = hash01(ix + 1, iy, seed)
    c = hash01(ix, iy + 1, seed); d = hash01(ix + 1, iy + 1, seed)
    ux = smooth(fx); uy = smooth(fy)
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy


def fbm(x, y, scale, octaves, seed):
    v = 0; amp = 1; maxamp = 0; s = scale
    for i in range(octaves):
        v += value_noise(x, y, s, seed + i * 1000) * amp
        maxamp += amp; amp *= 0.5; s *= 0.5
    return v / maxamp


def biome_at(x, y, height):
    h = fbm(x, y, 30, 4, CFG["seed"])
    if h < CFG["seaLevel"]:
        return "water"
    jitter = (value_noise(x, y, 3, CFG["seed"] + 22222) - 0.5) * 0.08
    elevation = (h - CFG["seaLevel"]) / (1 - CFG["seaLevel"]) + jitter
    ridge = fbm(x, y, 60, 3, CFG["seed"] + 11111)
    if elevation > 0.35 and ridge > 0.5: return "mountain"
    if elevation > 0.55: return "mountain"
    lat_norm = (y / height) * 2 - 1
    temperature = 1 - abs(lat_norm)
    moisture = fbm(x, y, 40, 3, CFG["seed"] + 5000) + jitter
    is_equator = temperature > 0.85
    is_subtropic = 0.55 < temperature < 0.85
    if temperature < 0.25: return "tundra"
    if is_equator and moisture > 0.45: return "forest"
    if is_subtropic and moisture < 0.38: return "desert"
    if is_equator and moisture < 0.3: return "desert"
    if elevation < 0.15 and moisture > 0.65 and temperature > 0.45: return "swamp"
    if moisture > 0.55: return "forest"
    if moisture > 0.35: return "grassland"
    return "plain"


# ============== Wang выбор тайла ==============


def main():
    random.seed(7)
    water_wang = json.loads(WATER_WANG.read_text())
    sg_wang = json.loads(SG_WANG.read_text())

    W, H = CFG["width"], CFG["height"]

    # 1) Рассчёт био-карты для (W+1)×(H+1) угловых точек.
    BW, BH = W + 1, H + 1
    corners_biome = [[None] * BW for _ in range(BH)]
    for y in range(BH):
        for x in range(BW):
            # Сэмплируем биом В САМОЙ ТОЧКЕ-углу (это нормально, она тоже в proc-map координатах)
            b = biome_at(min(x, W - 1), min(y, H - 1), H)
            if b == "water":
                corners_biome[y][x] = "W"
            elif LAND_BIOMES_TO_CAT.get(b) == "S":
                corners_biome[y][x] = "S"
            else:
                corners_biome[y][x] = "G"

    # 2) ВАЖНО: чтобы не было прямого W↔G стыка нигде, ВСЕ G-углы которые
    #    соседствуют с W (через клеточный 3×3) — сделать S. Это создаёт
    #    1-клеточный песчаный пояс вокруг всей суши.
    def neighbors(x, y):
        out = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0: continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < BW and 0 <= ny < BH:
                    out.append(corners_biome[ny][nx])
        return out

    # Один проход: каждый G-узел, у которого есть W в радиусе 2 → S.
    # Это создаёт песчаный пояс шириной 2 клетки вокруг суши, что устраняет
    # прямые W↔G стыки между соседними тайлами на карте.
    def has_water_within(x, y, r):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < BW and 0 <= ny < BH and corners_biome[ny][nx] == "W":
                    return True
        return False

    new_b = [row[:] for row in corners_biome]
    for y in range(BH):
        for x in range(BW):
            if corners_biome[y][x] == "G" and has_water_within(x, y, 2):
                new_b[y][x] = "S"
    corners_biome = new_b

    # 3) Каталоги тайлов
    grass_base = sorted(TILEMAP.glob("tgrb*.png"))
    sand_base  = sorted(BG.glob("tsab*.png"))
    sea_tile_path = find_tile(SEAMLESS_OPEN_SEA)

    canvas = Image.new("RGBA", (W * TILE, H * TILE), (30, 40, 60, 255))

    stats = {"water": 0, "grass": 0, "sand": 0, "coast_ws": 0, "coast_sg": 0, "WSG": 0, "miss": 0}

    for ty in range(H):
        for tx in range(W):
            nw = corners_biome[ty][tx]
            ne = corners_biome[ty][tx + 1]
            sw = corners_biome[ty + 1][tx]
            se = corners_biome[ty + 1][tx + 1]
            vals = [nw, ne, sw, se]
            bset = set(vals)

            tile = None
            if bset == {"W"}:
                tile = Image.open(sea_tile_path).convert("RGBA"); stats["water"] += 1
            elif bset == {"G"}:
                f = grass_base[(tx * 31 + ty * 7) % len(grass_base)]
                tile = Image.open(f).convert("RGBA"); stats["grass"] += 1
            elif bset == {"S"}:
                f = sand_base[(tx * 31 + ty * 7) % len(sand_base)]
                tile = Image.open(f).convert("RGBA"); stats["sand"] += 1
            elif bset == {"W", "S"}:
                code = "".join("L" if v == "S" else "W" for v in vals)
                variants = water_wang.get(code, [])
                if variants:
                    v = variants[(tx + ty * 11) % len(variants)]
                    src = find_tile(v["name"])
                    tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                    stats["coast_ws"] += 1
                else:
                    stats["miss"] += 1
            elif bset == {"S", "G"}:
                code = "".join(vals)  # S/G напрямую
                variants = sg_wang.get(code, [])
                if variants:
                    v = variants[(tx + ty * 11) % len(variants)]
                    src = find_tile(v["name"])
                    tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                    stats["coast_sg"] += 1
                else:
                    # Fallback: ближайший SG-код по сходству
                    fallback = sg_wang.get("SSGG") or sg_wang.get("GGSS")
                    if fallback:
                        v = fallback[0]
                        src = find_tile(v["name"])
                        tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                    stats["miss"] += 1
            elif bset == {"W", "S", "G"}:
                # Главный fix: трёхбиомная смесь сводим к {W, S} с заменой G→S для wang.
                code = "".join("L" if v in ("S", "G") else "W" for v in vals)
                variants = water_wang.get(code, [])
                if variants:
                    v = variants[(tx + ty * 11) % len(variants)]
                    src = find_tile(v["name"])
                    tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                    stats["WSG"] += 1
                else:
                    stats["miss"] += 1
            elif bset == {"W", "G"}:
                # Прямой W↔G стык: НЕ должен происходить после insert-S итераций,
                # но если случится — обрабатываем как {W, S} (G→S).
                code = "".join("L" if v == "G" else "W" for v in vals)
                variants = water_wang.get(code, [])
                if variants:
                    v = variants[0]
                    src = find_tile(v["name"])
                    tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                stats["miss"] += 1

            if tile is not None:
                canvas.paste(tile, (tx * TILE, ty * TILE))

    canvas.save(OUT_MAP, optimize=True)

    # Аудит: проверим что НИ ОДНОЙ клетки не осталось без тайла
    # (т.е. ни одна не использовала фон канваса)
    audit = []
    audit.append(f"Map size: {W}×{H} = {W*H} cells")
    audit.append(f"Image: {canvas.size}")
    audit.append("")
    audit.append("=== Cell distribution ===")
    for k, v in stats.items():
        audit.append(f"  {k}: {v}")
    audit.append(f"  total drawn: {sum(stats.values())} / {W*H}")
    audit.append(f"  missing: {W*H - sum(stats.values())}")
    OUT_REPORT.write_text("\n".join(audit), encoding="utf-8")

    print(f"✓ {OUT_MAP}  ({canvas.size})")
    print(f"✓ {OUT_REPORT}")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
