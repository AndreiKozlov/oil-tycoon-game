#!/usr/bin/env python3
"""
Тест-паттерн для визуальной проверки стыковки.

Для каждой группы биома (t**b + t**d + t**s + t**m) строит test-pattern:
большое поле случайных base-вариантов в центре + рамка из transition-тайлов
по 4 предполагаемым ориентациям wang-сетки.

Выход: public/tiles/atlas_test.png — наглядное полотно для глаза.
"""

import re
import random
from pathlib import Path
from collections import defaultdict
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/bg"
OUT = ROOT / "public/tiles/atlas_test.png"

# Биомные группы
BIOMES = ["tgr", "tro", "tsn", "tsa", "tsu", "tsw", "tvl"]

NAME_RE = re.compile(r"^([a-z]+)(\d+)\.png$", re.IGNORECASE)


def load_group(prefix):
    """Возвращает dict (row,col)->Image для группы prefix."""
    files = sorted(SRC.glob(f"{prefix}*.png"))
    by_pos = {}
    for f in files:
        m = NAME_RE.match(f.name)
        if not m or m.group(1) != prefix:
            continue
        d = m.group(2)
        last_digits = [int(c) for c in d]
        # Эвристика та же что в build_atlas: если последняя цифра ≤ 7, col=last, row=prev
        if last_digits[-1] <= 7:
            row = int(d[:-1] or "0")
            col = int(d[-1])
        else:
            row = int(d[:-2] or "0")
            col = int(d[-2:])
        by_pos[(row, col)] = Image.open(f).convert("RGBA")
    return by_pos


def random_pick(group, prefix_filter_row=None):
    """Случайный тайл из группы (опционально из конкретной строки)."""
    if prefix_filter_row is not None:
        cand = [(p, im) for p, im in group.items() if p[0] == prefix_filter_row]
        if not cand:
            return None
        return random.choice(cand)[1]
    return random.choice(list(group.values()))


def render_section(biome_prefix, w_tiles=16, h_tiles=10):
    """Рендерит одну секцию для биома: base-fill центр + рамка transitions.

    Раскладка:
      row 0: подпись (пусто, заполним текстом снаружи)
      далее: 8×16 поле base-тайлов
      далее: ряды по 4 — варианты transition'ов всех групп (s/d/m), для глаза.
    """
    sec = Image.new("RGBA", (w_tiles * TILE, h_tiles * TILE), (40, 40, 40, 255))

    b_group = load_group(biome_prefix + "b")
    s_group = load_group(biome_prefix + "s")
    d_group = load_group(biome_prefix + "d")
    m_group = load_group(biome_prefix + "m")

    if not b_group:
        return sec

    # Верх (4 строки) — случайный base-fill (имитирует большой однородный биом)
    rnd = random.Random(hash(biome_prefix) & 0xFFFFFFFF)
    for y in range(4):
        for x in range(w_tiles):
            tile = rnd.choice(list(b_group.values()))
            sec.paste(tile, (x * TILE, y * TILE))

    # Строка 4 — все варианты transition s (по строкам 0..N)
    if s_group:
        for x in range(min(w_tiles, len(s_group))):
            keys = sorted(s_group.keys())
            tile = s_group[keys[x % len(keys)]]
            sec.paste(tile, (x * TILE, 4 * TILE))

    # Строка 5 — все варианты transition d
    if d_group:
        for x in range(min(w_tiles, len(d_group))):
            keys = sorted(d_group.keys())
            tile = d_group[keys[x % len(keys)]]
            sec.paste(tile, (x * TILE, 5 * TILE))

    # Строка 6 — все варианты transition m
    if m_group:
        for x in range(min(w_tiles, len(m_group))):
            keys = sorted(m_group.keys())
            tile = m_group[keys[x % len(keys)]]
            sec.paste(tile, (x * TILE, 6 * TILE))

    # Строки 7-9 — попытка собрать поле 4×4 wang-блоком (берём s_group по (row,col))
    # Это покажет, является ли группа корректным wang-сетом 4×4
    if s_group:
        rows = sorted(set(r for r, c in s_group.keys()))
        cols = sorted(set(c for r, c in s_group.keys()))
        for ry, r in enumerate(rows[:3]):
            for cx, c in enumerate(cols[:w_tiles]):
                tile = s_group.get((r, c))
                if tile:
                    sec.paste(tile, (cx * TILE, (7 + ry) * TILE))

    return sec


def main():
    cols_per_section = 16
    rows_per_section = 10
    sections = []
    for biome in BIOMES:
        sections.append((biome, render_section(biome, cols_per_section, rows_per_section)))

    # Стэкаем вертикально с 2-tile зазором между секциями
    gap = 2 * TILE
    total_w = cols_per_section * TILE
    total_h = sum(s[1].height for s in sections) + gap * (len(sections) - 1)
    canvas = Image.new("RGBA", (total_w, total_h), (20, 20, 20, 255))

    y = 0
    for biome, sec in sections:
        canvas.paste(sec, (0, y))
        y += sec.height + gap

    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})")


if __name__ == "__main__":
    main()
