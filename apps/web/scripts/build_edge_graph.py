#!/usr/bin/env python3
"""
ТОЧНОЕ построение графа стыковки тайлов.

Идея: тайл A можно поставить ЛЕВЕЕ тайла B по горизонтали тогда и только тогда,
когда right_edge(A) совпадает с left_edge(B). Это математически проверяемо
пиксель-в-пиксель.

  edge_right(A)[y] = pixel at (31, y) for y=0..31
  edge_left(B)[y]  = pixel at (0,  y) for y=0..31

Если edge_right(A) == edge_left(B) — стык идеален.

Алгоритм:
  1. Перебрать все тайлы из public/tiles/raw/tilemap (это малый набор:
     tdtb/tdtm/tdts/tgrb/tgrd/tgrm/clrrvr — всё для травы/грязи/реки).
  2. Для каждого тайла вычислить 4 edge-сигнатуры: top, bottom, left, right.
  3. Сгруппировать тайлы по edge-сигнатурам: edges_index[sig] = [tile_names]
  4. Для каждой пары (A, B) проверить:
       horizontal_match(A, B) = (right_sig(A) == left_sig(B))
       vertical_match(A, B)   = (bottom_sig(A) == top_sig(B))
  5. Сохранить edge_graph.json:
       {
         "tiles": [tile_name, ...],
         "edges": { tile_name: {top, bottom, left, right} },
         "edge_groups": { signature: [tile_names that share this signature] }
       }

Зная edge_groups, рендерер для клетки решает:
  - какой тайл уже стоит слева → его right_sig известен → беру тайл из
    edge_groups[right_sig] (т.е. с тем же left_sig).
  - аналогично сверху.

Это гарантирует ИДЕАЛЬНУЮ стыковку.
"""
import json
import hashlib
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/tiles/raw/tilemap"  # тот самый набор с tdtb/tgrb/...
OUT_JSON = ROOT / "public/tiles/edge_graph.json"
OUT_REPORT = ROOT / "public/tiles/edge_graph_report.txt"


def edge_sig(img, side):
    """32-pixel edge → 12-char md5 hash. Точное совпадение хешей = точное совпадение пикселей."""
    px = img.load()
    w, h = img.size
    pixels = []
    if side == "top":
        for x in range(w):
            pixels.append(px[x, 0])
    elif side == "bottom":
        for x in range(w):
            pixels.append(px[x, h - 1])
    elif side == "left":
        for y in range(h):
            pixels.append(px[0, y])
    elif side == "right":
        for y in range(h):
            pixels.append(px[w - 1, y])
    # Уплощаем в байты
    flat = bytes(c for p in pixels for c in (p if isinstance(p, tuple) else (p,)))
    return hashlib.md5(flat).hexdigest()[:12]


def main():
    files = sorted(SRC.glob("*.png"))
    tiles = {}
    edges = {}
    for f in files:
        img = Image.open(f).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        tiles[f.name] = img
        edges[f.name] = {
            "top":    edge_sig(img, "top"),
            "bottom": edge_sig(img, "bottom"),
            "left":   edge_sig(img, "left"),
            "right":  edge_sig(img, "right"),
        }

    # Группировка по сигнатуре каждой стороны
    sig_to_tiles = {
        "top": defaultdict(list),
        "bottom": defaultdict(list),
        "left": defaultdict(list),
        "right": defaultdict(list),
    }
    for name, e in edges.items():
        for side, sig in e.items():
            sig_to_tiles[side][sig].append(name)

    # Найдём точные горизонтальные пары: right(A) == left(B)
    # Это значит: A→B клеится по горизонтали.
    h_pairs = []  # (A, B)
    for name_a, ea in edges.items():
        # Все тайлы у которых left == right(A)
        compatible_right = sig_to_tiles["left"].get(ea["right"], [])
        for name_b in compatible_right:
            h_pairs.append((name_a, name_b))

    v_pairs = []
    for name_a, ea in edges.items():
        compatible_below = sig_to_tiles["top"].get(ea["bottom"], [])
        for name_b in compatible_below:
            v_pairs.append((name_a, name_b))

    # Запись
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({
        "tile_size": TILE,
        "tiles": sorted(tiles.keys()),
        "edges": edges,
        "by_left":   {k: sorted(v) for k, v in sig_to_tiles["left"].items()},
        "by_right":  {k: sorted(v) for k, v in sig_to_tiles["right"].items()},
        "by_top":    {k: sorted(v) for k, v in sig_to_tiles["top"].items()},
        "by_bottom": {k: sorted(v) for k, v in sig_to_tiles["bottom"].items()},
    }, indent=2), encoding="utf-8")

    # Отчёт
    lines = []
    lines.append(f"# Edge graph report ({len(tiles)} tiles, {TILE}×{TILE})")
    lines.append(f"Unique edge signatures:")
    for side in ("top", "bottom", "left", "right"):
        groups = sig_to_tiles[side]
        sizes = sorted([len(v) for v in groups.values()], reverse=True)
        lines.append(f"  {side}: {len(groups)} unique signatures, sizes top-5: {sizes[:5]}")
    lines.append("")
    lines.append(f"Total possible horizontal stitches (A→B with right(A)==left(B)): {len(h_pairs)}")
    lines.append(f"Total possible vertical stitches   (A↓B with bottom(A)==top(B)): {len(v_pairs)}")
    lines.append("")

    # Покажем для каждого тайла сколько у него стыковок справа/снизу
    lines.append("## Per-tile stitch capability")
    lines.append("name             right→? below→?")
    for name in sorted(tiles.keys()):
        nr = len(sig_to_tiles["left"].get(edges[name]["right"], []))
        nb = len(sig_to_tiles["top"].get(edges[name]["bottom"], []))
        lines.append(f"  {name:18s} {nr:3d}     {nb:3d}")
    OUT_REPORT.write_text("\n".join(lines), encoding="utf-8")

    print(f"✓ {OUT_JSON}")
    print(f"✓ {OUT_REPORT}")
    print(f"  Tiles: {len(tiles)}")
    print(f"  Horizontal exact stitches: {len(h_pairs)}")
    print(f"  Vertical   exact stitches: {len(v_pairs)}")
    # Если стыков много (>500) — значит набор хорошо подобран, можно строить карту.
    # Если стыков 0 — у тайлов не совпадают кромки даже у дубликатов.


if __name__ == "__main__":
    main()
