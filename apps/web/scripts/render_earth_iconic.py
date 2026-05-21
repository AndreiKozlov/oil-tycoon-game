#!/usr/bin/env python3
"""
render_earth_iconic.py — плоская мульт-карта Земли с иконками в клетках.

Township-style minimap:
  • 48×24 = 1152 ячейки. Cell 128×128 px → итог 6144×3072.
  • Каждая ячейка = пастельная заливка биомом + лёгкая «фишечная» подложка
    (мягкий ромб) + векторная cartoon-иконка биома по центру.
  • Без 3D-стенок, без теней, без объёма. Чистый flat strategy minimap стиль.
  • Иконки рисуются PIL.Draw (треугольники гор, круги-кроны деревьев,
    волны воды, кристаллы льда, песчаные холмики). Без внешних шрифтов/SVG.

Цвета:
  океан       — мягкий синий
  мелководье  — бирюзовый
  трава       — пастельный зелёный
  песок       — тёплый светло-жёлтый
  горы        — пастельный коричневый
  снег        — холодный белый
"""
from pathlib import Path
from PIL import Image, ImageDraw
from collections import Counter
import math

ROOT = Path(__file__).resolve().parent.parent
BIOME_MAP = ROOT / "public/tiles/biome_map.png"
OUT = ROOT / "public/tiles/earth_iconic.png"
OUT_THUMB = ROOT / "public/tiles/earth_iconic_thumb.png"

GRID_W = 48
GRID_H = 24
CELL_PX = 128

# Базовый цвет ячейки (плоская заливка)
BIOME_BASE = {
    "deep_water":    (76, 138, 200),
    "shallow_water": (130, 200, 220),
    "grass":         (132, 188, 102),
    "sand":          (240, 210, 130),
    "dirt":          (175, 130, 90),
    "snow":          (236, 240, 244),
}
# Цвет «фишечной» ромбовидной подложки (чуть темнее/светлее базы)
BIOME_DISC = {
    "deep_water":    (62, 122, 184),
    "shallow_water": (105, 180, 205),
    "grass":         (110, 168, 80),
    "sand":          (224, 192, 110),
    "dirt":          (152, 110, 72),
    "snow":          (220, 226, 235),
}
# Цвет иконки в центре
BIOME_ICON = {
    "deep_water":    (255, 255, 255, 175),   # белые волны
    "shallow_water": (255, 255, 255, 215),
    "grass":         (62, 122, 50),          # тёмный куст
    "sand":          (200, 160, 80),         # дюна
    "dirt":          (90, 60, 40),           # гора
    "snow":          (180, 200, 220),        # снежинка/кристалл
}

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


def draw_rhombus_disc(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int, h: int, color):
    """Мягкий ромб — фишечная подложка."""
    pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
    draw.polygon(pts, fill=color)


