#!/usr/bin/env python3
"""
Изометрическая нарезка newtile.png.

Размер тайла: 64×32 (классический изо-ромб).

Шахматная сетка:
  Каждый ромб занимает прямоугольник 64×32.
  Ромбы расположены в "шахматке": чётные строки (по y) — без смещения,
  нечётные — со смещением 32px (полширины).
  Шаг по Y = 16 (полвысоты ромба).

  Чтобы нарезать прямо: режем картинку на квадраты 64×32 БЕЗ смещения
  (т.е. (col*64, row*32)). А ОРИЕНТАЦИЯ ромба внутри: вершина-сверху,
  правая сбоку, нижняя снизу, левая сбоку — занимает только центральную
  ромбическую область прямоугольника. Прозрачные углы (UL, UR, BL, BR)
  относятся к соседним ромбам в шахматке.

Этот способ — стандартный для iso-tilesets. Отсев "пустых" ромбов = где
ромбическая область прозрачна (alpha=0 во всех 4 квадрантах ромба).

Выход:
  public/tiles/iso_crops/      — все непустые ромбы
  public/tiles/iso_preview.png — preview с подписями
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/root/oil_tycoon_project/newtile.png")
OUT_DIR = ROOT / "public/tiles/iso_crops"
OUT_PREVIEW = ROOT / "public/tiles/iso_preview.png"

TILE_W = 64
TILE_H = 32


def is_rhomb_pixel(x, y):
    """Точка (x, y) внутри прямоугольника 64×32 принадлежит ромбу?
    Ромб с центром (32, 16), вершины (32,0), (64,16), (32,32), (0,16).
    Точка внутри ромба <=> |x-32|/32 + |y-16|/16 <= 1.
    """
    return abs(x - TILE_W / 2) / (TILE_W / 2) + abs(y - TILE_H / 2) / (TILE_H / 2) <= 1.0


def rhomb_opaque_fraction(tile):
    """Доля непрозрачных пикселей ВНУТРИ ромба."""
    px = tile.load()
    inside = 0
    opaque = 0
    for y in range(TILE_H):
        for x in range(TILE_W):
            if is_rhomb_pixel(x, y):
                inside += 1
                if px[x, y][3] > 100:
                    opaque += 1
    return opaque / inside if inside else 0


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    W, H = src.size
    print(f"Source: {W}×{H}")

    saved = []
    # Шахматный grid: чётные строки по обычной сетке (col*64, row*32),
    # нечётные строки со смещением (col*64 + 32, row*32 + 16) — на самом деле
    # для нарезки удобнее идти просто (col*64, row*32) и (col*64+32, row*32+16)
    # как два отдельных набора и обрабатывать оба.
    grids = [
        ("a", 0, 0),     # основная сетка (col*64, row*32)
        ("b", 32, 16),   # смещённая (col*64+32, row*32+16)
    ]

    for grid_name, x_off, y_off in grids:
        rows = (H - y_off) // TILE_H
        cols = (W - x_off) // TILE_W
        for row in range(rows):
            for col in range(cols):
                x0 = x_off + col * TILE_W
                y0 = y_off + row * TILE_H
                if x0 + TILE_W > W or y0 + TILE_H > H:
                    continue
                tile = src.crop((x0, y0, x0 + TILE_W, y0 + TILE_H))
                frac = rhomb_opaque_fraction(tile)
                if frac < 0.20:
                    continue
                name = f"iso_{grid_name}_{row:02d}_{col:02d}.png"
                tile.save(OUT_DIR / name)
                saved.append((grid_name, row, col, frac, name))

    print(f"Saved tiles: {len(saved)}")

    # Превью
    label_h = 12
    cell_w = TILE_W * 2 + 4
    cell_h = TILE_H * 2 + label_h + 4
    grid_cols = 16
    grid_rows = (len(saved) + grid_cols - 1) // grid_cols
    canvas = Image.new("RGBA", (grid_cols * cell_w, grid_rows * cell_h), (15, 15, 25, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 8)
    except Exception:
        font = ImageFont.load_default()
    for i, (g, row, col, frac, name) in enumerate(saved):
        gx = (i % grid_cols) * cell_w
        gy = (i // grid_cols) * cell_h
        tile = Image.open(OUT_DIR / name)
        scaled = tile.resize((TILE_W * 2, TILE_H * 2), Image.NEAREST)
        canvas.paste(scaled, (gx + 2, gy + label_h + 2))
        draw.text((gx + 2, gy), f"{g}{row:02d},{col:02d}", fill=(220, 220, 220, 255), font=font)
    canvas.save(OUT_PREVIEW)
    print(f"✓ {OUT_PREVIEW} ({canvas.size})")


if __name__ == "__main__":
    main()
