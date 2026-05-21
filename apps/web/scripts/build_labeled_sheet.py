#!/usr/bin/env python3
"""
Лист всех тайлов с подписями — для визуального опознания.

Для каждой группы (tgrb/tgrs/tgrd/tgrm/clrrvr/etc) рисует тайлы 4× размером
с подписью имени файла снизу. Помогает увидеть: что такое base, что такое
transition, какое имя соответствует какому положению (NW corner, top edge, etc).
"""

import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TILE = 32
SCALE = 4                       # 128px на тайл — крупно
LABEL_H = 14
COLS = 8                        # колонок на лист
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/bg"
OUT = ROOT / "public/tiles/labeled_sheet.png"

NAME_RE = re.compile(r"^([a-z]+)(\d+)\.png$", re.IGNORECASE)

# Только grass-семейство для теста — иначе будет 513 тайлов
GROUPS = ["tgrb", "tgrs", "tgrd", "tgrm", "clrrvr"]


def main():
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 10)
    except Exception:
        font = ImageFont.load_default()

    tile_w = TILE * SCALE
    tile_h = TILE * SCALE + LABEL_H

    # Считаем общее кол-во
    total_tiles = 0
    section_starts = []
    for g in GROUPS:
        files = sorted(SRC.glob(f"{g}*.png"))
        section_starts.append((g, files))
        total_tiles += len(files) + COLS  # + ряд для заголовка

    canvas_h = 0
    for g, files in section_starts:
        rows_in_section = (len(files) + COLS - 1) // COLS
        canvas_h += LABEL_H + 6 + rows_in_section * tile_h + 8
    canvas_w = COLS * tile_w

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (30, 30, 30, 255))
    draw = ImageDraw.Draw(canvas)

    y = 0
    for g, files in section_starts:
        # Заголовок секции
        draw.rectangle([0, y, canvas_w, y + LABEL_H + 4], fill=(60, 60, 90, 255))
        draw.text((6, y + 2), f"=== {g} ({len(files)} tiles) ===", fill=(255, 255, 200, 255), font=font)
        y += LABEL_H + 6

        for i, f in enumerate(files):
            col = i % COLS
            row = i // COLS
            x = col * tile_w
            ty = y + row * tile_h

            try:
                img = Image.open(f).convert("RGBA").resize((tile_w, tile_h - LABEL_H), Image.NEAREST)
            except Exception as e:
                continue
            canvas.paste(img, (x, ty))
            # Подпись имени файла
            draw.rectangle([x, ty + tile_h - LABEL_H, x + tile_w, ty + tile_h], fill=(0, 0, 0, 200))
            draw.text((x + 2, ty + tile_h - LABEL_H + 1), f.stem, fill=(220, 220, 220, 255), font=font)

        rows_in_section = (len(files) + COLS - 1) // COLS
        y += rows_in_section * tile_h + 8

    canvas.save(OUT, optimize=True)
    print(f"✓ {OUT}  ({canvas.size[0]}x{canvas.size[1]})")


if __name__ == "__main__":
    main()
