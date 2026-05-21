#!/usr/bin/env python3
"""
Классификация watrtl-тайлов по 4-уголкам: вода (W) или суша (L).

Цвета:
  - Вода = синий доминирует (B > R, B > G, B > 80)
  - Суша = коричневый/зелёный (R+G > 2*B, или G > B)
  - Граница (anti-aliased pixel) = всё остальное (игнорируем)

Алгоритм:
  Для каждого тайла:
    1) Считаем долю «воды» и «суши» в каждом из 4 квадрантов 16×16.
    2) В каждом квадранте берём ЦЕНТРАЛЬНЫЙ 8×8 (чтобы избежать пограничных
       пикселей). Решаем 'W' если воды больше, 'L' иначе.
    3) Получаем 4-символьный код NW NE SW SE: например 'WWWL' = суша в SE.

Также для каждого тайла генерируем 3 трансформации (flipH, flipV, rotate180)
и проверяем какой код они дают — это позволяет автоматически "достроить"
недостающие wang-конфигурации из имеющихся.

Выход:
  public/tiles/water_wang.json — { code: [ {name, transform} ], ... }
  public/tiles/water_classified.png — визуальный отчёт
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/bg"
OUT_JSON = ROOT / "public/tiles/water_wang.json"
OUT_PNG = ROOT / "public/tiles/water_classified.png"


def pixel_label(rgba):
    r, g, b = rgba[0], rgba[1], rgba[2]
    # Вода: синий доминирует
    if b > r + 10 and b > g + 5 and b > 70:
        return "W"
    # Суша: красный/зелёный преобладает
    if r > b + 5 or g > b + 5:
        return "L"
    return "?"


def quadrant_label(img, qx, qy):
    """qx, qy ∈ {0,1} — координата квадранта. Возвращает 'W' или 'L'."""
    px = img.load()
    x0 = qx * 16 + 4
    y0 = qy * 16 + 4
    counts = {"W": 0, "L": 0, "?": 0}
    for y in range(y0, y0 + 8):
        for x in range(x0, x0 + 8):
            counts[pixel_label(px[x, y])] += 1
    # Решаем по большинству, '?' игнорируем
    if counts["W"] > counts["L"]:
        return "W"
    return "L"


def classify_tile(img):
    """Возвращает 4-символьный код NW NE SW SE."""
    nw = quadrant_label(img, 0, 0)
    ne = quadrant_label(img, 1, 0)
    sw = quadrant_label(img, 0, 1)
    se = quadrant_label(img, 1, 1)
    return f"{nw}{ne}{sw}{se}"


def main():
    files = sorted(SRC.glob("watrtl*.png"))
    if not files:
        print("NO watrtl files")
        return

    # Группировка: code → [(name, transform)]
    table = defaultdict(list)
    raw_info = {}  # name → original code

    for f in files:
        img = Image.open(f).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        # Оригинальный код
        code_orig = classify_tile(img)
        raw_info[f.name] = code_orig
        table[code_orig].append({"name": f.name, "transform": "none"})

        # Трансформации
        for tname, tx_img in [
            ("flipH", img.transpose(Image.FLIP_LEFT_RIGHT)),
            ("flipV", img.transpose(Image.FLIP_TOP_BOTTOM)),
            ("rotate180", img.transpose(Image.ROTATE_180)),
        ]:
            code_tx = classify_tile(tx_img)
            if code_tx != code_orig:  # не добавляем дубликаты
                table[code_tx].append({"name": f.name, "transform": tname})

    # Сохраняем JSON
    out = {code: variants for code, variants in sorted(table.items())}
    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")

    # Печатаем сводку
    print("=== Watrtl classification ===")
    print(f"Total tiles: {len(files)}")
    print()
    print("By original code (no transforms):")
    by_code = defaultdict(list)
    for name, code in raw_info.items():
        by_code[code].append(name)
    for code in sorted(by_code):
        names = by_code[code]
        print(f"  {code}: {len(names)} → {', '.join(names[:8])}{' ...' if len(names) > 8 else ''}")

    print()
    print("Wang coverage (16 possible codes):")
    all_codes = ["".join([a, b, c, d]) for a in "WL" for b in "WL" for c in "WL" for d in "WL"]
    for code in all_codes:
        variants = out.get(code, [])
        print(f"  {code}: {len(variants)} variants")

    # Визуальный отчёт
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 9)
    except Exception:
        font = ImageFont.load_default()

    cell_w = 8 * TILE + 6
    cell_h = TILE + 14
    cols = 4
    rows = 4
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (25, 25, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for i, code in enumerate(all_codes):
        col = i % cols
        row = i // cols
        x0 = col * cell_w
        y0 = row * cell_h
        draw.text((x0 + 2, y0), f"{code} ({len(out.get(code, []))})", fill=(220, 220, 200, 255), font=font)
        variants = out.get(code, [])
        for vi, v in enumerate(variants[:8]):
            src = SRC / v["name"]
            if not src.exists():
                continue
            tile = Image.open(src).convert("RGBA")
            tx = v["transform"]
            if tx == "flipH":
                tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
            elif tx == "flipV":
                tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
            elif tx == "rotate180":
                tile = tile.transpose(Image.ROTATE_180)
            sheet.paste(tile, (x0 + vi * TILE + 2, y0 + 12))
    sheet.save(OUT_PNG)
    print(f"\n✓ {OUT_JSON}")
    print(f"✓ {OUT_PNG}")


if __name__ == "__main__":
    main()
