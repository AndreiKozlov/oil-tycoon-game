#!/usr/bin/env python3
"""
Сборка PNG-атласа тайлов из public/tiles/raw/bg/*.png.

Логика:
  1. Группируем все тайлы по префиксу (имя без хвостовых цифр).
  2. Внутри группы суффикс XY (две цифры) трактуем как row=X, col=Y — это даёт
     естественную 4×N или 5×N сетку, заданную самой нумерацией исходных файлов.
  3. Каждая группа кладётся в атлас отдельной "секцией". Секции укладываются
     одна под другой; ширина атласа = max(cols) среди всех групп, дополняем
     прозрачным.
  4. Параллельно считаем edge-сигнатуры (top/bottom/left/right) каждого тайла —
     8-байтные хеши краёв. Это используется для проверки стыковки:
     ─ если right(A) == left(B), пара хорошо стыкуется по горизонтали;
     ─ если bottom(A) == top(B), стыкуется по вертикали.
  5. Пишем:
       public/tiles/atlas.png      — собранный атлас
       public/tiles/atlas.json     — { groups: {prefix: {rows, cols, x, y}}, tiles: [...], edges: {...} }
       public/tiles/atlas_report.txt — найденные проблемы стыковки внутри групп.
"""

import json
import re
import hashlib
from pathlib import Path
from collections import defaultdict
from PIL import Image

TILE_SIZE = 32
ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "public/tiles/raw/bg"
OUT_DIR = ROOT / "public/tiles"
ATLAS_PNG = OUT_DIR / "atlas.png"
ATLAS_JSON = OUT_DIR / "atlas.json"
REPORT_TXT = OUT_DIR / "atlas_report.txt"

# Имя файла: <prefix><digits>.png. Префикс = всё до хвостовых цифр.
NAME_RE = re.compile(r"^([a-z]+)(\d+)\.png$", re.IGNORECASE)


def parse_name(name: str):
    m = NAME_RE.match(name)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def edge_signature(img: Image.Image, side: str) -> str:
    """Хеш пиксельной кромки. Для проверки стыковки: одинаковый хеш = совпадение."""
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
    h_ = hashlib.md5(bytes([c for p in pixels for c in (p if isinstance(p, tuple) else (p,))])).hexdigest()
    return h_[:12]


def edge_pixels(img: Image.Image, side: str):
    """Сырые пиксели кромки — для нечёткой проверки совпадения."""
    px = img.load()
    w, h = img.size
    out = []
    if side == "top":
        out = [px[x, 0] for x in range(w)]
    elif side == "bottom":
        out = [px[x, h - 1] for x in range(w)]
    elif side == "left":
        out = [px[0, y] for y in range(h)]
    elif side == "right":
        out = [px[w - 1, y] for y in range(h)]
    return out


def pixel_dist(a, b) -> float:
    """L2 distance между двумя пикселями (учитываем RGB)."""
    if isinstance(a, int):
        a = (a, a, a)
    if isinstance(b, int):
        b = (b, b, b)
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def edge_match_score(eA, eB) -> float:
    """0..1 — насколько хорошо стыкуются две кромки. 1 = идеал."""
    if len(eA) != len(eB):
        return 0.0
    total = 0.0
    for pa, pb in zip(eA, eB):
        d = pixel_dist(pa, pb)
        # 0 ≤ d ≤ ~441 (sqrt(255^2*3))
        total += max(0.0, 1.0 - d / 80.0)  # 80 → tolerance ~30% per channel
    return total / len(eA)


