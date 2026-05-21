#!/usr/bin/env python3
"""
render_global_map_v2.py — нормальный изометрический рендер карты Земли.

Что починено по сравнению с v1:
  • Тайлы — chunky. Sprite в 1.8× больше grid cell → реальный overdraw 80%.
  • Логических ромбов меньше: семплируем biome_map step=2 (96×48 ромбов
    вместо 192×96). Каждый тайл крупный и хорошо виден.
  • Elevation per biome: вертикальный сдвиг тайла зависит от биома (горы
    выше, океан ниже). Карта перестаёт быть плоской.
  • Biome blending через value-noise: на границе биомов выбор «куда отнести
    спорный пиксель» зависит от шума, края становятся рваными.
  • Snow caps: на dirt-пиксели (горы) где noise > threshold накладываем
    snow-тайл сверху как «снежная шапка».
  • Decor pass: на grass иногда ставим dirt-валун или второй grass-вариант,
    чтобы поверхность не была плоской однородной.
  • Ocean underlay двойной: сплошная заливка цветом deep + полный pass
    deep_water тайлов под всей картой. Снизу никогда не видно фон.

Painter order:
  1) ocean fill
  2) deep_water tile pass (по всей сетке)
  3) shallow_water (только в прибрежной зоне)
  4) land (grass / sand / dirt / snow) с elevation
  5) snow caps over dirt
  6) decor over grass
"""
from pathlib import Path
from PIL import Image
import json, hashlib, argparse, random, math

ROOT = Path(__file__).resolve().parent.parent
TILES_DIR = ROOT / "public/tiles/iso_18"
MANIFEST = ROOT / "public/tiles/iso_18.json"
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
DEFAULT_OUT = ROOT / "public/tiles/global_earth_map_v2.png"

COLOR_TO_BIOME = {
    (35,  90, 170): "deep_water",
    (110, 190, 220): "shallow_water",
    (80, 165,  75): "grass",
    (235, 205, 105): "sand",
    (140,  95,  55): "dirt",
    (240, 245, 250): "snow",
}

# elevation в долях cell-height (отрицательное = выше на экране)
ELEVATION = {
    "deep_water":    +6,   # ниже всех
    "shallow_water": +3,
    "grass":         -2,
    "sand":          -1,
    "dirt":         -16,   # горы заметно выше
    "snow":          -8,
}


def stable_hash(*args) -> int:
    h = hashlib.md5(",".join(str(a) for a in args).encode()).digest()
    return int.from_bytes(h[:4], "little")


def nearest_biome(rgb):
    best, bd = None, 10**9
    for c, b in COLOR_TO_BIOME.items():
        d = (c[0]-rgb[0])**2 + (c[1]-rgb[1])**2 + (c[2]-rgb[2])**2
        if d < bd:
            bd, best = d, b
    return best


# Простой value-noise через хешированную сетку + бикубическая интерполяция.
def value_noise(W, H, seed=1337, octaves=4, scale=12.0):
    rnd = random.Random(seed)
    grid_size = max(W, H) // 2
    grid = [[rnd.random() for _ in range(grid_size + 2)] for _ in range(grid_size + 2)]
    out = [[0.0] * W for _ in range(H)]
    for o in range(octaves):
        freq = scale * (2 ** o)
        amp = 1.0 / (2 ** o)
        for y in range(H):
            for x in range(W):
                gx = (x / W) * freq
                gy = (y / H) * freq
                xi, yi = int(gx) % grid_size, int(gy) % grid_size
                xf, yf = gx - int(gx), gy - int(gy)
                # smoothstep
                u = xf * xf * (3 - 2 * xf)
                v = yf * yf * (3 - 2 * yf)
                a = grid[yi][xi]
                b = grid[yi][xi + 1]
                c = grid[yi + 1][xi]
                d = grid[yi + 1][xi + 1]
                val = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
                out[y][x] += val * amp
    # нормализация в [0,1]
    mn = min(min(row) for row in out)
    mx = max(max(row) for row in out)
    rng = (mx - mn) or 1
    return [[(v - mn) / rng for v in row] for row in out]


