#!/usr/bin/env python3
"""
Тест с подписями: рисует остров 6×6, увеличенный в 4× (каждый тайл 128×128).
На каждой клетке мелким шрифтом подписан wang-код, имя файла, transform.
Так пользователь может точно указать какие именно тайлы неправильные.

Также добавляет ПЕСЧАНЫЙ ПОЯС между водой и сушей (тройной переход
вода → песок → трава, как в Heroes 3). Берег = sand-тайл, не grass.
"""
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TILE = 32
SCALE = 4
ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/tiles/raw/bg"
TILEMAP = ROOT / "public/tiles/raw/tilemap"
WANG = ROOT / "public/tiles/water_wang.json"
OUT = ROOT / "public/tiles/water_labeled_test.png"


def apply_tx(img, tx):
    if tx == "flipH":
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    if tx == "flipV":
        return img.transpose(Image.FLIP_TOP_BOTTOM)
    if tx == "rotate180":
        return img.transpose(Image.ROTATE_180)
    return img


def main():
    random.seed(11)
    wang = json.loads(WANG.read_text())

    # Карта 10×10, остров 6×6 в центре.
    # Используем 3 биома: WATER (вода), SAND (песок берег), GRASS (трава суша).
    # Это упрощённая схема Heroes 3: трава не граничит напрямую с водой.
    W, H = 10, 10
    cx, cy = (W - 1) / 2, (H - 1) / 2
    BW, BH = W + 1, H + 1

    # Биом каждой угловой точки карты. Три уровня:
    #   distance < 2.5 → grass
    #   2.5..3.5      → sand
    #   else          → water
    biome_pt = [[None] * BW for _ in range(BH)]
    for y in range(BH):
        for x in range(BW):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d < 2.5:
                biome_pt[y][x] = "G"      # grass
            elif d < 3.5:
                biome_pt[y][x] = "S"      # sand
            else:
                biome_pt[y][x] = "W"      # water

    # Большой канвас под подписи (TILE*SCALE на каждую клетку)
    big_tile = TILE * SCALE
    canvas = Image.new("RGBA", (W * big_tile, H * big_tile), (40, 80, 110, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 9)
    except Exception:
        font = ImageFont.load_default()

    # Тайл-выбор для каждой клетки.
    # Это берег: рассмотрим какие 2 биома участвуют в углах клетки.
    # Если все 4 угла = W → открытое море.
    # Если все 4 угла = S → песок (tsab).
    # Если все 4 угла = G → grass (tgrb).
    # Если смесь W+S → берег watrtl (W/S wang).
    # Если смесь S+G → переход sand/grass из tgrs.
    # Если смесь W+G → ОШИБКА — не должно быть, песок обязателен между ними.

    SEAMLESS_OPEN_SEA = "watrtl24.png"

    grass_files = sorted(TILEMAP.glob("tgrb*.png"))
    sand_files = sorted(BG.glob("tsab*.png"))

    for ty in range(H):
        for tx in range(W):
            nw = biome_pt[ty][tx]
            ne = biome_pt[ty][tx + 1]
            sw = biome_pt[ty + 1][tx]
            se = biome_pt[ty + 1][tx + 1]
            corners = [nw, ne, sw, se]
            biomes_set = set(corners)

            label_lines = [f"NW={nw} NE={ne}", f"SW={sw} SE={se}"]
            chosen_tile = None
            chosen_tx = "none"
            chosen_name = "?"

            if biomes_set == {"W"}:
                # Открытое море
                src = BG / SEAMLESS_OPEN_SEA
                chosen_tile = Image.open(src).convert("RGBA")
                chosen_name = SEAMLESS_OPEN_SEA
            elif biomes_set == {"G"}:
                # Чистая трава
                f = grass_files[(tx + ty * 7) % len(grass_files)]
                chosen_tile = Image.open(f).convert("RGBA")
                chosen_name = f.name
            elif biomes_set == {"S"}:
                # Чистый песок
                f = sand_files[(tx + ty * 7) % len(sand_files)]
                chosen_tile = Image.open(f).convert("RGBA")
                chosen_name = f.name
            elif biomes_set == {"W", "S"}:
                # Берег вода/песок — watrtl wang
                code = "".join("L" if c == "S" else "W" for c in corners)
                variants = wang.get(code, [])
                if variants:
                    v = variants[0]
                    src = BG / v["name"]
                    chosen_tile = apply_tx(Image.open(src).convert("RGBA"), v["transform"])
                    chosen_name = v["name"]
                    chosen_tx = v["transform"]
            elif biomes_set == {"S", "G"}:
                # Переход песок/трава — пока tgrb (грубо).
                # TODO: использовать tgrs/tgrd для wang sand↔grass.
                if grass_files:
                    f = grass_files[0]
                    chosen_tile = Image.open(f).convert("RGBA")
                    chosen_name = f.name + "(TODO)"
            else:
                # W+G напрямую (без песка) — ОШИБКА конфигурации, fallback на семьё
                chosen_name = "ERR-WG"

            x0 = tx * big_tile
            y0 = ty * big_tile
            if chosen_tile:
                upscaled = chosen_tile.resize((big_tile, big_tile), Image.NEAREST)
                canvas.paste(upscaled, (x0, y0))

            # Подпись
            label_bg_h = 28
            draw.rectangle([x0, y0 + big_tile - label_bg_h, x0 + big_tile, y0 + big_tile],
                           fill=(0, 0, 0, 180))
            line = f"{chosen_name[:18]}"
            draw.text((x0 + 2, y0 + big_tile - label_bg_h + 1), line, fill=(220, 220, 220, 255), font=font)
            draw.text((x0 + 2, y0 + big_tile - label_bg_h + 11), f"{nw}{ne}/{sw}{se}", fill=(180, 220, 180, 255), font=font)
            if chosen_tx != "none":
                draw.text((x0 + 2, y0 + 1), chosen_tx, fill=(255, 200, 80, 255), font=font)

    canvas.save(OUT)
    print(f"✓ {OUT}  ({canvas.size})")


if __name__ == "__main__":
    main()
