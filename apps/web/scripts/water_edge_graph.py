#!/usr/bin/env python3
"""
Найти подмножество WWWW-тайлов, которые ВЗАИМНО стыкуются пиксельно.

Для каждой пары WWWW-тайлов считаем точное совпадение кромок:
  right(A) == left(B) — горизонтальный стык
  bottom(A) == top(B) — вертикальный стык

Также проверяем self-stitch: right(A) == left(A) (тайл стыкуется сам с собой,
типичный признак seamless tile).
"""
import hashlib
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/bg"


def edge(img, side):
    px = img.load()
    if side == "top":
        return [px[x, 0] for x in range(TILE)]
    if side == "bottom":
        return [px[x, TILE - 1] for x in range(TILE)]
    if side == "left":
        return [px[0, y] for y in range(TILE)]
    if side == "right":
        return [px[TILE - 1, y] for y in range(TILE)]


def edge_hash(e):
    flat = bytes(c for p in e for c in (p if isinstance(p, tuple) else (p,)))
    return hashlib.md5(flat).hexdigest()[:12]


def main():
    # Все watrtl* → классифицируем как WWWW (по предыдущему отчёту: 19 файлов)
    wwww_files = []
    for f in sorted(SRC.glob("watrtl*.png")):
        img = Image.open(f).convert("RGBA")
        # Простая проверка: средний цвет центра 8×8
        px = img.load()
        rs = gs = bs = 0
        n = 0
        for y in range(12, 20):
            for x in range(12, 20):
                p = px[x, y]
                rs += p[0]; gs += p[1]; bs += p[2]; n += 1
        rs /= n; gs /= n; bs /= n
        # вода: синий доминирует
        if bs > rs and bs > gs:
            wwww_files.append(f)
    print(f"WWWW candidates: {len(wwww_files)}")
    for f in wwww_files:
        print(f"  {f.name}")

    # Edges для всех
    tiles = {}
    for f in wwww_files:
        img = Image.open(f).convert("RGBA")
        tiles[f.name] = {
            "img": img,
            "top": edge_hash(edge(img, "top")),
            "bottom": edge_hash(edge(img, "bottom")),
            "left": edge_hash(edge(img, "left")),
            "right": edge_hash(edge(img, "right")),
        }

    # Self-stitch: right == left (tile тайлится сам с собой по горизонтали)
    print("\n=== Self-stitching tiles ===")
    self_h = []
    self_v = []
    for name, e in tiles.items():
        h_match = e["right"] == e["left"]
        v_match = e["bottom"] == e["top"]
        if h_match and v_match:
            print(f"  ✓ {name}  H+V seamless")
            self_h.append(name)
            self_v.append(name)
        elif h_match:
            print(f"  H-only  {name}")
            self_h.append(name)
        elif v_match:
            print(f"  V-only  {name}")
            self_v.append(name)

    # Группы по совпадающим кромкам
    print("\n=== Tiles grouped by right-edge signature ===")
    by_right = defaultdict(list)
    for name, e in tiles.items():
        by_right[e["right"]].append(name)
    for sig, names in by_right.items():
        if len(names) > 1:
            print(f"  right={sig}: {names}")

    print("\n=== Tiles grouped by left-edge signature ===")
    by_left = defaultdict(list)
    for name, e in tiles.items():
        by_left[e["left"]].append(name)
    for sig, names in by_left.items():
        if len(names) > 1:
            print(f"  left={sig}: {names}")

    # Cross-stitch: какие пары A→B имеют right(A) == left(B)
    print("\n=== Cross-stitch pairs (right(A) == left(B)) ===")
    pairs = []
    for a, ea in tiles.items():
        for b, eb in tiles.items():
            if ea["right"] == eb["left"]:
                pairs.append((a, b))
    print(f"Total pairs: {len(pairs)}")
    for a, b in pairs[:20]:
        print(f"  {a} → {b}")


if __name__ == "__main__":
    main()
