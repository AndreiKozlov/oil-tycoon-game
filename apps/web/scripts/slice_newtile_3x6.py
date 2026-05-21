#!/usr/bin/env python3
"""
Нарезка newtile.png (1024×1536) на изометрический tileset 3 колонки × 6 рядов.

Cell ≈ 341.33×256 (1024/3 × 1536/6). Используем float-границы с округлением,
чтобы не накапливалась ошибка.

Имена тайлов соответствуют инструкции из ТЗ:
  ряд 0: snow,            grass_1,        grass_2
  ряд 1: grass_3,         grass_4,        grass_5
  ряд 2: sand_1,          sand_2,         dirt_1
  ряд 3: dirt_2,          dirt_3,         dirt_4
  ряд 4: deep_water_1,    deep_water_2,   deep_water_3
  ряд 5: shallow_water_1, ice_water_1,    ice_water_2

Каждый тайл сохраняется как отдельный PNG в public/tiles/iso_18/.
Pivot указывается в манифесте iso_18.json (bottom-center).

Доп. опция: --trim — обрезает тайл до bbox непрозрачных пикселей и
сохраняет смещение от исходного pivot, чтобы потом точно класть.
По умолчанию НЕ обрезаем, чтобы canvas был одинаковым (нужно для overdraw).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

SRC = Path("/root/oil_tycoon_project/newtile.png")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/tiles/iso_18"
PREVIEW = ROOT / "public/tiles/iso_18_preview.png"
MANIFEST = ROOT / "public/tiles/iso_18.json"

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
    print(f"Source: {W}×{H}, cell {cw:.2f}×{ch:.2f}")

    manifest = {
        "source": str(SRC),
        "grid": {"cols": COLS, "rows": ROWS},
        "cell": {"w": round(cw, 3), "h": round(ch, 3)},
        "pivot": "bottom-center",
        "tiles": []
    }

    for r in range(ROWS):
        for c in range(COLS):
            x0 = round(c * cw)
            y0 = round(r * ch)
            x1 = round((c + 1) * cw)
            y1 = round((r + 1) * ch)
            tile = src.crop((x0, y0, x1, y1))
            name = NAMES[r][c]
            path = OUT / f"{name}.png"
            tile.save(path)

            # bbox непрозрачного содержимого для последующего рендера
            bbox = tile.getbbox() or (0, 0, tile.width, tile.height)
            manifest["tiles"].append({
                "name": name,
                "biome": BIOME_OF[name],
                "row": r, "col": c,
                "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
                "opaque_bbox": bbox,
                "file": f"iso_18/{name}.png",
            })

    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"✓ {len(manifest['tiles'])} tiles → {OUT}")
    print(f"✓ manifest → {MANIFEST}")

    # --- preview grid ---
    th_w, th_h = 256, 192  # downscaled preview cell
    pad, label_h = 6, 16
    pw = COLS * (th_w + pad) + pad
    ph = ROWS * (th_h + pad + label_h) + pad
    canvas = Image.new("RGBA", (pw, ph), (18, 22, 28, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 12)
    except Exception:
        font = ImageFont.load_default()

    for i, t in enumerate(manifest["tiles"]):
        r, c = t["row"], t["col"]
        gx = pad + c * (th_w + pad)
        gy = pad + r * (th_h + pad + label_h)
        tile = Image.open(OUT / f"{t['name']}.png").convert("RGBA")
        scaled = tile.resize((th_w, th_h), Image.LANCZOS)
        canvas.paste(scaled, (gx, gy + label_h), scaled)
        draw.text((gx + 4, gy), f"[{r},{c}] {t['name']}", fill=(230, 230, 240, 255), font=font)
    canvas.save(PREVIEW)
    print(f"✓ preview → {PREVIEW} ({canvas.size})")


if __name__ == "__main__":
    main()
