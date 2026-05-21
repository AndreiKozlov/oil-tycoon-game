#!/usr/bin/env python3
"""
Генерация цветной biome-маски Земли в эквидистантной (плоской) проекции.

Размер по умолчанию: 192×96 (соотношение 2:1, как у equirectangular Земли).
В этом разрешении одна клетка ≈ 200 км — для глобальной игровой карты в
самый раз: видно континенты, но не теряемся в деталях.

Цвета (RGB):
  океан (deep)    = (35,  90, 170)
  мелководье      = (110, 190, 220)
  трава           = ( 80, 165,  75)
  песок/пустыня   = (235, 205, 105)
  земля/горы      = (140,  95,  55)
  снег/лёд        = (240, 245, 250)

Источник формы материков: ручные грубые полигоны в lon/lat (-180..180, -90..90).
Этого достаточно для узнаваемой карты в low-poly стиле.

Климатический оверлей:
  • |lat| > 65       → снег
  • 18 < |lat| < 32  → пустыня (для континентальной суши)
  • прибрежная зона  → мелководье
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/tiles/biome_map.png"
OUT_PREVIEW = ROOT / "public/tiles/biome_map_preview.png"

W, H = 192, 96  # pixels (lon, lat)

C = {
    "deep":    (35,  90, 170, 255),
    "shallow": (110, 190, 220, 255),
    "grass":   ( 80, 165,  75, 255),
    "sand":    (235, 205, 105, 255),
    "dirt":    (140,  95,  55, 255),
    "snow":    (240, 245, 250, 255),
}

# --- Полигоны материков, координаты в (lon, lat). Грубые, но узнаваемые ---
CONTINENTS = {
    "eurasia": [
        (-10, 36), (-8, 43), (1, 51), (10, 58), (28, 70), (60, 73),
        (105, 78), (140, 72), (175, 68), (180, 60), (170, 55), (145, 45),
        (135, 35), (125, 22), (110, 18), (100, 10), (95, 16), (88, 22),
        (78, 8),  (72, 18),  (65, 25), (55, 25),  (45, 12), (35, 12),
        (28, 30), (20, 35),  (5, 36),
    ],
    "africa": [
        (-17, 20), (-15, 12), (-12, 5), (-8, 4),  (0, 4),  (8, 4), (9, -2),
        (14, -10), (20, -22), (25, -34), (20, -34),(18, -32),(15, -29),(11, -23),
        (10, -15),  (12, -5), (15, 12),  (22, 18), (32, 23), (35, 30),
        (30, 32),  (15, 32),  (0, 30),   (-10, 28),
    ],
    "n_america": [
        (-168, 65), (-155, 70), (-130, 70), (-95, 73), (-75, 78), (-60, 82),
        (-55, 75), (-60, 60), (-65, 50), (-70, 45), (-75, 35), (-85, 30),
        (-95, 28), (-105, 22), (-100, 18), (-92, 16), (-86, 12), (-80, 10),
        (-95, 15), (-110, 25), (-118, 32), (-124, 42), (-130, 52), (-145, 60),
        (-165, 60),
    ],
    "s_america": [
        (-80, 12), (-75, 8),  (-70, 5),   (-58, 6),  (-50, 0),  (-44, -8),
        (-38, -10),(-36, -18),(-43, -23),(-48, -28),(-58, -37),(-65, -42),
        (-72, -50),(-72, -55),(-68, -55),(-65, -48),(-72, -40),(-72, -33),
        (-75, -22),(-78, -8), (-80, 0),
    ],
    "australia": [
        (113, -22), (115, -32), (122, -34), (135, -36), (146, -39),
        (153, -27), (146, -20), (140, -12), (132, -12), (125, -14), (115, -16),
    ],
    "antarctica": [
        (-180, -65), (-90, -73), (0, -78), (90, -75), (180, -68),
        (180, -90), (-180, -90),
    ],
    "greenland": [
        (-50, 60), (-45, 65), (-35, 72), (-22, 77), (-15, 80), (-25, 83),
        (-45, 80), (-55, 70), (-52, 62),
    ],
    "uk": [(-5, 50), (-4, 55), (-2, 58), (1, 56), (1, 52), (-3, 50)],
    "japan": [(132, 33), (135, 36), (140, 38), (142, 42), (138, 36), (135, 33)],
    "iceland": [(-22, 65), (-15, 65), (-13, 66), (-18, 67), (-22, 66)],
    "madagascar": [(43, -12), (50, -16), (50, -24), (47, -25), (44, -22), (43, -16)],
    "new_zealand_n": [(173, -35), (176, -38), (175, -41), (173, -41), (172, -37)],
    "new_zealand_s": [(167, -42), (171, -42), (174, -45), (170, -46), (167, -45)],
    "indonesia_sumatra": [(96, 4), (103, -2), (106, -6), (100, -3), (95, 2)],
    "indonesia_borneo":  [(109, 4), (118, 4), (118, -3), (110, -3), (108, 0)],
    "indonesia_new_guinea": [(131, -2), (151, -2), (151, -10), (140, -10), (131, -8)],
    "philippines": [(120, 6), (125, 18), (122, 14), (118, 8)],
    "cuba_hisp": [(-85, 22), (-74, 22), (-68, 18), (-78, 18), (-85, 21)],
}

# ----------------------------------------------------------------------------


def lonlat_to_xy(lon: float, lat: float) -> tuple[float, float]:
    x = (lon + 180.0) / 360.0 * W
    y = (90.0 - lat) / 180.0 * H
    return x, y


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # 1) океан
    img = Image.new("RGBA", (W, H), C["deep"])

    # 2) рисуем сушу единым "land"-цветом сначала на маске
    land_mask = Image.new("L", (W, H), 0)
    dm = ImageDraw.Draw(land_mask)
    for name, poly in CONTINENTS.items():
        pts = [lonlat_to_xy(lon, lat) for lon, lat in poly]
        dm.polygon(pts, fill=255)

    # 3) сглаживаем береговую линию чуть-чуть (но сохраняем форму)
    land_mask = land_mask.filter(ImageFilter.MaxFilter(3))  # чуть толще берега
    land_mask = land_mask.filter(ImageFilter.GaussianBlur(0.6))

    # 4) мелководье — кольцо вокруг суши
    coast = land_mask.filter(ImageFilter.MaxFilter(5))
    shallow_ring = Image.eval(
        Image.merge("L", [coast]).point(lambda v: 255 if v > 64 else 0),
        lambda v: v,
    )
    # на пикселях не-земли, но рядом с землёй → shallow
    shallow_only = Image.new("L", (W, H), 0)
    land_bin = land_mask.point(lambda v: 255 if v > 96 else 0)
    sp = shallow_ring.load(); lp = land_bin.load(); sop = shallow_only.load()
    for y in range(H):
        for x in range(W):
            if sp[x, y] > 0 and lp[x, y] == 0:
                sop[x, y] = 255

    # композит ocean+shallow+land
    shallow_layer = Image.new("RGBA", (W, H), C["shallow"])
    img.paste(shallow_layer, mask=shallow_only)
    land_layer = Image.new("RGBA", (W, H), C["grass"])
    img.paste(land_layer, mask=land_bin)

    # 5) климат: переписываем сушу по широте
    px = img.load()
    lp = land_bin.load()
    for y in range(H):
        lat = 90.0 - (y + 0.5) / H * 180.0
        a = abs(lat)
        for x in range(W):
            if lp[x, y] == 0:
                continue
            lon = (x + 0.5) / W * 360.0 - 180.0
            # снег у полюсов
            if a > 62:
                px[x, y] = C["snow"]
                continue
            # пустыня в субтропиках (сахара/аравия/австралия/калахари/мексика)
            in_sahara   = (-15 <= lon <= 35)  and (12 <= lat <= 30)
            in_arabia   = (32  <= lon <= 60)  and (15 <= lat <= 32)
            in_aussie   = (118 <= lon <= 140) and (-32 <= lat <= -20)
            in_kalahari = (12  <= lon <= 25)  and (-30 <= lat <= -18)
            in_atacama  = (-72 <= lon <= -68) and (-30 <= lat <= -18)
            in_gobi     = (85  <= lon <= 115) and (38 <= lat <= 48)
            in_mexico   = (-115<= lon <= -100)and (22 <= lat <= 35)
            if in_sahara or in_arabia or in_aussie or in_kalahari or in_atacama or in_gobi or in_mexico:
                px[x, y] = C["sand"]
                continue
            # горы / возвышенности — грубо
            in_himalaya = (70 <= lon <= 100) and (28 <= lat <= 40)
            in_rockies  = (-120<= lon <= -105)and (35 <= lat <= 55)
            in_andes    = (-75 <= lon <= -67) and (-42 <= lat <= 5)
            if in_himalaya or in_rockies or in_andes:
                px[x, y] = C["dirt"]
                continue
            # тайга высоких широт — тоже снег
            if a > 58:
                px[x, y] = C["snow"]

    # 6) ледяные шапки Арктики — поверх океана у полюса
    for y in range(H):
        lat = 90.0 - (y + 0.5) / H * 180.0
        if lat > 78:
            for x in range(W):
                if lp[x, y] == 0:
                    px[x, y] = C["snow"]  # арктический лёд
        if lat < -68:
            for x in range(W):
                if lp[x, y] == 0:
                    px[x, y] = C["snow"]  # антарктический шельф

    img.save(OUT)
    print(f"✓ biome map → {OUT} ({W}×{H})")

    # preview — апскейл 8x с nearest
    img.resize((W * 8, H * 8), Image.NEAREST).save(OUT_PREVIEW)
    print(f"✓ preview   → {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
