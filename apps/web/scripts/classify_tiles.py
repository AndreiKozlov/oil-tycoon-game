#!/usr/bin/env python3
"""
Автоклассификатор тайлов по содержимому пикселей.

Идея: для каждого тайла grass-семьи (tgrb из tilemap + tgrs/tgrd/tgrm из bg)
определить, какие из 4 углов 16×16 относятся к биому "grass" (зелёные),
а какие к "dirt" (коричневые). Получаем 4-битную маску углов NW/NE/SW/SE,
которая однозначно говорит: какие соседи являются "своим" биомом.

Дальше: для каждой комбинации 4-битной маски (0..15) сохраняем список
тайлов с такой маской. При рендере карты для клетки (x,y) считаем какие
из её 4 углов окружены своим биомом, и берём подходящий тайл.

Это классический 4-corner wang scheme — работает железно, не зависит от
конкретной нумерации Heroes 3 / VCMI.

Выход:
  public/tiles/grass_corners_map.json — { mask_0_to_15: [list of tile filenames] }
  public/tiles/grass_classified.png   — отчёт-картинка: тайл + его маска подписана
"""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
OUT_JSON = ROOT / "public/tiles/grass_corners_map.json"
OUT_REPORT = ROOT / "public/tiles/grass_classified.png"

# Эвристические цветовые правила: пиксель относится к "grass" или "dirt"?
# Grass: зелёный доминирует (G > R, G > B).
# Dirt:  коричневый (R > G > B, R > 90).


def classify_pixel(rgba):
    r, g, b = rgba[0], rgba[1], rgba[2]
    if g > r and g > b - 5 and g > 70:
        return "grass"
    if r > g + 10 and r > b + 10 and r > 80:
        return "dirt"
    # промежуточное — пограничный пиксель
    return "edge"


def quadrant_label(img, qx, qy):
    """
    qx,qy ∈ {0,1} — координата квадранта (0=lt, 1=rt по x; 0=top, 1=bot по y).
    Возвращает 'grass'/'dirt' по большинству пикселей в центре квадранта.
    Берём центральные 8×8 пикселей квадранта 16×16, чтобы избежать пограничного шума.
    """
    px = img.load()
    x0 = qx * 16 + 4
    y0 = qy * 16 + 4
    counts = {"grass": 0, "dirt": 0, "edge": 0}
    for y in range(y0, y0 + 8):
        for x in range(x0, x0 + 8):
            counts[classify_pixel(px[x, y])] += 1
    # Решаем по большинству, edge не считается
    if counts["grass"] > counts["dirt"]:
        return "grass"
    if counts["dirt"] > counts["grass"]:
        return "dirt"
    return "grass"  # тай-брейк в пользу травы


def corner_mask(img):
    """
    4 угла → бит, 1 если grass, 0 если dirt.
    Порядок битов: bit0=NW (0,0), bit1=NE (1,0), bit2=SW (0,1), bit3=SE (1,1).
    Возвращает int 0..15.
    """
    mask = 0
    if quadrant_label(img, 0, 0) == "grass":
        mask |= 1
    if quadrant_label(img, 1, 0) == "grass":
        mask |= 2
    if quadrant_label(img, 0, 1) == "grass":
        mask |= 4
    if quadrant_label(img, 1, 1) == "grass":
        mask |= 8
    return mask


def main():
    sources = []
    # Grass семейство: base в tilemap, transitions+mixed в bg
    for prefix, folder in [("tgrb", TILEMAP), ("tgrd", TILEMAP), ("tgrm", TILEMAP), ("tgrs", BG), ("tgrm", BG)]:
        for f in sorted(folder.glob(f"{prefix}*.png")):
            sources.append((prefix, f))
    # Дедуплицируем (tgrm есть и в bg и в tilemap — берём оба)
    seen = set()
    uniq = []
    for p, f in sources:
        if f.name not in seen:
            seen.add(f.name)
            uniq.append((p, f))
    sources = uniq

    by_mask = defaultdict(list)
    for prefix, f in sources:
        img = Image.open(f).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        mask = corner_mask(img)
        by_mask[mask].append(f.name)

    # Сохраняем JSON
    data = {str(m): sorted(by_mask[m]) for m in sorted(by_mask.keys())}
    OUT_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # Печатаем сводку
    print(f"=== Classification by 4-corner mask (NW=1, NE=2, SW=4, SE=8) ===")
    print(f"Total tiles processed: {len(sources)}")
    print()
    for m in range(16):
        tiles = by_mask.get(m, [])
        bits = f"NW={'G' if m&1 else 'D'} NE={'G' if m&2 else 'D'} SW={'G' if m&4 else 'D'} SE={'G' if m&8 else 'D'}"
        print(f"  mask {m:2d} [{bits}]: {len(tiles)} tiles")
        for t in tiles[:6]:
            print(f"      {t}")
        if len(tiles) > 6:
            print(f"      ... +{len(tiles) - 6} more")

    # Визуальный отчёт: для каждой маски — образец-тайл и подпись
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    except Exception:
        font = ImageFont.load_default()

    cell_w, cell_h = 6 * 32 + 8, 32 + 16
    cols = 4
    rows = 4
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (25, 25, 25, 255))
    draw = ImageDraw.Draw(sheet)
    for m in range(16):
        col = m % cols
        row = m // cols
        x0 = col * cell_w
        y0 = row * cell_h
        bits = f"#{m:02d} NW={'G' if m&1 else 'D'} NE={'G' if m&2 else 'D'} SW={'G' if m&4 else 'D'} SE={'G' if m&8 else 'D'}"
        draw.text((x0 + 2, y0 + 1), bits, fill=(220, 220, 220, 255), font=font)
        # Показать до 6 примеров
        tiles = by_mask.get(m, [])
        for i, name in enumerate(tiles[:6]):
            # Найти файл
            p = (BG / name) if (BG / name).exists() else (TILEMAP / name)
            if not p.exists():
                continue
            tile = Image.open(p).convert("RGBA")
            sheet.paste(tile, (x0 + i * 32 + 2, y0 + 16))
    sheet.save(OUT_REPORT)
    print(f"\n✓ {OUT_JSON}")
    print(f"✓ {OUT_REPORT}  ({sheet.size})")


if __name__ == "__main__":
    main()
