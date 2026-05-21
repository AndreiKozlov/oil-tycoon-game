#!/usr/bin/env python3
"""
Тестовая генерация карты по VCMI-правилам выбора terrain tile.

VCMI правила (config/terrainViewPatterns.json):
  Для каждой клетки смотрим 3×3 окно соседей. Перебираем 26 паттернов по
  порядку. Каждая ячейка паттерна — правило ("N"/"D"/"S"/"T"/"?"), которое
  тестируется относительно текущего биома. Первый matching паттерн → его
  mapping даёт диапазон индексов в спрайте terrain. Берём случайный из них.

Наш набор тайлов (из public/tiles/raw/bg/):
  tgrb (24 шт)  → VCMI "normal" mapping для "n1" (pattern N×9): индексы 49..72
                  ⇒ это decorative base — чистая трава, варианты.
  tgrs (20 шт)  → s1/s2/s3 standard transitions
  tgrd (20 шт)  → s4/s5/s6/s7 (другие стороны)
  tgrm (15 шт)  → m1..m8 (mixed/диагональные углы)

Для теста: генерируем карту 16×16 биомов из 2 типов: 'grass' (N=tgr) и
'dirt' (бросаемся в группу trdg/trdd как aux). Каждой клетке проставляем
правильный VCMI tile и рендерим PNG.
"""

import json
import re
import random
from pathlib import Path
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/bg"
PATTERNS_FILE = Path("/tmp/vcmi_patterns.json")
OUT = ROOT / "public/tiles/atlas_vcmi_test.png"

NAME_RE = re.compile(r"^([a-z]+)(\d+)\.png$", re.IGNORECASE)


def load_group(prefix):
    """Возвращает list of (idx_in_group, PIL.Image), индекс = порядковый номер."""
    files = sorted(SRC.glob(f"{prefix}*.png"))
    out = []
    for i, f in enumerate(files):
        m = NAME_RE.match(f.name)
        if m and m.group(1) == prefix:
            out.append(Image.open(f).convert("RGBA"))
    return out


def parse_index_range(spec):
    """'49-56,57-72' -> [49,50,...,72]. '40, 42' -> [40,42]. '20' -> [20]."""
    indices = []
    for part in spec.replace(" ", "").split(","):
        if "-" in part:
            a, b = part.split("-")
            # Префикс '2D:' / '4D:' в правилах для rock — игнорируем
            if ":" in a:
                a = a.split(":")[1]
            indices.extend(range(int(a), int(b) + 1))
        else:
            if ":" in part:
                part = part.split(":")[1]
            indices.append(int(part))
    return indices


def load_patterns():
    """Стрипает JSON-комменты, загружает паттерны."""
    text = PATTERNS_FILE.read_text(encoding="utf-8")
    # Удалить //-комментарии
    text = re.sub(r"//.*", "", text)
    data = json.loads(text)
    return data["terrainView"]


def rule_matches(rule_str, neighbor_biome, center_biome):
    """
    rule_str: например "N", "D", "S", "T", "?", "D,N", "D-1,N", "s2-1,m7-1,..."
    Для нашего теста интересуют только базовые: N, D, S, T, ?.
    Игнорируем pattern-references (s2-1) и пункты с очками — это для сложных правил.
    """
    # Берём первую опцию (через запятую), если есть несколько
    options = [o.strip() for o in rule_str.split(",")]
    # Уберём points (-N в конце)
    options = [o.split("-")[0] for o in options]
    # Уберём pattern-references типа "s2", "m7", "x1"
    options = [o for o in options if o in ("N", "D", "S", "T", "?", "N!")]
    if not options:
        return True  # это сложное правило, считаем "матч" (упрощение)

    for opt in options:
        if opt == "?":
            return True
        if opt in ("N", "N!"):
            if neighbor_biome == center_biome:
                return True
        if opt == "D":
            if neighbor_biome == "dirt":
                return True
        if opt == "S":
            if neighbor_biome == "sand":
                return True
        if opt == "T":
            # T = either D or S
            if neighbor_biome in ("dirt", "sand"):
                return True
    return False


def pattern_matches(pat, neighbors_3x3, center_biome):
    """Проверяет, подходит ли паттерн (9 правил) для 3×3 окна neighbors."""
    for i, rule in enumerate(pat["data"]):
        if not rule_matches(rule, neighbors_3x3[i], center_biome):
            return False
    return True


