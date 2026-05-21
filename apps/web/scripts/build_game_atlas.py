#!/usr/bin/env python3
"""
Финальный атлас для игры.

Структура: один PNG, тайлы уложены подряд по строкам. atlas.json содержит:
  {
    "tile_size": 32,
    "atlas": {"file": "atlas.png", "width": W, "height": H, "cols": N},
    "wang": {
      biome_name: {
        "0": [tile_idx, tile_idx, ...],
        ...
        "15": [tile_idx, ...]
      }
    }
  }

Каждый tile_idx — порядковый номер тайла в атласе (row-major).
В JS можно вычислить (x, y) = (idx % cols, idx // cols) и нарисовать
ctx.drawImage(atlas, x*32, y*32, 32, 32, dest_x, dest_y, 32, 32).
"""
import json
from pathlib import Path
from PIL import Image

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
WANG_TABLE = ROOT / "public/tiles/wang_table.json"
OUT_PNG = ROOT / "public/tiles/atlas.png"
OUT_JSON = ROOT / "public/tiles/atlas.json"
COLS = 32  # 32 тайла в ряд → ширина атласа 1024px


def find_tile(name):
    for d in (BG, TILEMAP):
        if (d / name).exists():
            return d / name
    return None


def main():
    wang = json.loads(WANG_TABLE.read_text())

    # Соберём список уникальных тайлов (по имени файла), сохранив порядок биом→маска→имя.
    seen = {}
    order = []
    for biome in sorted(wang.keys()):
        for mask_str, names in sorted(wang[biome].items(), key=lambda x: int(x[0])):
            for name in names:
                if name not in seen:
                    seen[name] = len(order)
                    order.append(name)

    # Доб. river/road если есть (clrrvr, watrtl, trdd/trdg, trob)
    extras = ["clrrvr", "watrtl", "trdd", "trdg", "trob"]
    for ext in extras:
        for d in (TILEMAP, BG):
            for f in sorted(d.glob(f"{ext}*.png")):
                if f.name not in seen:
                    seen[f.name] = len(order)
                    order.append(f.name)

    total = len(order)
    rows = (total + COLS - 1) // COLS
    atlas = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
    for idx, name in enumerate(order):
        p = find_tile(name)
        if not p:
            continue
        img = Image.open(p).convert("RGBA")
        if img.size != (TILE, TILE):
            continue
        x = (idx % COLS) * TILE
        y = (idx // COLS) * TILE
        atlas.paste(img, (x, y))

    atlas.save(OUT_PNG, optimize=True)

    # Переписываем wang_table с индексами в атласе вместо имён файлов
    wang_idx = {}
    for biome in wang:
        wang_idx[biome] = {}
        for mask, names in wang[biome].items():
            wang_idx[biome][mask] = [seen[n] for n in names if n in seen]

    # Также сохраняем mapping idx → name для отладки
    out = {
        "tile_size": TILE,
        "atlas": {
            "file": "atlas.png",
            "cols": COLS,
            "rows": rows,
            "width": COLS * TILE,
            "height": rows * TILE,
            "total_tiles": total,
        },
        "wang": wang_idx,
        # для отладки — имя по idx
        "tile_names": order,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"✓ {OUT_PNG}  ({COLS*TILE}x{rows*TILE}, {total} tiles)")
    print(f"✓ {OUT_JSON}")
    for biome, masks in wang_idx.items():
        total_b = sum(len(v) for v in masks.values())
        print(f"  {biome}: {total_b} tiles indexed")


if __name__ == "__main__":
    main()
