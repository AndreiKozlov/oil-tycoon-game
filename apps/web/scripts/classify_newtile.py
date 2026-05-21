#!/usr/bin/env python3
"""
Wang-классификация всех тайлов newtile_crops по 4 углам.

Категории биомов (по среднему цвету квадранта 8×8):
  W = WATER (синий)
  S = SAND  (светло-песочный/тёплый)
  G = GRASS (зелёный, светло- и средне-)
  F = FOREST (тёмно-зелёный, как джунгли) — близок к G, объединяем
  I = ICE/SNOW (белый, светло-серый)
  D = DIRT  (тёмно-коричневый) — близок к S, объединяем как S или G

Для wang-схемы используем 4 категории: W, S, G, I.
Это даёт 256 возможных wang-кодов, нам нужны самые частые.

Дополнительно используем 3 трансформации (flipH/flipV/rotate180)
для дополнения недостающих конфигураций.

Выход:
  public/tiles/newtile_wang.json
"""
import json
from pathlib import Path
from PIL import Image
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "public/tiles/newtile_crops"
OUT_JSON = ROOT / "public/tiles/newtile_wang.json"

TILE = 32


def pixel_label(rgba):
    r, g, b, a = rgba
    if a < 100:
        return "."  # прозрачный
    # WATER: явный синий
    if b > r + 15 and b > g - 5 and b > 80:
        return "W"
    # SNOW/ICE: очень светлый
    if r > 200 and g > 200 and b > 200:
        return "I"
    # SAND: светлый тёплый
    if r > 160 and g > 130 and b > 60 and r > b + 30:
        return "S"
    # FOREST/DARK GRASS: тёмно-зелёный
    if g > r and g > b and g > 50 and (r + g + b) < 350:
        return "F"
    # GRASS: ярче зелёный
    if g > r - 5 and g > b and g > 80:
        return "G"
    # DIRT/SAND-ish тёплый средне
    if r > 100 and r > b + 10 and r > g - 15:
        return "S"
    return "?"


def quadrant_label(img, qx, qy):
    px = img.load()
    counts = defaultdict(int)
    x0 = qx * 16 + 4
    y0 = qy * 16 + 4
    for y in range(y0, y0 + 8):
        for x in range(x0, x0 + 8):
            counts[pixel_label(px[x, y])] += 1
    counts.pop(".", None)
    counts.pop("?", None)
    if not counts or max(counts.values()) == 0:
        return "?"
    # Объединение: F и G одно (трава), I отдельно (снег)
    lbl = max(counts, key=counts.get)
    if lbl == "F":
        return "G"  # F → G для wang-схемы
    return lbl


def classify(img):
    return f"{quadrant_label(img, 0, 0)}{quadrant_label(img, 1, 0)}{quadrant_label(img, 0, 1)}{quadrant_label(img, 1, 1)}"


def main():
    files = sorted(SRC_DIR.glob("*.png"))
    table = defaultdict(list)
    code_orig_count = defaultdict(int)

    for f in files:
        img = Image.open(f).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        code = classify(img)
        code_orig_count[code] += 1
        # Если в коде есть '?' — игнорируем (плохая классификация)
        if "?" in code:
            continue
        table[code].append({"name": f.name, "transform": "none"})

        # Трансформации
        for tname, tx_img in [
            ("flipH", img.transpose(Image.FLIP_LEFT_RIGHT)),
            ("flipV", img.transpose(Image.FLIP_TOP_BOTTOM)),
            ("rotate180", img.transpose(Image.ROTATE_180)),
        ]:
            code_tx = classify(tx_img)
            if "?" in code_tx:
                continue
            if code_tx != code:
                table[code_tx].append({"name": f.name, "transform": tname})

    OUT_JSON.write_text(json.dumps({c: v for c, v in sorted(table.items())}, indent=2),
                       encoding="utf-8")

    print(f"Tiles classified: {len(files)}")
    print(f"Unique wang codes (clean): {len(table)}")
    print()
    print("Top codes:")
    sorted_codes = sorted(table.items(), key=lambda x: -len(x[1]))
    for code, variants in sorted_codes[:30]:
        print(f"  {code}: {len(variants)} variants")
    print()
    print("Codes by original (before transforms) — to see raw biome mix:")
    sorted_orig = sorted(code_orig_count.items(), key=lambda x: -x[1])
    for code, cnt in sorted_orig[:20]:
        print(f"  {code}: {cnt}")


if __name__ == "__main__":
    main()
