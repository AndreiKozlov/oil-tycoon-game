#!/usr/bin/env python3
"""
render_global_map_v3.py — игровая карта Земли с овальной формой.

Что починено по сравнению с v2:
  • Canvas прозрачный (alpha=0 везде, никакого синего fill).
  • Овальная маска в screen-space: inside-test после изо-проекции.
    Маска овала, а не изо-параллелограмма со скруглёнными углами.
  • Deep_water underlay рисуется только внутри маски, не по всему canvas.
  • Все 6 passes пропускают клетки вне маски (`continue`).
  • После рендера применяется финальная альфа-маска с feathered краем
    (GaussianBlur) — гладкий силуэт без зубчатого ступенчатого края.
  • Ледяные полосы (lat>78 / lat<-68) автоматически обрезаются — они
    находятся в углах изо-параллелограмма и попадают за пределы овала.

Frontend: фон страницы уже тёмный, поэтому PNG с прозрачностью
ложится как «остров-планета» на тёмно-синий backdrop.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json, hashlib, argparse, random

ROOT = Path(__file__).resolve().parent.parent
TILES_DIR = ROOT / "public/tiles/iso_18"
MANIFEST = ROOT / "public/tiles/iso_18.json"
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
DEFAULT_OUT = ROOT / "public/tiles/global_earth_map_v3.png"

COLOR_TO_BIOME = {
    (35,  90, 170): "deep_water",
    (110, 190, 220): "shallow_water",
    (80, 165,  75): "grass",
    (235, 205, 105): "sand",
    (140,  95,  55): "dirt",
    (240, 245, 250): "snow",
}

ELEVATION = {
    "deep_water":    +6,
    "shallow_water": +3,
    "grass":         -2,
    "sand":          -1,
    "dirt":         -16,
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cw", type=int, default=44)
    ap.add_argument("--ch", type=int, default=22)
    ap.add_argument("--overdraw", type=float, default=1.9)
    ap.add_argument("--step", type=int, default=2)
    # Параметры овала: доля от bbox карты в screen-space.
    # 1.0 = вписан в bbox, <1.0 = меньше bbox.
    ap.add_argument("--oval-w", type=float, default=0.98)
    ap.add_argument("--oval-h", type=float, default=0.96)
    ap.add_argument("--feather", type=float, default=6.0,
                    help="Gaussian blur of alpha edge (px)")
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT))
    args = ap.parse_args()

    CW, CH = args.cw, args.ch
    STEP = args.step
    manifest = json.load(open(MANIFEST))

    biome_img = Image.open(BIOME_MAP).convert("RGB")
    BW, BH = biome_img.size
    bp = biome_img.load()

    LW, LH = BW // STEP, BH // STEP

    tile_w = int(round(CW * args.overdraw))
    tile_h = int(round(CH * args.overdraw * 1.05))

    variants = variants_by_biome(manifest)

    cache = {}
    for t in manifest["tiles"]:
        img = Image.open(TILES_DIR / f"{t['name']}.png").convert("RGBA")
        cache[t["name"]] = img.resize((tile_w, tile_h), Image.LANCZOS)
    snow_cap = cache["snow"].resize((int(tile_w * 0.65), int(tile_h * 0.55)), Image.LANCZOS)
    dirt_small = cache["dirt_1"].resize((int(tile_w * 0.55), int(tile_h * 0.5)), Image.LANCZOS)

    print("noise...")
    n_edge   = value_noise(LW, LH, seed=11, octaves=3, scale=18.0)
    n_height = value_noise(LW, LH, seed=22, octaves=4, scale=10.0)
    n_decor  = value_noise(LW, LH, seed=33, octaves=2, scale=24.0)

    grid = []
    for ly in range(LH):
        row = []
        for lx in range(LW):
            ne = n_edge[ly][lx]
            sx = int(lx * STEP + (ne - 0.5) * STEP * 1.6)
            sy = int(ly * STEP + (ne - 0.5) * STEP * 1.6)
            sx = max(0, min(BW - 1, sx))
            sy = max(0, min(BH - 1, sy))
            row.append(nearest_biome(bp[sx, sy]))
        grid.append(row)

    # === canvas: прозрачный ===
    canvas_w = (LW + LH) * CW // 2 + tile_w * 2
    canvas_h = (LW + LH) * CH // 2 + tile_h * 2
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    off_x = (LH - 1) * CW // 2 + tile_w // 2
    off_y = tile_h

    # bbox изо-параллелограмма в screen-space:
    # screen_x ∈ [0, (LW + LH) * CW/2]
    # screen_y ∈ [0, (LW + LH) * CH/2]
    iso_w = (LW + LH) * CW // 2
    iso_h = (LW + LH) * CH // 2
    # центр карты в screen-space (с учётом offset):
    map_cx = off_x + (LW - LH) * CW // 4  # центр изо-bbox по X
    map_cy = off_y + iso_h // 2

    # полуоси овала
    oval_a = iso_w * args.oval_w / 2  # по X
    oval_b = iso_h * args.oval_h / 2  # по Y

    def screen_xy(lx, ly, dy=0):
        sx = (lx - ly) * CW // 2 + off_x
        sy = (lx + ly) * CH // 2 + off_y + dy
        return sx, sy

    def inside_oval(lx, ly):
        # Якорь клетки — центр ромба (без elevation), чтобы маска не дёргалась.
        sx, sy = screen_xy(lx, ly, 0)
        nx = (sx - map_cx) / oval_a
        ny = (sy - map_cy) / oval_b
        return nx * nx + ny * ny <= 1.0

    def place(tile, lx, ly, dy=0):
        sx, sy = screen_xy(lx, ly, dy)
        canvas.alpha_composite(tile, (sx - tile.width // 2, sy - tile.height))

    # === passes ===
    print("pass 1: ocean underlay (only inside oval)")
    dwv = variants["deep_water"]
    cells_drawn = 0
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            t = cache[dwv[stable_hash(lx, ly, 1) % len(dwv)]]
            place(t, lx, ly, dy=ELEVATION["deep_water"])
            cells_drawn += 1
    print(f"  drew {cells_drawn}/{LW*LH} cells")

    print("pass 2: shallow")
    swv = variants["shallow_water"]
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "shallow_water":
                continue
            t = cache[swv[stable_hash(lx, ly, 2) % len(swv)]]
            place(t, lx, ly, dy=ELEVATION["shallow_water"])

    print("pass 3: land")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            b = grid[ly][lx]
            if b in ("deep_water", "shallow_water"):
                continue
            vs = variants.get(b) or variants["grass"]
            t = cache[vs[stable_hash(lx, ly, 3) % len(vs)]]
            dy = ELEVATION[b]
            if b == "dirt":
                dy += int((n_height[ly][lx] - 0.5) * 14)
            place(t, lx, ly, dy=dy)

    print("pass 4: snow caps")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "dirt":
                continue
            if n_height[ly][lx] < 0.62:
                continue
            sx, sy = screen_xy(lx, ly, ELEVATION["dirt"] - 10)
            canvas.alpha_composite(
                snow_cap,
                (sx - snow_cap.width // 2, sy - snow_cap.height),
            )

    print("pass 5: decor")
    for ly in range(LH):
        for lx in range(LW):
            if not inside_oval(lx, ly):
                continue
            if grid[ly][lx] != "grass":
                continue
            if n_decor[ly][lx] < 0.78:
                continue
            if (stable_hash(lx, ly, 5) & 1) == 0:
                continue
            sx, sy = screen_xy(lx, ly, ELEVATION["grass"] - 6)
            canvas.alpha_composite(
                dirt_small,
                (sx - dirt_small.width // 2, sy - dirt_small.height),
            )

    # === финальная альфа-маска: feathered oval ===
    print("alpha mask + feather")
    mask = Image.new("L", (canvas_w, canvas_h), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse(
        (map_cx - oval_a, map_cy - oval_b, map_cx + oval_a, map_cy + oval_b),
        fill=255,
    )
    if args.feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(args.feather))

    r, g, b, a = canvas.split()
    new_alpha = ImageChops.multiply(a, mask)
    canvas.putalpha(new_alpha)

    # crop к bbox непрозрачных пикселей, чтобы не таскать пустые поля
    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)
        print(f"  cropped to {canvas.size} (was {canvas_w}×{canvas_h})")

    out_path = Path(args.out)
    canvas.save(out_path)
    print(f"✓ {out_path} {canvas.size}")


if __name__ == "__main__":
    main()
