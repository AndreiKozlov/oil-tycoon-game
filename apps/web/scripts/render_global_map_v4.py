#!/usr/bin/env python3
"""
render_global_map_v4.py — chunky big-tile world map.

Главное отличие от v3:
  • Логическая сетка 32×16 (а не 96×48). Один тайл ≈ 1250 км — крупный
    «чанк» мира, а не пиксель GIS-карты.
  • Cell 128×64, tile sprite ~230×140 (overdraw 1.8). Видно ромб, объём,
    тени, стиль каждого тайла.
  • Downsample biome_map 192×96 → 32×16 через окно 6×6 с голосованием
    биомов: каждый чанк = доминирующий биом окна.
  • Scale-jitter ±8% per tile (без поворота — иначе ромбы перестанут стыковаться).
  • Горы рисуются стеком 2-3 тайлов друг над другом (объёмные хребты).
  • Береговая зона: один-два клеточных кольца shallow_water вокруг суши.
  • Snow caps крупнее и поверх стека гор.
  • Decor: на grass с шансом ~12% ставим дополнительный grass-вариант
    выше — даёт кусты/холмики.
  • Овальная маска и crop как в v3.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json, hashlib, argparse, random
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
TILES_DIR = ROOT / "public/tiles/iso_18"
MANIFEST = ROOT / "public/tiles/iso_18.json"
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
DEFAULT_OUT = ROOT / "public/tiles/global_earth_map_v4.png"

COLOR_TO_BIOME = {
    (35,  90, 170): "deep_water",
    (110, 190, 220): "shallow_water",
    (80, 165,  75): "grass",
    (235, 205, 105): "sand",
    (140,  95,  55): "dirt",
    (240, 245, 250): "snow",
}

# Elevation в пикселях (отрицательное = выше на экране)
ELEVATION = {
    "deep_water":    +10,
    "shallow_water":  +4,
    "grass":          -4,
    "sand":           -2,
    "dirt":          -28,   # горы заметно выше
    "snow":          -16,
}


def stable_hash(*args) -> int:
    h = hashlib.md5(",".join(str(a) for a in args).encode()).digest()
    return int.from_bytes(h[:4], "little")


def stable_float(*args) -> float:
    """Стабильное случайное число [0,1) от ключа."""
    return (stable_hash(*args) & 0xFFFFFF) / 0xFFFFFF


def nearest_biome(rgb):
    best, bd = None, 10**9
    for c, b in COLOR_TO_BIOME.items():
        d = (c[0]-rgb[0])**2 + (c[1]-rgb[1])**2 + (c[2]-rgb[2])**2
        if d < bd:
            bd, best = d, b
    return best


def value_noise(W, H, seed=1337, octaves=4, scale=12.0):
    rnd = random.Random(seed)
    g = max(W, H) // 2 + 4
    grid = [[rnd.random() for _ in range(g + 2)] for _ in range(g + 2)]
    out = [[0.0] * W for _ in range(H)]
    for o in range(octaves):
        freq = scale * (2 ** o)
        amp = 1.0 / (2 ** o)
        for y in range(H):
            for x in range(W):
                gx = (x / W) * freq
                gy = (y / H) * freq
                xi, yi = int(gx) % g, int(gy) % g
                xf, yf = gx - int(gx), gy - int(gy)
                u = xf * xf * (3 - 2 * xf)
                v = yf * yf * (3 - 2 * yf)
                a = grid[yi][xi]
                b = grid[yi][xi + 1]
                c = grid[yi + 1][xi]
                d = grid[yi + 1][xi + 1]
                val = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
                out[y][x] += val * amp
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


def downsample_to_chunks(biome_img, LW, LH):
    """Каждой логической клетке (lx,ly) сопоставляем доминирующий биом
    окна biome_map. Это даёт «художественную» карту, а не literal projection."""
    BW, BH = biome_img.size
    bp = biome_img.load()
    sx_step = BW / LW
    sy_step = BH / LH
    grid = [[None] * LW for _ in range(LH)]
    biome_strength = [[0.0] * LW for _ in range(LH)]  # доля доминирующего биома
    for ly in range(LH):
        for lx in range(LW):
            x0 = int(lx * sx_step)
            x1 = int((lx + 1) * sx_step)
            y0 = int(ly * sy_step)
            y1 = int((ly + 1) * sy_step)
            counts = Counter()
            for y in range(y0, max(y0 + 1, y1)):
                for x in range(x0, max(x0 + 1, x1)):
                    counts[nearest_biome(bp[x, y])] += 1
            biome, n = counts.most_common(1)[0]
            grid[ly][lx] = biome
            total = sum(counts.values())
            biome_strength[ly][lx] = n / total if total else 1.0
    return grid, biome_strength


def add_coastal_ring(grid, LW, LH):
    """Превращает deep_water в shallow_water вокруг суши (1-cell ring)."""
    LAND = {"grass", "sand", "dirt", "snow"}
    new = [row[:] for row in grid]
    for ly in range(LH):
        for lx in range(LW):
            if grid[ly][lx] != "deep_water":
                continue
            has_land = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = lx + dx, ly + dy
                    if 0 <= nx < LW and 0 <= ny < LH and grid[ny][nx] in LAND:
                        has_land = True
                        break
                if has_land:
                    break
            if has_land:
                new[ly][lx] = "shallow_water"
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lw", type=int, default=32)
    ap.add_argument("--lh", type=int, default=16)
    ap.add_argument("--cw", type=int, default=128)
    ap.add_argument("--ch", type=int, default=64)
    ap.add_argument("--overdraw", type=float, default=1.8)
    ap.add_argument("--oval-w", type=float, default=0.82)
    ap.add_argument("--oval-h", type=float, default=0.96)
    ap.add_argument("--feather", type=float, default=18.0)
    ap.add_argument("--jitter", type=float, default=0.08,
                    help="±доля масштаба тайла")
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT))
    args = ap.parse_args()

    CW, CH = args.cw, args.ch
    LW, LH = args.lw, args.lh

    manifest = json.load(open(MANIFEST))
    biome_img = Image.open(BIOME_MAP).convert("RGB")
    print(f"biome_map {biome_img.size}, logical chunks {LW}×{LH}")

    base_tile_w = int(round(CW * args.overdraw))
    base_tile_h = int(round(CH * args.overdraw * 1.05))
    print(f"cell {CW}×{CH}, tile {base_tile_w}×{base_tile_h}, overdraw {args.overdraw:.2f}×")

    variants = variants_by_biome(manifest)

    # Кэш базового размера тайлов
    cache = {}
    for t in manifest["tiles"]:
        img = Image.open(TILES_DIR / f"{t['name']}.png").convert("RGBA")
        cache[t["name"]] = img.resize((base_tile_w, base_tile_h), Image.LANCZOS)
    snow_cap = cache["snow"].resize(
        (int(base_tile_w * 0.78), int(base_tile_h * 0.66)), Image.LANCZOS
    )

    # === биомы по чанкам + береговое кольцо ===
    print("downsampling biome_map → chunks (voting)")
    grid, strength = downsample_to_chunks(biome_img, LW, LH)
    grid = add_coastal_ring(grid, LW, LH)

    # noise
    n_height = value_noise(LW, LH, seed=22, octaves=4, scale=8.0)
    n_decor  = value_noise(LW, LH, seed=33, octaves=2, scale=12.0)

    # === canvas ===
    canvas_w = (LW + LH) * CW // 2 + base_tile_w * 2
    canvas_h = (LW + LH) * CH // 2 + base_tile_h * 2
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    off_x = (LH - 1) * CW // 2 + base_tile_w // 2
    off_y = base_tile_h

    iso_w = (LW + LH) * CW // 2
    iso_h = (LW + LH) * CH // 2
    map_cx = off_x + (LW - LH) * CW // 4
    map_cy = off_y + iso_h // 2

    oval_a = iso_w * args.oval_w / 2
    oval_b = iso_h * args.oval_h / 2

    def screen_xy(lx, ly, dy=0):
        sx = (lx - ly) * CW // 2 + off_x
        sy = (lx + ly) * CH // 2 + off_y + dy
        return sx, sy

    def inside_oval(lx, ly):
        sx, sy = screen_xy(lx, ly, 0)
        nx = (sx - map_cx) / oval_a
        ny = (sy - map_cy) / oval_b
        return nx * nx + ny * ny <= 1.0

    def place_tile(tile_name: str, lx: int, ly: int, dy: int, scale_extra: float = 1.0):
        """Размещает тайл с детерминированным scale-jitter."""
        base = cache[tile_name]
        jit = 1.0 + (stable_float(lx, ly, tile_name) * 2 - 1) * args.jitter
        s = jit * scale_extra
        if abs(s - 1.0) < 0.005:
            tile = base
        else:
            new_w = max(8, int(base.width * s))
            new_h = max(8, int(base.height * s))
            tile = base.resize((new_w, new_h), Image.LANCZOS)
        sx, sy = screen_xy(lx, ly, dy)
        canvas.alpha_composite(tile, (sx - tile.width // 2, sy - tile.height))

    # === passes ===
    print("pass 1: ocean underlay")
    dwv = variants["deep_water"]
    placed = 0
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            tn = dwv[stable_hash(lx, ly, 1) % len(dwv)]
            place_tile(tn, lx, ly, ELEVATION["deep_water"])
            placed += 1
    print(f"  placed {placed} ocean tiles")

    print("pass 2: shallow water (coastal ring)")
    swv = variants["shallow_water"]
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "shallow_water":
                continue
            tn = swv[stable_hash(lx, ly, 2) % len(swv)]
            place_tile(tn, lx, ly, ELEVATION["shallow_water"])

    print("pass 3: land")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            b = grid[ly][lx]
            if b in ("deep_water", "shallow_water"):
                continue
            vs = variants.get(b) or variants["grass"]
            tn = vs[stable_hash(lx, ly, 3) % len(vs)]
            dy = ELEVATION[b]
            if b == "dirt":
                # стек гор: 1-3 тайла друг над другом
                h = n_height[ly][lx]
                stack = 1 + int(h * 2.4)  # 1..3
                for k in range(stack):
                    place_tile(
                        tn, lx, ly,
                        dy - k * int(CH * 0.55),
                        scale_extra=1.0 - k * 0.06,
                    )
            else:
                place_tile(tn, lx, ly, dy)

    print("pass 4: snow caps over high mountains")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "dirt":
                continue
            h = n_height[ly][lx]
            if h < 0.55:
                continue
            stack = 1 + int(h * 2.4)
            sx, sy = screen_xy(lx, ly, ELEVATION["dirt"] - stack * int(CH * 0.55) - 8)
            cap = snow_cap
            jit = 1.0 + (stable_float(lx, ly, "cap") * 2 - 1) * args.jitter
            if abs(jit - 1.0) > 0.005:
                cap = snow_cap.resize(
                    (int(snow_cap.width * jit), int(snow_cap.height * jit)),
                    Image.LANCZOS,
                )
            canvas.alpha_composite(cap, (sx - cap.width // 2, sy - cap.height))

    print("pass 5: decor on grass (extra variant for volume)")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "grass":
                continue
            if n_decor[ly][lx] < 0.62:
                continue
            if stable_float(lx, ly, "decor") > 0.5:
                continue
            vs = variants["grass"]
            # выбираем ДРУГОЙ grass-вариант (не тот что лежит снизу)
            base_idx = stable_hash(lx, ly, 3) % len(vs)
            extra_idx = (base_idx + 1 + stable_hash(lx, ly, 7) % (len(vs) - 1)) % len(vs)
            place_tile(vs[extra_idx], lx, ly, ELEVATION["grass"] - int(CH * 0.18),
                       scale_extra=0.78)

    # === финальная альфа-маска ===
    print("alpha mask (oval + feather)")
    mask = Image.new("L", (canvas_w, canvas_h), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse(
        (map_cx - oval_a, map_cy - oval_b, map_cx + oval_a, map_cy + oval_b),
        fill=255,
    )
    if args.feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(args.feather))
    r, g, b, a = canvas.split()
    canvas.putalpha(ImageChops.multiply(a, mask))

    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)

    out_path = Path(args.out)
    canvas.save(out_path)
    print(f"✓ {out_path} {canvas.size}")


if __name__ == "__main__":
    main()
