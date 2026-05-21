#!/usr/bin/env python3
"""
Накладывает разные изометрические сетки на newtile.png и сохраняет 3 PNG
для визуальной проверки.

Изометрическая сетка: ромбы шириной W и высотой H=W/2. Шахматный порядок:
  чётные строки   — ромбы в позициях (0, H/2), (W, H/2), (2W, H/2)...
  нечётные строки — ромбы со смещением (W/2, 0), (3W/2, 0), (5W/2, 0)...

Грани ромба:
  Top vertex     (W/2, 0)
  Right vertex   (W,   H/2)
  Bottom vertex  (W/2, H)
  Left vertex    (0,   H/2)

Я рисую жёлтые линии по граням ромбов поверх картинки.
"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/root/oil_tycoon_project/newtile.png")


def overlay_grid(src_img, rhomb_w, rhomb_h, color=(255, 230, 0, 200)):
    """Нарисовать сетку изо-ромбов поверх src_img."""
    img = src_img.copy()
    draw = ImageDraw.Draw(img)
    W, H = img.size

    # Изометрия: ромбы расположены в шахматке.
    # У классического iso-tileset ромб (W, H=W/2) рисуется на позиции (x*W + offset, y*H/2),
    # где offset = (W/2) для нечётных y.
    half_w = rhomb_w // 2
    half_h = rhomb_h // 2

    # Чтобы покрыть всю картинку, идём по y с шагом half_h
    y = 0
    row = 0
    while y < H:
        offset = half_w if row % 2 == 1 else 0
        x = offset
        while x < W + rhomb_w:
            # Координаты 4 вершин ромба с центром (x + half_w, y + half_h)
            cx = x
            cy = y
            top    = (cx + half_w, cy)
            right  = (cx + rhomb_w, cy + half_h)
            bottom = (cx + half_w,  cy + rhomb_h)
            left   = (cx, cy + half_h)
            draw.polygon([top, right, bottom, left], outline=color)
            x += rhomb_w
        y += half_h
        row += 1
    return img


def main():
    src = Image.open(SRC).convert("RGBA")
    # Чёрный фон для видимости прозрачных областей
    bg = Image.new("RGBA", src.size, (15, 25, 50, 255))
    bg.alpha_composite(src)

    for w, h in [(32, 16), (64, 32), (128, 64), (256, 128)]:
        out = overlay_grid(bg, w, h)
        path = ROOT / f"public/tiles/iso_grid_{w}x{h}.png"
        out.save(path)
        print(f"✓ {path}")


if __name__ == "__main__":
    main()