def variants_by_biome(manifest):
    out = {}
    for t in manifest["tiles"]:
        out.setdefault(t["biome"], []).append(t["name"])
    if "ice_water" in out:
        out["shallow_water"] = out.get("shallow_water", []) + out["ice_water"]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cw", type=int, default=44, help="iso cell width (logical)")
    ap.add_argument("--ch", type=int, default=22, help="iso cell height (logical)")
    ap.add_argument("--overdraw", type=float, default=1.9,
                    help="tile sprite size vs cell (1.0=no overdraw, 2.0=double)")
    ap.add_argument("--step", type=int, default=2,
                    help="biome_map sampling step (2 = half resolution)")
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT))
    args = ap.parse_args()

    CW, CH = args.cw, args.ch
    STEP = args.step
    manifest = json.load(open(MANIFEST))

    biome_img = Image.open(BIOME_MAP).convert("RGB")
    BW, BH = biome_img.size
    bp = biome_img.load()

    # Логическая сетка ромбов (LW x LH)
    LW = BW // STEP
    LH = BH // STEP

    # Tile sprite size (с overdraw)
    tile_w = int(round(CW * args.overdraw))
    tile_h = int(round(CH * args.overdraw * 1.05))  # ромбы чуть высокие

    variants = variants_by_biome(manifest)
    print("biome variants:", {k: len(v) for k, v in variants.items()})

    # Кэш тайлов
    cache = {}
    for t in manifest["tiles"]:
        img = Image.open(TILES_DIR / f"{t['name']}.png").convert("RGBA")
        cache[t["name"]] = img.resize((tile_w, tile_h), Image.LANCZOS)
    # уменьшенные «снежные шапки» — snow-тайл 60% размера
    snow_cap = cache["snow"].resize((int(tile_w * 0.65), int(tile_h * 0.55)), Image.LANCZOS)

    # Value-noise: глобальные карты вариации
    print("generating noise ...")
    n_edge   = value_noise(LW, LH, seed=11, octaves=3, scale=18.0)  # blending границ
    n_height = value_noise(LW, LH, seed=22, octaves=4, scale=10.0)  # высоты гор
    n_decor  = value_noise(LW, LH, seed=33, octaves=2, scale=24.0)  # декор

    # ----- читаем биомы из biome_map с шумовым смещением -----
    grid = []
    for ly in range(LH):
        row = []
        for lx in range(LW):
            # семплируем biome_map в окне step×step и берём пиксель,
            # смещённый в сторону noise (рваный край биомов)
            ne = n_edge[ly][lx]
            sx = int(lx * STEP + (ne - 0.5) * STEP * 1.6)
            sy = int(ly * STEP + (ne - 0.5) * STEP * 1.6)
            sx = max(0, min(BW - 1, sx))
            sy = max(0, min(BH - 1, sy))
            b = nearest_biome(bp[sx, sy])
            row.append(b)
        grid.append(row)

    # ----- canvas -----
    canvas_w = (LW + LH) * CW // 2 + tile_w * 2
    canvas_h = (LW + LH) * CH // 2 + tile_h * 2
    print(f"canvas {canvas_w}×{canvas_h}, logical {LW}×{LH}, cell {CW}×{CH}, tile {tile_w}×{tile_h}, overdraw {args.overdraw:.2f}×")

    # baseline: deep-ocean fill
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (24, 56, 110, 255))

    off_x = (LH - 1) * CW // 2 + tile_w // 2
    off_y = tile_h

    def place(tile, lx, ly, dy=0):
        sx = (lx - ly) * CW // 2 + off_x
        sy = (lx + ly) * CH // 2 + off_y + dy
        canvas.alpha_composite(tile, (sx - tile.width // 2, sy - tile.height))

    # ===== PASS 1: deep_water underlay по всей сетке =====
    print("pass 1: ocean underlay")
    dwv = variants["deep_water"]
    for ly in range(LH):
        for lx in range(LW):
            t = cache[dwv[stable_hash(lx, ly, 1) % len(dwv)]]
            place(t, lx, ly, dy=ELEVATION["deep_water"])

    # ===== PASS 2: shallow_water (там где маска говорит shallow) =====
    print("pass 2: shallow water")
    swv = variants["shallow_water"]
    for ly in range(LH):
        for lx in range(LW):
            if grid[ly][lx] != "shallow_water":
                continue
            t = cache[swv[stable_hash(lx, ly, 2) % len(swv)]]
            place(t, lx, ly, dy=ELEVATION["shallow_water"])

    # ===== PASS 3: land tiles, painter order (по y, потом x) =====
    print("pass 3: land")
    for ly in range(LH):
        for lx in range(LW):
            b = grid[ly][lx]
            if b in ("deep_water", "shallow_water"):
                continue
            vs = variants.get(b) or variants["grass"]
            t = cache[vs[stable_hash(lx, ly, 3) % len(vs)]]
            dy = ELEVATION[b]
            # для гор добавляем шум высоты: до -10px дополнительно
            if b == "dirt":
                dy += int((n_height[ly][lx] - 0.5) * 14)
            place(t, lx, ly, dy=dy)

    # ===== PASS 4: snow caps over dirt (горные пики) =====
    print("pass 4: snow caps")
    for ly in range(LH):
        for lx in range(LW):
            if grid[ly][lx] != "dirt":
                continue
            if n_height[ly][lx] < 0.62:
                continue
            sx = (lx - ly) * CW // 2 + off_x
            sy = (lx + ly) * CH // 2 + off_y + ELEVATION["dirt"] - 10
            canvas.alpha_composite(
                snow_cap,
                (sx - snow_cap.width // 2, sy - snow_cap.height),
            )

    # ===== PASS 5: decor over grass — лёгкие dirt-валуны =====
    print("pass 5: decor")
    dirt_small = cache["dirt_1"].resize((int(tile_w * 0.55), int(tile_h * 0.5)), Image.LANCZOS)
    for ly in range(LH):
        for lx in range(LW):
            if grid[ly][lx] != "grass":
                continue
            if n_decor[ly][lx] < 0.78:
                continue
            # 50% шанс на «горный отрог» только в этом высокошумном пятне
            if (stable_hash(lx, ly, 5) & 1) == 0:
                continue
            sx = (lx - ly) * CW // 2 + off_x
            sy = (lx + ly) * CH // 2 + off_y + ELEVATION["grass"] - 6
            canvas.alpha_composite(
                dirt_small,
                (sx - dirt_small.width // 2, sy - dirt_small.height),
            )

    out_path = Path(args.out)
    canvas.save(out_path)
    print(f"✓ {out_path} ({canvas.size})")


if __name__ == "__main__":
    main()
