#!/usr/bin/env python3
"""
Универсальный классификатор по 4-corner wang для ВСЕХ биомов.

Биомы Heroes 3 в наших папках:
  grass  : tgrb (base, tilemap) + tgrs/tgrd/tgrm (transitions/decor, bg+tilemap)
  dirt   : tdtb (base, tilemap) + tdts/tdtm (transitions, tilemap)
  sand   : tsab (1×26, base + variations, bg)
  snow   : tsnb (base) + tsns/tsnd/tsnm (transitions)
  swamp  : tswb + tsws/tswd/tswm
  sub    : tsub + tsus/tsud/tsum
  volc   : tvlb + tvls/tvld/tvlm
  rough  : trob + tros/trod/trom
  water  : watrtl (1×34)
  road   : trdd, trdg

Алгоритм:
  1) Для каждого биома берём base-тайл (t**b000.png), измеряем средний RGB
     центра — это "своя" палитра.
  2) Для каждого тайла биома: смотрим 4 квадранта 8×8 в центрах углов 16×16,
     решаем "свой биом" (расстояние до palette < threshold) vs "не свой".
  3) Получаем mask 0..15 → имя файла.

Выход: public/tiles/wang_table.json
        { biome: { "0": [...], ..., "15": [...] } }

Также пишем public/tiles/wang_report.txt — статистика покрытия.
"""

import json
from pathlib import Path
from PIL import Image
from collections import defaultdict

TILE = 32
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
OUT_JSON = ROOT / "public/tiles/wang_table.json"
OUT_REPORT = ROOT / "public/tiles/wang_report.txt"

# Биом-семья: префиксы base / transitions
BIOMES = {
    "grass":  {"base": ["tgrb"], "trans": ["tgrs", "tgrd", "tgrm"], "border_biome": "dirt"},
    "dirt":   {"base": ["tdtb"], "trans": ["tdts", "tdtm"], "border_biome": "sand"},
    "sand":   {"base": ["tsab"], "trans": [], "border_biome": "sand"},  # sand сам — граница
    "snow":   {"base": ["tsnb"], "trans": ["tsns", "tsnd", "tsnm"], "border_biome": "dirt"},
    "swamp":  {"base": ["tswb"], "trans": ["tsws", "tswd", "tswm"], "border_biome": "dirt"},
    "sub":    {"base": ["tsub"], "trans": ["tsus", "tsud", "tsum"], "border_biome": "rock"},
    "volc":   {"base": ["tvlb"], "trans": ["tvls", "tvld", "tvlm"], "border_biome": "dirt"},
    "rough":  {"base": ["trob"], "trans": ["tros", "trod", "trom"], "border_biome": "dirt"},
}


def all_files(prefix):
    """Все файлы для префикса из обеих папок (dedup по имени)."""
    seen = set()
    out = []
    for folder in (TILEMAP, BG):
        for f in sorted(folder.glob(f"{prefix}*.png")):
            if f.name not in seen:
                seen.add(f.name)
                out.append(f)
    return out


def avg_rgb(img, x0, y0, w, h):
    px = img.load()
    r = g = b = 0
    n = 0
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            p = px[x, y]
            r += p[0]
            g += p[1]
            b += p[2]
            n += 1
    return (r / n, g / n, b / n)


def color_dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def biome_palette(prefix):
    """Средний цвет центра base-тайла biome'а."""
    files = all_files(prefix)
    if not files:
        return None
    img = Image.open(files[0]).convert("RGBA")
    if img.size != (TILE, TILE):
        return None
    return avg_rgb(img, 12, 12, 8, 8)  # центральные 8×8


def quadrant_color(img, qx, qy):
    """Средний цвет в центре квадранта (qx,qy ∈ {0,1})."""
    return avg_rgb(img, qx * 16 + 4, qy * 16 + 4, 8, 8)


def main():
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    report = []
    wang = {}

    # Палитры всех биомов (для отнесения квадранта к биому-соседу)
    palettes = {}
    for biome, cfg in BIOMES.items():
        pal = biome_palette(cfg["base"][0])
        if pal is None:
            print(f"!! no base for {biome} ({cfg['base'][0]})")
            continue
        palettes[biome] = pal
    report.append("=== Biome palettes (center of base tile) ===")
    for b, p in palettes.items():
        report.append(f"  {b:6s}: RGB({p[0]:.0f}, {p[1]:.0f}, {p[2]:.0f})")
    report.append("")

    for biome, cfg in BIOMES.items():
        own_pal = palettes.get(biome)
        if own_pal is None:
            continue
        border_pal = palettes.get(cfg["border_biome"], own_pal)

        files = []
        for p in cfg["base"] + cfg["trans"]:
            files.extend(all_files(p))

        by_mask = defaultdict(list)
        for f in files:
            img = Image.open(f).convert("RGBA")
            if img.size != (TILE, TILE):
                continue
            mask = 0
            for bit, (qx, qy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
                c = quadrant_color(img, qx, qy)
                # квадрант — "свой" биом, если он ближе к своей палитре чем к border-палитре
                d_own = color_dist(c, own_pal)
                d_bord = color_dist(c, border_pal)
                if d_own < d_bord:
                    mask |= (1 << bit)
            by_mask[mask].append(f.name)

        wang[biome] = {str(k): sorted(v) for k, v in sorted(by_mask.items())}

        report.append(f"## {biome}  ({len(files)} tiles, border={cfg['border_biome']})")
        empty = []
        for m in range(16):
            cnt = len(by_mask.get(m, []))
            bits = f"{'G' if m&1 else '-'}{'G' if m&2 else '-'}/{'G' if m&4 else '-'}{'G' if m&8 else '-'}"
            line = f"  mask {m:2d} [{bits}]: {cnt}"
            if cnt == 0:
                empty.append(m)
            report.append(line)
        if empty:
            report.append(f"  ** EMPTY masks: {empty}")
        report.append("")

    OUT_JSON.write_text(json.dumps(wang, indent=2), encoding="utf-8")
    OUT_REPORT.write_text("\n".join(report), encoding="utf-8")
    print(f"✓ {OUT_JSON}")
    print(f"✓ {OUT_REPORT}")
    # Сводка
    for b in wang:
        empties = [m for m in range(16) if not wang[b].get(str(m))]
        total = sum(len(v) for v in wang[b].values())
        print(f"  {b}: {total} tiles, empty masks: {empties}")


if __name__ == "__main__":
    main()
