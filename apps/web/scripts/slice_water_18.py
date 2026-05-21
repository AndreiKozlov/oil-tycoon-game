#!/usr/bin/env python3
"""
Нарезка нового water-tilesheet 1024×1536 на 3×6 = 18 изометрических тайлов
и автоклассификация каждого по биому через средний цвет ромба.

Категории:
  • deep_water   — тёмная вода (низкая яркость, B доминирует)
  • shallow_water— светлая вода / прибрежная (высокая яркость, B доминирует)
  • ice          — почти-белый / голубовато-белый
  • coast        — смешанные тайлы (вода + ещё цвет, для wang-стыков)

Tilesheet сохраняет прозрачный фон, маскировать не нужно (в отличие от
старого newtile.png) — будем использовать как есть.

Имена файлов: water_<biome>_<n>.png в public/tiles/water_18/
Манифест: public/tiles/water_18.json
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
from collections import defaultdict

SRC = Path("/root/oil_tycoon_project/uploads/A2E7E280-ABA4-4047-9D19-F9162EBCA823.png")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/tiles/water_18"
PREVIEW = ROOT / "public/tiles/water_18_preview.png"
MANIFEST = ROOT / "public/tiles/water_18.json"

COLS, ROWS = 3, 6


def avg_color(tile: Image.Image) -> tuple[float, float, float, float]:
    """Средний RGBA по непрозрачным пикселям (alpha > 32)."""
    px = tile.load()
    W, H = tile.size
    rs = gs = bs = 0.0
    n = 0
    for y in range(0, H, 4):
        for x in range(0, W, 4):
            r, g, b, a = px[x, y]
            if a < 32:
                continue
            rs += r
            gs += g
            bs += b
            n += 1
    if n == 0:
        return 0, 0, 0, 0
    return rs / n, gs / n, bs / n, n


def classify(r: float, g: float, b: float) -> str:
    """Возвращает biome ярлык по среднему цвету ромба."""
    brightness = (r + g + b) / 3
    # Лёд: высокая яркость + цвета близки (нет доминирующего канала)
    if brightness > 180 and abs(r - g) < 30 and abs(g - b) < 30:
        return "ice"
    # Вода: B > R (сине-зелёный/голубой доминирует)
    blue_dominance = b - (r + g) / 2
    if blue_dominance > 15:
        if brightness > 140:
            return "shallow_water"
        return "deep_water"
    # Всё прочее (вода+что-то ещё) — берег / смешанный
    return "coast"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    W, H = src.size
    cw, ch = W / COLS, H / ROWS
    print(f"source {W}×{H}, cell {cw:.1f}×{ch:.1f}")

    # 1) Нарезка + средний цвет каждого тайла
    raw = []
    for r in range(ROWS):
        for c in range(COLS):
            x0, y0 = round(c * cw), round(r * ch)
            x1, y1 = round((c + 1) * cw), round((r + 1) * ch)
            tile = src.crop((x0, y0, x1, y1))
            ar, ag, ab, n = avg_color(tile)
            biome = classify(ar, ag, ab)
            raw.append({
                "row": r, "col": c,
                "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0,
                "avg_rgb": [round(ar), round(ag), round(ab)],
                "opaque_pixels_sampled": n,
                "biome": biome,
                "tile_img": tile,
            })

    # 2) Нумерация внутри биома
    counters = defaultdict(int)
    for t in raw:
        counters[t["biome"]] += 1
        t["index_in_biome"] = counters[t["biome"]]
        t["name"] = f"{t['biome']}_{t['index_in_biome']}"

    print("\nclassification:")
    for t in raw:
        print(f"  [{t['row']},{t['col']}] avg={t['avg_rgb']} → {t['name']}")

    # 3) Сохранение PNG + bbox
    manifest = {
        "source": str(SRC),
        "grid": {"cols": COLS, "rows": ROWS},
        "cell": {"w": round(cw, 3), "h": round(ch, 3)},
        "pivot": "bottom-center",
        "tiles": [],
    }
    for t in raw:
        path = OUT / f"{t['name']}.png"
        t["tile_img"].save(path)
        bbox = t["tile_img"].getbbox() or (0, 0, t["w"], t["h"])
        manifest["tiles"].append({
            "name": t["name"],
            "biome": t["biome"],
            "row": t["row"], "col": t["col"],
            "x": t["x"], "y": t["y"], "w": t["w"], "h": t["h"],
            "avg_rgb": t["avg_rgb"],
            "opaque_bbox": list(bbox),
            "file": f"water_18/{t['name']}.png",
        })
    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"\n✓ {len(manifest['tiles'])} tiles → {OUT}")
    print(f"✓ manifest → {MANIFEST}")

    # 4) Превью с подписями биомов
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
        "deep_water":    "#5b9eff",
        "shallow_water": "#7be0ff",
        "ice":           "#ffffff",
        "coast":         "#ffcf5c",
    }
    for t in raw:
        gx = pad + t["col"] * (th_w + pad)
        gy = pad + t["row"] * (th_h + pad + label_h)
        scaled = t["tile_img"].resize((th_w, th_h), Image.LANCZOS)
        canvas.paste(scaled, (gx, gy + label_h), scaled)
        col = biome_color.get(t["biome"], "#ffffff")
        draw.text((gx + 4, gy), f"[{t['row']},{t['col']}] {t['name']}",
                  fill=col, font=font)
    canvas.save(PREVIEW)
    print(f"✓ preview → {PREVIEW} {canvas.size}")

    # 5) Сводка по биомам
    print("\nsummary:")
    counts = defaultdict(int)
    for t in raw:
        counts[t["biome"]] += 1
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
