#!/usr/bin/env python3
"""
Нарезка newtile.png на регулярную сетку 32×32.

Tilemap 1024×1536 содержит несколько крупных «островов» с переходами
вода→песок→трава→лес. Альфа-канал: фоновые/неиспользуемые тайлы
имеют alpha=0 (полностью прозрачные).

Алгоритм:
  1) Нарезка на 32×24=... тайлы 32×32 → 32 cols × 48 rows = 1536 тайлов.
  2) Отсев: тайлы где >90% пикселей прозрачны — выбрасываем (их использовать
     для рендера нельзя, это просто фон).
  3) Сохраняем оставшиеся тайлы в public/tiles/newtile_crops/ с именами
     tile_RRCC.png (RR=row, CC=col).
  4) Дополнительно строим preview-grid с подписями для визуальной отладки.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/root/oil_tycoon_project/newtile.png")
OUT_DIR = ROOT / "public/tiles/newtile_crops"
OUT_PREVIEW = ROOT / "public/tiles/newtile_preview.png"

TILE = 32
COLS = 32
ROWS = 48
MIN_OPAQUE_FRAC = 0.10  # тайл сохраняем если ≥10% пикселей непрозрачны


def opaque_fraction(img):
    px = img.load()
    n = TILE * TILE
    opaque = sum(1 for y in range(TILE) for x in range(TILE) if px[x, y][3] > 100)
    return opaque / n


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    print(f"Source: {src.size}")

    saved = []
    for row in range(ROWS):
        for col in range(COLS):
            tile = src.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))
            frac = opaque_fraction(tile)
            if frac < MIN_OPAQUE_FRAC:
                continue
            name = f"tile_{row:02d}_{col:02d}.png"
            tile.save(OUT_DIR / name)
            saved.append((row, col, frac, name))

    print(f"Saved tiles: {len(saved)} / {COLS * ROWS}")

    # Preview-grid: показать всё что сохранилось с подписями
    label_h = 12
    cell_w = TILE * 3 + 2
    cell_h = TILE * 3 + label_h + 2
    grid_cols = 16
    grid_rows = (len(saved) + grid_cols - 1) // grid_cols
    canvas = Image.new("RGBA", (grid_cols * cell_w, grid_rows * cell_h), (15, 15, 20, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 8)
    except Exception:
        font = ImageFont.load_default()
    for i, (row, col, frac, name) in enumerate(saved):
        gx = (i % grid_cols) * cell_w
        gy = (i // grid_cols) * cell_h
        tile = Image.open(OUT_DIR / name)
        scaled = tile.resize((TILE * 3, TILE * 3), Image.NEAREST)
        canvas.paste(scaled, (gx + 1, gy + label_h + 1))
        draw.text((gx + 1, gy), f"{row:02d},{col:02d}", fill=(220, 220, 220, 255), font=font)
    canvas.save(OUT_PREVIEW)
    print(f"✓ Preview: {OUT_PREVIEW} ({canvas.size})")


if __name__ == "__main__":
    main()
