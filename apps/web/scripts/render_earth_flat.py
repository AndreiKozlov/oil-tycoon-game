#!/usr/bin/env python3
"""
Плоская мульт-карта Земли (НЕ изометрическая) — стиль миникарты Polytopia.

Что:
  • Сетка 120×60 = 7 200 ячеек. Каждая = квадрат 32×32 px.
  • Итог: PNG 3840×1920 px, ~1-2 MB.
  • Каждая ячейка — заливка одним мульт-цветом (никаких градиентов, теней,
    объёма). Это «фишечная» карта: ячейка читается мгновенно.
  • Континенты узнаваемые (Африка, Евразия, Америки) — даунсемплим biome_map
    192×96 → 120×60 голосованием.
  • Опциональная сетка-границы тонкими линиями: рисуется во фронте, не в PNG.

Зачем плоская, а не изометрия:
  • «1 ячейка = 1 покупаемый участок» — игроку нужно видеть КОНКРЕТНЫЕ
    клетки, не размытый ландшафт.
  • Изометрия — это для содержимого клетки (когда внутри будет вышка,
    город и т.п.). Сама карта остаётся плоской миникартой.
"""
from pathlib import Path
from PIL import Image
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
OUT = ROOT / "public/tiles/earth_flat.png"
OUT_THUMB = ROOT / "public/tiles/earth_flat_thumb.png"

# Размер игровой сетки.
GRID_W = 120
GRID_H = 60
# Размер одной ячейки в финальном PNG.
CELL_PX = 32

# Цвета биомов — мульт-палитра, насыщенные но не кричащие.
BIOME_COLORS = {
    "deep_water":    (54, 122, 196, 255),   # океан
    "shallow_water": (115, 198, 222, 255),  # мелководье
    "grass":         (102, 173, 84, 255),   # трава
    "sand":          (235, 200, 115, 255),  # пустыня/песок
    "dirt":          (159, 113, 70, 255),   # горы/земля
    "snow":          (236, 240, 244, 255),  # снег/лёд
}

# Цвета biome_map (из make_biome_map.py).
SRC_COLORS = {
    "deep_water":    (35,  90, 170),
    "shallow_water": (110, 190, 220),
    "grass":         (80, 165,  75),
    "sand":          (235, 205, 105),
    "dirt":          (140,  95,  55),
    "snow":          (240, 245, 250),
}


def nearest_biome(rgb):
    best, bd = None, 10**9
    for b, c in SRC_COLORS.items():
        d = (c[0]-rgb[0])**2 + (c[1]-rgb[1])**2 + (c[2]-rgb[2])**2
        if d < bd:
            bd, best = d, b
    return best


def main():
    src = Image.open(BIOME_MAP).convert("RGB")
    BW, BH = src.size
    bp = src.load()
    print(f"source biome_map {BW}×{BH}")

    sx_step = BW / GRID_W
    sy_step = BH / GRID_H
    print(f"downsample to {GRID_W}×{GRID_H} (each cell sees {sx_step:.2f}×{sy_step:.2f} src pixels)")

    canvas = Image.new("RGBA", (GRID_W * CELL_PX, GRID_H * CELL_PX), (0, 0, 0, 0))
    px = canvas.load()

    # Для каждой логической клетки находим доминирующий биом окна biome_map
    # и заливаем им квадрат CELL_PX×CELL_PX.
    for gy in range(GRID_H):
        y0 = int(gy * sy_step)
        y1 = max(y0 + 1, int((gy + 1) * sy_step))
        for gx in range(GRID_W):
            x0 = int(gx * sx_step)
            x1 = max(x0 + 1, int((gx + 1) * sx_step))
            counts = Counter()
            for y in range(y0, y1):
                for x in range(x0, x1):
                    counts[nearest_biome(bp[x, y])] += 1
            biome, _ = counts.most_common(1)[0]
            color = BIOME_COLORS[biome]
            # заливаем квадрат
            for cy in range(gy * CELL_PX, (gy + 1) * CELL_PX):
                for cx in range(gx * CELL_PX, (gx + 1) * CELL_PX):
                    px[cx, cy] = color

    canvas.save(OUT, optimize=True)
    print(f"✓ {OUT} ({canvas.size}, {OUT.stat().st_size//1024} KB)")

    # Thumb для проверки
    t = canvas.copy()
    t.thumbnail((1200, 600), Image.LANCZOS)
    t.save(OUT_THUMB)
    print(f"✓ thumb {OUT_THUMB} ({t.size})")


if __name__ == "__main__":
    main()
