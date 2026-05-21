#!/usr/bin/env python3
"""
Определение размера изометрического ромба в newtile.png.

Идея: алфа-канал даёт силуэт. Если найти на одном из островов
самую северную видимую точку (top vertex ромба), то размеры можно
оценить, ища расстояние до самой западной/восточной точек.

Также проверим гипотезы: 64×32, 128×64, 96×48, 32×16. Для каждой:
найдём первый top-vertex (на y=N где сверху прозрачно а на N+1 непрозрачно),
и проверим что ромб действительно укладывается в гипотетический размер.
"""
from PIL import Image
from pathlib import Path

SRC = Path("/root/oil_tycoon_project/newtile.png")


def main():
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    W, H = im.size

    # Найдём самые северные непрозрачные пиксели в каждой колонке
    print("Top-most opaque pixel in each column (first 100 cols):")
    for x in range(0, W, 16):
        for y in range(H):
            if px[x, y][3] > 200:
                print(f"  col {x}: top at y={y}, RGB={px[x,y][:3]}")
                break

    print()
    print("Bottom-most opaque pixel in each column (first 100 cols):")
    for x in range(0, W, 16):
        for y in range(H - 1, -1, -1):
            if px[x, y][3] > 200:
                print(f"  col {x}: bottom at y={y}")
                break

    # Левая граница: для каждой строки самый левый непрозрачный
    print()
    print("Left-most opaque in each row (every 32):")
    for y in range(0, H, 32):
        for x in range(W):
            if px[x, y][3] > 200:
                print(f"  row {y}: left at x={x}")
                break


if __name__ == "__main__":
    main()
