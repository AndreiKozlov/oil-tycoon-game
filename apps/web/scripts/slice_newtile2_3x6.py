#!/usr/bin/env python3
"""
Нарезка второго tileset 1024×1536 → 3×6 = 18 изометрических плиток.

Layout идентичен первому (см. slice_newtile_3x6.py), но арт другой:
  ряд 0: snow,            grass_1,        grass_2
  ряд 1: grass_3,         grass_4,        grass_5
  ряд 2: sand_1,          sand_2,         dirt_1
  ряд 3: dirt_2,          dirt_3,         dirt_4
  ряд 4: deep_water_1,    deep_water_2,   deep_water_3
  ряд 5: shallow_water_1, ice_water_1,    ice_water_2

В отличие от первого, исходник УЖЕ имеет прозрачный фон (corners alpha=0),
поэтому маскировать ромбом не нужно. Контент уже сидит внутри прозрачной
рамки.

Сохраняет в public/tiles/iso2_18/, манифест iso2_18.json.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

SRC = Path("/root/oil_tycoon_project/uploads/A2E7E280-ABA4-4047-9D19-F9162EBCA823.png")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/tiles/iso2_18"
PREVIEW = ROOT / "public/tiles/iso2_18_preview.png"
MANIFEST = ROOT / "public/tiles/iso2_18.json"

COLS, ROWS = 3, 6

NAMES = [
    ["snow",            "grass_1",        "grass_2"],
    ["grass_3",         "grass_4",        "grass_5"],
    ["sand_1",          "sand_2",         "dirt_1"],
    ["dirt_2",          "dirt_3",         "dirt_4"],
    ["deep_water_1",    "deep_water_2",   "deep_water_3"],
    ["shallow_water_1", "ice_water_1",    "ice_water_2"],
]

BIOME_OF = {
    "snow": "snow",
    **{f"grass_{i}": "grass" for i in range(1, 6)},
    **{f"sand_{i}": "sand"  for i in range(1, 3)},
    **{f"dirt_{i}": "dirt"  for i in range(1, 5)},
    **{f"deep_water_{i}":   "deep_water"    for i in range(1, 4)},
    **{f"shallow_water_{i}":"shallow_water" for i in range(1, 2)},
    **{f"ice_water_{i}":    "ice_water"     for i in range(1, 3)},
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    W, H = src.size
    cw, ch = W / COLS, H / ROWS
    print(f"source {W}×{H}, cell {cw:.2f}×{ch:.2f}")

    manifest = {
        "source": str(SRC),
        "grid": {"cols": COLS, "rows": ROWS},
        "cell": {"w": round(cw, 3), "h": round(ch, 3)},
        "pivot": "bottom-center",
        "tiles": [],
    }
    for r in range(ROWS):
        for c in range(COLS):
            x0, y0 = round(c * cw), round(r * ch)
            x1, y1 = round((c + 1) * cw), round((r + 1) * ch)
            tile = src.crop((x0, y0, x1, y1))
            name = NAMES[r][c]
            path = OUT / f"{name}.png"
            tile.save(path)
            bbox = tile.getbbox() or (0, 0, tile.width, tile.height)
            manifest["tiles"].append({
                "name": name,
                "biome": BIOME_OF[name],
                "row": r, "col": c,
                "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
                "opaque_bbox": list(bbox),
                "file": f"iso2_18/{name}.png",
            })
    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"✓ {len(manifest['tiles'])} tiles → {OUT}")
    print(f"✓ manifest → {MANIFEST}")

    # preview
    th_w, th_h = 256, 192
    pad, label_h = 6, 18
    pw = COLS * (th_w + pad) + pad
    ph = ROWS * (th_h + pad + label_h) + pad
    canvas = Image.new("RGBA", (pw, ph), (18, 22, 28, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
    except Exception:
        font = ImageFont.load_default()
    biome_color = {
        "snow":           "#ffffff",
        "grass":          "#7fe05f",
        "sand":           "#ffd166",
        "dirt":           "#c4865c",
        "deep_water":     "#5b9eff",
        "shallow_water":  "#7be0ff",
        "ice_water":      "#cce7ff",
    }
    for t in manifest["tiles"]:
        gx = pad + t["col"] * (th_w + pad)
        gy = pad + t["row"] * (th_h + pad + label_h)
        ti = Image.open(OUT / f"{t['name']}.png").convert("RGBA")
        scaled = ti.resize((th_w, th_h), Image.LANCZOS)
        canvas.paste(scaled, (gx, gy + label_h), scaled)
        col = biome_color.get(t["biome"], "#ffffff")
        draw.text((gx + 4, gy), f"[{t['row']},{t['col']}] {t['name']}",
                  fill=col, font=font)
    canvas.save(PREVIEW)
    print(f"✓ preview → {PREVIEW} {canvas.size}")


if __name__ == "__main__":
    main()