def get_tile_for_cell(biome_map, x, y, patterns, biome_category):
    """
    biome_map: 2D list биомов; biome_category — какой mapping брать ('normal'/'dirt'/'sand').
    Возвращает (pattern_id, tile_index).
    """
    h = len(biome_map)
    w = len(biome_map[0])
    center = biome_map[y][x]

    # Собрать 3×3 окно соседей (за пределами карты — own biome)
    neighbors = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                neighbors.append(biome_map[ny][nx])
            else:
                neighbors.append(center)

    for pat in patterns:
        if biome_category not in pat["mapping"]:
            continue
        if pattern_matches(pat, neighbors, center):
            indices = parse_index_range(pat["mapping"][biome_category])
            return pat["id"], random.choice(indices)
    return None, None


def main():
    random.seed(42)
    patterns = load_patterns()

    # Загружаем все возможные тайлы для grass biome
    # tgrb (n1: 49-72), tgrs (s1: 20-23, s2: 4-7, s3: 8-11, s4: 12-15, s5: 16-17, s6: 18-19),
    # tgrd (s7: 0-3 + расширения), tgrm (m1..m8: 40-48, x1..x5: 73-78)
    #
    # Heroes 3 grass terrain содержит ~79 индексов (0..78). У нас 24+20+20+15=79 тайлов в
    # сумме для grass-семьи (tgrb+tgrs+tgrd+tgrm). Маппим по диапазонам:
    #   индексы  0-19  → tgrs (20 шт)  — s1/s2/s3 standard
    #   индексы 20-39  → tgrd (20 шт)  — s4/s5/s6/s7 standard (+ extra)
    #   индексы 40-48  → tgrm[0..8]    — mixed m1..m8 (9 шт)
    #   индексы 49-72  → tgrb (24 шт)  — base n1
    #   индексы 73-78  → tgrm[9..14]   — extended x1..x5 (6 шт)
    tgrs = load_group("tgrs")
    tgrd = load_group("tgrd")
    tgrm = load_group("tgrm")
    tgrb = load_group("tgrb")

    def grass_tile_by_vcmi_index(idx):
        if 0 <= idx <= 19 and idx < len(tgrs):
            return tgrs[idx]
        if 20 <= idx <= 39 and idx - 20 < len(tgrd):
            return tgrd[idx - 20]
        if 40 <= idx <= 48 and idx - 40 < len(tgrm):
            return tgrm[idx - 40]
        if 49 <= idx <= 72 and idx - 49 < len(tgrb):
            return tgrb[idx - 49]
        if 73 <= idx <= 78:
            # Extended — могут быть в хвосте tgrm
            offset = 9 + (idx - 73)
            if offset < len(tgrm):
                return tgrm[offset]
        # fallback
        return tgrb[0] if tgrb else None

    # --- Карта 16×16: круг травы внутри океана грязи ---
    W, H = 16, 16
    cx, cy = W / 2, H / 2
    biome_map = []
    for y in range(H):
        row = []
        for x in range(W):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            row.append("grass" if dist < 5 else "dirt")
        biome_map.append(row)

    # --- Рендер ---
    canvas = Image.new("RGBA", (W * TILE, H * TILE), (20, 20, 20, 255))

    # Для статистики какие паттерны выбрались
    stats = {}

    for y in range(H):
        for x in range(W):
            biome = biome_map[y][x]
            if biome == "grass":
                pat_id, idx = get_tile_for_cell(biome_map, x, y, patterns, "normal")
                stats[pat_id] = stats.get(pat_id, 0) + 1
                if idx is not None:
                    tile = grass_tile_by_vcmi_index(idx)
                    if tile:
                        canvas.paste(tile, (x * TILE, y * TILE))
            else:
                # dirt — рисуем простым плоским цветом, чтобы фокус был на стыковке grass
                from PIL import ImageDraw
                ImageDraw.Draw(canvas).rectangle(
                    [x * TILE, y * TILE, (x + 1) * TILE - 1, (y + 1) * TILE - 1],
                    fill=(110, 80, 50, 255),
                )

    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})")
    print("\nPattern usage stats:")
    for pid, cnt in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {pid}: {cnt}")


if __name__ == "__main__":
    main()