def main():
    files = sorted(SRC_DIR.glob("*.png"))
    if not files:
        print(f"NO FILES in {SRC_DIR}")
        return

    # Группировка
    groups = defaultdict(list)
    for f in files:
        prefix, digits = parse_name(f.name)
        if prefix is None:
            print(f"skip non-matching name: {f.name}")
            continue
        groups[prefix].append((digits, f))

    # Внутри каждой группы: попытаться разложить по row/col из суффикса.
    # Если все суффиксы 3-значные XYZ → row=X, col=YZ ИЛИ row=XY, col=Z.
    # Эвристика: для каждой группы вычислим max последней цифры (col) — это даст ширину.
    # Если всё ≤ 7 → значит col = последняя цифра, row = предыдущие.
    # Иначе col = последние две, row = первая.
    layout = {}
    for prefix, items in groups.items():
        items.sort(key=lambda x: x[0])
        last_digits = [int(d[-1]) for d, _ in items]
        max_last = max(last_digits)
        if max_last <= 7:
            # col = last digit, row = digits[:-1]
            def split(d):
                return int(d[:-1] or "0"), int(d[-1])
        else:
            # fallback: row=int(d[:-2]), col=int(d[-2:])
            def split(d):
                return int(d[:-2] or "0"), int(d[-2:])
        rows_cols = [(split(d), f) for d, f in items]
        max_row = max(r for (r, _), _ in rows_cols)
        max_col = max(c for (_, c), _ in rows_cols)
        layout[prefix] = {
            "rows": max_row + 1,
            "cols": max_col + 1,
            "files": rows_cols,
        }

    # Размер атласа: ширина = max cols, высота = sum(rows) + 1 пустая строка-разделитель.
    max_cols = max(g["cols"] for g in layout.values())
    total_rows = sum(g["rows"] for g in layout.values()) + len(layout)  # +1 разделитель на группу

    atlas_w = max_cols * TILE_SIZE
    atlas_h = total_rows * TILE_SIZE

    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    # Каталог тайлов + edge-сигнатуры
    tiles_meta = []      # [{prefix, idx, atlas_x, atlas_y, edges:{t,b,l,r}}]
    edges_pixels = {}    # tile_id -> {side: [pixels]}  (для проверки стыковки)
    groups_meta = {}     # prefix -> {atlas_y_row, rows, cols}

    cursor_row = 0
    for prefix in sorted(layout.keys()):
        g = layout[prefix]
        groups_meta[prefix] = {
            "atlas_row": cursor_row,
            "rows": g["rows"],
            "cols": g["cols"],
        }
        for (row, col), f in g["files"]:
            try:
                img = Image.open(f).convert("RGBA")
            except Exception as e:
                print(f"skip {f}: {e}")
                continue
            if img.size != (TILE_SIZE, TILE_SIZE):
                print(f"!! {f.name} size {img.size}, skip")
                continue
            ax = col * TILE_SIZE
            ay = (cursor_row + row) * TILE_SIZE
            atlas.paste(img, (ax, ay))

            tile_id = f"{prefix}_{row}_{col}"
            eT = edge_signature(img, "top")
            eB = edge_signature(img, "bottom")
            eL = edge_signature(img, "left")
            eR = edge_signature(img, "right")
            tiles_meta.append({
                "id": tile_id,
                "prefix": prefix,
                "row": row,
                "col": col,
                "atlas_x": ax,
                "atlas_y": ay,
                "source": f.name,
                "edges": {"t": eT, "b": eB, "l": eL, "r": eR},
            })
            edges_pixels[tile_id] = {
                "t": edge_pixels(img, "top"),
                "b": edge_pixels(img, "bottom"),
                "l": edge_pixels(img, "left"),
                "r": edge_pixels(img, "right"),
            }
        cursor_row += g["rows"] + 1  # пустой ряд-разделитель

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas.save(ATLAS_PNG, optimize=True)

    # Проверка стыковки ВНУТРИ группы: для каждой пары горизонтальных соседей
    # (row, col) и (row, col+1) — оцениваем right(A) vs left(B). Аналогично вертикали.
    report_lines = []
    report_lines.append(f"# Atlas build report")
    report_lines.append(f"Atlas size: {atlas_w}x{atlas_h} px")
    report_lines.append(f"Groups: {len(groups_meta)}")
    report_lines.append(f"Tiles: {len(tiles_meta)}")
    report_lines.append("")

    for prefix, gmeta in groups_meta.items():
        report_lines.append(f"## {prefix}  ({gmeta['rows']}×{gmeta['cols']})")
        # Индексация по (row,col) → tile_id
        by_pos = {}
        for t in tiles_meta:
            if t["prefix"] == prefix:
                by_pos[(t["row"], t["col"])] = t["id"]

        bad_h, bad_v, good_h, good_v = 0, 0, 0, 0
        for (r, c), tid in by_pos.items():
            right_tid = by_pos.get((r, c + 1))
            if right_tid:
                score = edge_match_score(edges_pixels[tid]["r"], edges_pixels[right_tid]["l"])
                if score >= 0.85:
                    good_h += 1
                else:
                    bad_h += 1
                    report_lines.append(f"  H-stitch BAD ({score:.2f}): {tid} → {right_tid}")
            down_tid = by_pos.get((r + 1, c))
            if down_tid:
                score = edge_match_score(edges_pixels[tid]["b"], edges_pixels[down_tid]["t"])
                if score >= 0.85:
                    good_v += 1
                else:
                    bad_v += 1
                    report_lines.append(f"  V-stitch BAD ({score:.2f}): {tid} ↓ {down_tid}")
        report_lines.append(f"  H: {good_h} good / {bad_h} bad   V: {good_v} good / {bad_v} bad")
        report_lines.append("")

    REPORT_TXT.write_text("\n".join(report_lines), encoding="utf-8")

    # Финальный JSON
    atlas_json = {
        "tile_size": TILE_SIZE,
        "atlas": {"width": atlas_w, "height": atlas_h, "file": "atlas.png"},
        "groups": groups_meta,
        "tiles": tiles_meta,
    }
    ATLAS_JSON.write_text(json.dumps(atlas_json, indent=2), encoding="utf-8")

    print(f"✓ atlas.png   → {ATLAS_PNG}  ({atlas_w}x{atlas_h})")
    print(f"✓ atlas.json  → {ATLAS_JSON} ({len(tiles_meta)} tiles, {len(groups_meta)} groups)")
    print(f"✓ report      → {REPORT_TXT}")


if __name__ == "__main__":
    main()
