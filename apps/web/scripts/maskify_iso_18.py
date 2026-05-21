#!/usr/bin/env python3
"""
Делает каждому тайлу из iso_18/ настоящую альфа-маску в форме ромба.

Source-картинка newtile.png имеет градиентный фон (зелёный + голубой),
а не прозрачность. После нарезки фон остаётся внутри каждого тайла и при
композите перекрывает соседей → швы и грязь. Здесь применяем
ромбовидную альфа-маску с мягкими краями (anti-aliased).

Ромб ≈ 86% ширины / 72% высоты canvas, по центру, pivot=bottom-center.
Края feathered на 4 px чтобы скрыть зубцы при overdraw.

Перезаписывает iso_18/*.png in-place.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public/tiles/iso_18"
MANIFEST = ROOT / "public/tiles/iso_18.json"

# Доля canvas, занимаемая ромбом
RHOMB_W_FRAC = 0.92
RHOMB_H_FRAC = 0.82
FEATHER_PX = 3  # сглаживание края


def make_rhombus_mask(w: int, h: int) -> Image.Image:
    """Возвращает L-маску с ромбом по центру, anti-aliased."""
    rw = int(w * RHOMB_W_FRAC)
    rh = int(h * RHOMB_H_FRAC)
    cx, cy = w / 2, h / 2 + h * 0.02  # центр чуть ниже, под изометрию
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    # ромб = polygon
    pts = [
        (cx,            cy - rh / 2),  # top
        (cx + rw / 2,   cy),           # right
        (cx,            cy + rh / 2),  # bottom
        (cx - rw / 2,   cy),           # left
    ]
    d.polygon(pts, fill=255)
    if FEATHER_PX > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(FEATHER_PX))
    return mask


def main():
    manifest = json.load(open(MANIFEST))
    new_bboxes = {}
    for t in manifest["tiles"]:
        path = DIR / f"{t['name']}.png"
        img = Image.open(path).convert("RGBA")
        w, h = img.size
        mask = make_rhombus_mask(w, h)
        # Применяем маску как новую альфу (умножаем со старой)
        r, g, b, a = img.split()
        a_new = Image.eval(mask, lambda v: v)
        img.putalpha(a_new)
        img.save(path)
        new_bboxes[t["name"]] = img.getbbox()
    # обновляем манифест
    for t in manifest["tiles"]:
        t["opaque_bbox"] = list(new_bboxes[t["name"]])
        # rhombus geometry (для рендера)
        t["rhomb"] = {
            "w_frac": RHOMB_W_FRAC,
            "h_frac": RHOMB_H_FRAC,
        }
    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"✓ masked {len(manifest['tiles'])} tiles, manifest updated")


if __name__ == "__main__":
    main()
