#!/usr/bin/env python3
"""
Рендер глобальной изометрической карты Земли из biome_map.png и iso_18 тайлов.

Логика:
  • Читает biome_map.png (192×96).
  • На каждый пиксель ставит тайл соответствующего биома, выбирая вариант
    стабильно по hash(x, y) — карта не меняется при повторных запусках.
  • Изометрия: screen_x = (x - y) * CW/2, screen_y = (x + y) * CH/2.
    Tile canvas (~341×256) больше клетки (CW×CH), поэтому ромбы автоматически
    перекрывают соседей → нет швов.
  • Pivot тайла = bottom-center.
  • Painter's algorithm: y возрастает по строкам, x по столбцам.
  • Под всё кладём ocean-baseline: deep_water тайлы по всей маске карты, чтобы
    даже при микрощелях из-под суши проглядывал океан, а не чёрный фон.

CLI:
  python render_global_map.py [--cw 160] [--ch 80] [--out path]
"""
from pathlib import Path
from PIL import Image
import json, hashlib, argparse, sys

ROOT = Path(__file__).resolve().parent.parent
TILES_DIR = ROOT / "public/tiles/iso_18"
MANIFEST = ROOT / "public/tiles/iso_18.json"
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
DEFAULT_OUT = ROOT / "public/tiles/global_earth_map.png"

# Цвета biome_map → биомы (см. make_biome_map.py)
COLOR_TO_BIOME = {
    (35,  90, 170): "deep_water",
    (110, 190, 220): "shallow_water",
    (80, 165,  75): "grass",
    (235, 205, 105): "sand",
    (140,  95,  55): "dirt",
    (240, 245, 250): "snow",
}

# z-order слоя: меньше = раньше рисуется (под низом)
LAYER = {
    "deep_water": 0,
    "shallow_water": 1,
    "sand": 2,
    "dirt": 2,
    "grass": 2,
    "snow": 3,  # сверху всего — арктический лёд / снежные шапки
}


def nearest_biome(rgb: tuple[int, int, int]) -> str:
    best, best_d = None, 10**9
    for c, b in COLOR_TO_BIOME.items():
        d = (c[0]-rgb[0])**2 + (c[1]-rgb[1])**2 + (c[2]-rgb[2])**2
        if d < best_d:
            best_d, best = d, b
    return best


def variants_by_biome(manifest) -> dict[str, list[str]]:
    out = {}
    for t in manifest["tiles"]:
        out.setdefault(t["biome"], []).append(t["name"])
    # «ice_water» используем как часть мелководья у полюсов (не нужно отдельно)
    if "ice_water" in out:
        out["shallow_water"] = out.get("shallow_water", []) + out["ice_water"]
    return out


def stable_pick(variants: list[str], x: int, y: int) -> str:
    h = hashlib.md5(f"{x},{y}".encode()).digest()
    return variants[h[0] % len(variants)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cw", type=int, default=160, help="iso cell width")
    ap.add_argument("--ch", type=int, default=80,  help="iso cell height")
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT))
    ap.add_argument("--scale", type=float, default=1.0,
                    help="downscale tile canvas (1.0 = 341×256). For perf.")
    args = ap.parse_args()

    CW, CH = args.cw, args.ch
    manifest = json.load(open(MANIFEST))
    cell_w_src = manifest["cell"]["w"]
    cell_h_src = manifest["cell"]["h"]

    # Кэш масштабированных тайлов
    scale_w = int(cell_w_src * args.scale * CW / (cell_w_src * 0.46))
    scale_h = int(cell_h_src * args.scale * CH / (cell_h_src * 0.31))
    # ↑ эмпирика: ромб занимает ~92% × ~82% canvas → масштабируем так,
    # чтобы видимый ромб совпал с CW×CH, а canvas (overdraw) был больше.
    # Проще: tile_w = CW / 0.92 ≈ CW * 1.087, tile_h = CH / 0.82 ≈ CH * 1.22
    tile_w = int(round(CW / 0.92))
    tile_h = int(round(CH / 0.82))

    tile_cache: dict[str, Image.Image] = {}
    for t in manifest["tiles"]:
        img = Image.open(TILES_DIR / f"{t['name']}.png").convert("RGBA")
        tile_cache[t["name"]] = img.resize((tile_w, tile_h), Image.LANCZOS)

    biome_img = Image.open(BIOME_MAP).convert("RGB")
    W, H = biome_img.size
    bp = biome_img.load()

    variants = variants_by_biome(manifest)
    print("biome variants:", {k: len(v) for k, v in variants.items()})

    # Canvas: изометрия. Размер:
    #   width  ≈ (W + H) * CW/2 + tile_w
    #   height ≈ (W + H) * CH/2 + tile_h
    canvas_w = (W + H) * CW // 2 + tile_w
    canvas_h = (W + H) * CH // 2 + tile_h
    print(f"canvas: {canvas_w}×{canvas_h}, cell {CW}×{CH}, tile {tile_w}×{tile_h}")

    # baseline ocean fill
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (35, 90, 170, 255))

    # Сдвиг чтобы все экранные координаты были >= 0
    # min screen_x = (0 - (H-1)) * CW/2 = -(H-1)*CW/2
    off_x = (H - 1) * CW // 2 + tile_w // 2
    off_y = tile_h  # pivot = bottom

    # Pre-pass: ocean baseline под всей площадью карты (deep_water тайлы),
    # чтобы при любой микрощели снизу был океан.
    deep_variants = variants["deep_water"]
    # рисуем deep_water по всей сетке — потом всё остальное сверху
    for y in range(H):
        for x in range(W):
            sx = (x - y) * CW // 2 + off_x
            sy = (x + y) * CH // 2 + off_y
            t = tile_cache[stable_pick(deep_variants, x, y)]
            canvas.alpha_composite(t, (sx - t.width // 2, sy - t.height))

    # Main pass: суша + мелководье + снег по z-order
    sorted_pixels = []
    for y in range(H):
        for x in range(W):
            biome = nearest_biome(bp[x, y])
            if biome == "deep_water":
                continue  # уже нарисовано в baseline
            sorted_pixels.append((LAYER[biome], y, x, biome))

    # painter: ниже сначала (по y), внутри строки слева направо
    sorted_pixels.sort(key=lambda t: (t[0], t[1], t[2]))
    for layer, y, x, biome in sorted_pixels:
        sx = (x - y) * CW // 2 + off_x
        sy = (x + y) * CH // 2 + off_y
        vs = variants.get(biome) or variants["grass"]
        t = tile_cache[stable_pick(vs, x, y)]
        canvas.alpha_composite(t, (sx - t.width // 2, sy - t.height))

    out_path = Path(args.out)
    canvas.save(out_path)
    print(f"✓ rendered global earth map → {out_path} ({canvas.size})")


if __name__ == "__main__":
    sys.exit(main())