def draw_icon_grass(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Кустик: 3 эллипса разной высоты + ствол."""
    # ствол
    d.rectangle([cx - s // 18, cy + s // 6, cx + s // 18, cy + s // 3], fill=(80, 55, 30))
    # три кроны: высокая центральная + две по бокам
    r = s // 4
    d.ellipse([cx - r, cy - r * 2 + s // 8, cx + r, cy + s // 8], fill=color)
    d.ellipse([cx - r - s // 5, cy - r + s // 8, cx + s // 5 - r, cy + r + s // 8], fill=color)
    d.ellipse([cx + r - s // 5, cy - r + s // 8, cx + r + s // 5, cy + r + s // 8], fill=color)


def draw_icon_dirt(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Гора: треугольник + второй пик поменьше + снежная шапка."""
    h = s // 2
    w = s // 2
    # большая гора
    big = [(cx, cy - h), (cx + w, cy + h // 2), (cx - w, cy + h // 2)]
    d.polygon(big, fill=color)
    # маленькая правее
    sw = s // 3
    sh = s // 3
    small = [(cx + s // 5, cy - sh + s // 8),
             (cx + s // 5 + sw, cy + h // 2),
             (cx + s // 5 - sw, cy + h // 2)]
    d.polygon(small, fill=color)
    # снежная шапка
    cap = [(cx, cy - h), (cx + s // 6, cy - h // 2), (cx - s // 6, cy - h // 2)]
    d.polygon(cap, fill=(245, 248, 252))


def draw_icon_sand(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Дюна: две волны (полукруг + полукруг ниже)."""
    r = s // 3
    # большая дюна
    d.chord([cx - r, cy - r // 2, cx + r, cy + r * 3 // 2], 180, 360, fill=color)
    # маленькая слева
    r2 = s // 5
    d.chord([cx - r - r2, cy + s // 12, cx - r + r2, cy + s // 12 + r2 * 2],
            180, 360, fill=color)
    # маленькая справа
    d.chord([cx + r - r2, cy + s // 12, cx + r + r2, cy + s // 12 + r2 * 2],
            180, 360, fill=color)


def draw_icon_deep_water(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Две тонкие волны."""
    w = s // 2
    # верхняя
    pts1 = []
    for i in range(0, w + 1, 2):
        x = cx - w // 2 + i
        y = cy - s // 8 + math.sin(i / w * 2 * math.pi) * (s // 22)
        pts1.append((x, y))
    # нижняя
    pts2 = []
    for i in range(0, w + 1, 2):
        x = cx - w // 2 + i
        y = cy + s // 6 + math.sin(i / w * 2 * math.pi + math.pi) * (s // 22)
        pts2.append((x, y))
    for pts in (pts1, pts2):
        for k in range(len(pts) - 1):
            d.line([pts[k], pts[k + 1]], fill=color, width=max(2, s // 32))


def draw_icon_shallow_water(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Песочный полумесяц у воды + лёгкая волна."""
    # пляжная полоса
    r = s // 3
    d.chord([cx - r, cy, cx + r, cy + r * 2 - s // 8], 0, 180,
            fill=(240, 220, 160, 220))
    # волна сверху
    w = s // 2
    pts = []
    for i in range(0, w + 1, 2):
        x = cx - w // 2 + i
        y = cy - s // 4 + math.sin(i / w * 2 * math.pi) * (s // 24)
        pts.append((x, y))
    for k in range(len(pts) - 1):
        d.line([pts[k], pts[k + 1]], fill=color, width=max(2, s // 32))


def draw_icon_snow(d: ImageDraw.ImageDraw, cx, cy, s, color):
    """Снежинка: 6 лучей."""
    r = s // 3
    for i in range(6):
        a = i * math.pi / 3
        x2 = cx + math.cos(a) * r
        y2 = cy + math.sin(a) * r
        d.line([(cx, cy), (x2, y2)], fill=color, width=max(2, s // 28))
        # лапки
        for sign in (-1, 1):
            x3 = cx + math.cos(a) * r * 0.65
            y3 = cy + math.sin(a) * r * 0.65
            x4 = x3 + math.cos(a + sign * math.pi / 3) * r * 0.3
            y4 = y3 + math.sin(a + sign * math.pi / 3) * r * 0.3
            d.line([(x3, y3), (x4, y4)], fill=color, width=max(2, s // 32))


ICON_DRAWERS = {
    "grass":         draw_icon_grass,
    "dirt":          draw_icon_dirt,
    "sand":          draw_icon_sand,
    "deep_water":    draw_icon_deep_water,
    "shallow_water": draw_icon_shallow_water,
    "snow":          draw_icon_snow,
}


def render_cell(biome: str, size: int) -> Image.Image:
    """Возвращает одну ячейку: фон + ромб + иконка."""
    img = Image.new("RGBA", (size, size), BIOME_BASE[biome] + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = size // 2, size // 2
    # фишечная ромбовидная подложка ~80% клетки
    draw_rhombus_disc(d, cx, cy, int(size * 0.86), int(size * 0.66), BIOME_DISC[biome])
    # иконка ~50% клетки в центре
    draw_iconic = ICON_DRAWERS[biome]
    draw_iconic(d, cx, cy, int(size * 0.55), BIOME_ICON[biome])
    return img


def main():
    src = Image.open(BIOME_MAP).convert("RGB")
    BW, BH = src.size
    bp = src.load()
    print(f"biome_map {BW}×{BH}, grid {GRID_W}×{GRID_H}, cell {CELL_PX}")

    # Кэшируем pre-rendered cells per biome (одни и те же — копируем).
    cells = {b: render_cell(b, CELL_PX) for b in BIOME_BASE}

    canvas = Image.new("RGBA", (GRID_W * CELL_PX, GRID_H * CELL_PX), (0, 0, 0, 0))

    sx_step = BW / GRID_W
    sy_step = BH / GRID_H

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
            canvas.paste(cells[biome], (gx * CELL_PX, gy * CELL_PX))

    canvas.save(OUT, optimize=True)
    print(f"✓ {OUT} {canvas.size} {OUT.stat().st_size // 1024} KB")

    t = canvas.copy()
    t.thumbnail((1400, 700), Image.LANCZOS)
    t.save(OUT_THUMB)
    print(f"✓ thumb {OUT_THUMB} {t.size}")


if __name__ == "__main__":
    main()
