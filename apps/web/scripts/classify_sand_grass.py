#!/usr/bin/env python3
"""
Wang-классификация sand↔grass переходов из tgrs/tgrd/tgrm (bg + tilemap).

Правила цвета:
  - GRASS = зелёный (G > R, G > B)
  - SAND  = песочный (R > G > B, R > 130)
  - DIRT  = тёмно-коричневый (R > G > B, R < 130, B < 100)

Для каждого тайла: квадрант 8×8 в центре каждого угла → label G/S/D.
Получаем 4-символьный код.

Также с трансформациями (flipH/flipV/rotate180) — для дополнения недостающих
конфигураций.

Выход:
  public/tiles/sand_grass_wang.json   { code: [ {name, transform, source_dir} ] }
"""
import json
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
OUT_JSON = ROOT / "public/tiles/sand_grass_wang.json"


def pixel_label(rgba):
    r, g, b = rgba[0], rgba[1], rgba[2]
    # GRASS: чёткая зелень
    if g > r + 8 and g > b + 5 and g > 60:
        return "G"
    # SAND: светлый тёплый
    if r > 140 and g > 110 and b > 70 and r > b + 30:
        return "S"
    # DIRT: тёмно-коричневый
    if r > 60 and r > b + 8 and r > g and r < 160:
        return "D"
    return "?"


def quadrant_label(img, qx, qy):
    px = img.load()
    x0 = qx * 16 + 4
    y0 = qy * 16 + 4
    counts = {"G": 0, "S": 0, "D": 0, "?": 0}
    for y in range(y0, y0 + 8):
        for x in range(x0, x0 + 8):
            counts[pixel_label(px[x, y])] += 1
    counts.pop("?")
    # Берём максимум; если все 0 — fallback G
    return max(counts, key=counts.get) if max(counts.values()) > 0 else "G"


def classify(img):
    return f"{quadrant_label(img, 0, 0)}{quadrant_label(img, 1, 0)}{quadrant_label(img, 0, 1)}{quadrant_label(img, 1, 1)}"


def all_files(prefix):
    seen = set()
    out = []
    for folder in (TILEMAP, BG):
        for f in sorted(folder.glob(f"{prefix}*.png")):
            if f.name not in seen:
                seen.add(f.name)
                out.append((folder.name, f))
    return out


def main():
    # Берём grass-transitional группы: tgrs, tgrd, tgrm
    sources = []
    for prefix in ("tgrs", "tgrd", "tgrm"):
        sources.extend(all_files(prefix))

    table = defaultdict(list)
    by_code_orig = defaultdict(list)
    for folder_name, f in sources:
        img = Image.open(f).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        code_orig = classify(img)
        by_code_orig[code_orig].append(f.name)
        table[code_orig].append({"name": f.name, "transform": "none", "src": folder_name})

        for tname, tx_img in [
            ("flipH", img.transpose(Image.FLIP_LEFT_RIGHT)),
            ("flipV", img.transpose(Image.FLIP_TOP_BOTTOM)),
            ("rotate180", img.transpose(Image.ROTATE_180)),
        ]:
            code_tx = classify(tx_img)
            if code_tx != code_orig:
                table[code_tx].append({"name": f.name, "transform": tname, "src": folder_name})

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({c: v for c, v in sorted(table.items())}, indent=2),
                       encoding="utf-8")

    print(f"Total tiles classified: {sum(len(v) for v in by_code_orig.values())}")
    print("\nBy original code (no transforms):")
    for c in sorted(by_code_orig):
        names = by_code_orig[c]
        print(f"  {c}: {len(names)} → {', '.join(names[:6])}{' ...' if len(names) > 6 else ''}")

    # Покрытие для bipart {S, G} комбинаций — нам они нужны для sand/grass wang
    print("\n=== {S,G} wang coverage (16 кодов, S=sand, G=grass) ===")
    codes = ["".join([a, b, c, d]) for a in "SG" for b in "SG" for c in "SG" for d in "SG"]
    for code in codes:
        n = len(table.get(code, []))
        print(f"  {code}: {n} variants")


if __name__ == "__main__":
    main()
