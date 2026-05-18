// Процедурный рендер тайлов в Canvas. БЕЗ ВНЕШНИХ PNG.
//
// Идея: каждый тайл рисуем напрямую в ImageData как 32×32 пиксельный массив.
//   1. Базовый цвет биома + лёгкий per-pixel шум для текстуры.
//   2. Декорации (точки/штрихи для разных биомов).
//   3. На границах: dither-pattern с цветом соседнего биома — плавный переход.
//
// Стиль вдохновлён Polytopia / The Battle of Polytopia — чистый, плоский,
// читаемый. Полный контроль над каждым пикселем.

import type { Biome } from './biomeMap';

export const TILE_SIZE = 32;

// Палитра: основные цвета биомов + 2 акцента (тёмный и светлый).
interface BiomePalette {
  main: [number, number, number];
  dark: [number, number, number];
  light: [number, number, number];
  accent: [number, number, number];
}

export const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  forest: {
    main: [44, 95, 52],
    dark: [22, 60, 30],
    light: [78, 130, 70],
    accent: [128, 90, 45], // стволы деревьев
  },
  grassland: {
    main: [98, 154, 64],
    dark: [70, 120, 45],
    light: [140, 190, 95],
    accent: [200, 200, 80], // полевые цветы
  },
  mountain: {
    main: [110, 95, 88],
    dark: [60, 50, 45],
    light: [180, 175, 170],
    accent: [240, 240, 245], // снежные вершины
  },
  tundra: {
    main: [220, 230, 240],
    dark: [165, 175, 195],
    light: [255, 255, 255],
    accent: [90, 110, 130], // тёмные камни в снегу
  },
  desert: {
    main: [218, 184, 110],
    dark: [175, 140, 80],
    light: [248, 220, 155],
    accent: [120, 90, 50], // тёмные камни/кустики
  },
  swamp: {
    main: [70, 90, 55],
    dark: [40, 55, 30],
    light: [100, 125, 80],
    accent: [60, 75, 110], // лужи
  },
  plain: {
    main: [160, 130, 85],
    dark: [115, 90, 55],
    light: [200, 170, 125],
    accent: [180, 150, 90],
  },
  volcanic: {
    main: [70, 50, 50],
    dark: [40, 25, 25],
    light: [120, 90, 75],
    accent: [220, 90, 40], // лава
  },
  water: {
    main: [50, 100, 145],
    dark: [25, 55, 95],
    light: [85, 145, 195],
    accent: [180, 220, 240], // блики
  },
};

// Детерминированный псевдо-хеш для (x, y, salt).
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = h >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// Применить лёгкий jitter к компоненту цвета.
function jitterChannel(c: number, jitter: number): number {
  return Math.max(0, Math.min(255, c + jitter));
}

// Рендерит ОДИН тайл биома в ImageData (32×32 пикселя).
// Параметр neighbors: { N, S, E, W } — биомы соседних тайлов (для wang dither).
export function renderTilePixels(
  biome: Biome,
  tileX: number,
  tileY: number,
  neighbors: { N: Biome | null; S: Biome | null; E: Biome | null; W: Biome | null },
): Uint8ClampedArray {
  const palette = BIOME_PALETTES[biome];
  const data = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      // Решаем какой биом использовать для этого пикселя:
      // - в центре всегда свой биом
      // - на границе — шанс «принадлежать» соседу по dither-pattern
      const targetBiome = chooseBiomeForPixel(biome, neighbors, px, py, tileX, tileY);
      const pal = BIOME_PALETTES[targetBiome];

      // Базовый шум для текстуры: смешиваем main + dark/light по noise.
      const n = hash(tileX * TILE_SIZE + px, tileY * TILE_SIZE + py, 1);
      let r: number, g: number, b: number;
      if (n < 0.15) {
        [r, g, b] = pal.dark;
      } else if (n < 0.30) {
        [r, g, b] = pal.light;
      } else {
        [r, g, b] = pal.main;
      }

      // Дополнительный per-pixel jitter ±8 для плавной текстуры.
      const j = hash(tileX * TILE_SIZE + px, tileY * TILE_SIZE + py, 7);
      const dj = Math.round((j - 0.5) * 12);
      r = jitterChannel(r, dj);
      g = jitterChannel(g, dj);
      b = jitterChannel(b, dj);

      // Декоративные элементы (точки) — раз в N пикселей.
      const decor = hash(tileX * TILE_SIZE + px, tileY * TILE_SIZE + py, 3);
      const decorChance = decorChanceFor(targetBiome);
      if (decor < decorChance) {
        [r, g, b] = pal.accent;
      }

      const idx = (py * TILE_SIZE + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  return data;
}

// Шанс декорации на пиксель — определяет «плотность узоров».
function decorChanceFor(biome: Biome): number {
  switch (biome) {
    case 'forest':
      return 0.05; // частые тёмные точки = плотные деревья
    case 'grassland':
      return 0.01; // редкие цветы
    case 'mountain':
      return 0.04; // снежные пятна
    case 'tundra':
      return 0.02; // редкие камни
    case 'desert':
      return 0.005; // редкие камешки
    case 'swamp':
      return 0.03; // лужи
    case 'plain':
      return 0.005;
    case 'volcanic':
      return 0.02; // лавовые пятна
    case 'water':
      return 0.008; // редкие блики
  }
}

// Решение: какой биом ПРИНАДЛЕЖИТ этому пикселю с учётом dither-перехода.
// Внутренние пиксели — всегда свой биом. Близко к краю — шанс быть соседом.
function chooseBiomeForPixel(
  own: Biome,
  neighbors: { N: Biome | null; S: Biome | null; E: Biome | null; W: Biome | null },
  px: number,
  py: number,
  tileX: number,
  tileY: number,
): Biome {
  // Расстояние до каждой из 4 сторон (в пикселях, 0 = на границе).
  const dN = py;
  const dS = TILE_SIZE - 1 - py;
  const dE = TILE_SIZE - 1 - px;
  const dW = px;

  // BLEND_WIDTH = насколько широка зона перехода (в пикселях).
  const BLEND = 8;

  // Для каждой стороны: если сосед — другой биом и пиксель близок к этой стороне,
  // даём ему шанс «быть соседом» по dither-pattern.
  const sides: { dist: number; nb: Biome | null }[] = [
    { dist: dN, nb: neighbors.N },
    { dist: dS, nb: neighbors.S },
    { dist: dE, nb: neighbors.E },
    { dist: dW, nb: neighbors.W },
  ];

  for (const { dist, nb } of sides) {
    if (nb === null || nb === own) continue;
    if (dist >= BLEND) continue;

    // Чем ближе к границе — тем выше шанс быть соседом.
    // На самой границе (dist=0) шанс 1.0, на BLEND-1 шанс ~0.
    const probability = (BLEND - dist) / BLEND;

    // Bayer 4×4 dither-matrix — даёт правильный пиксельный паттерн.
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    const threshold = bayer[py % 4]![px % 4]! / 16;

    if (threshold < probability) {
      return nb;
    }
  }

  return own;
}

// Кэш отрендеренных тайлов: key = `${biome}|N|S|E|W` → ImageData.
// На карте мы не пере-генерируем картинку для каждого тайла — есть много
// одинаковых конфигураций.
const tileCache = new Map<string, ImageData>();

export function getOrRenderTile(
  ctx: CanvasRenderingContext2D,
  biome: Biome,
  neighbors: { N: Biome | null; S: Biome | null; E: Biome | null; W: Biome | null },
  tileX: number,
  tileY: number,
): ImageData {
  // Cache key учитывает только биом+соседей (не x/y), но per-pixel шум зависит от x/y.
  // Это компромис: кэш по типам границ, но шум каждый раз новый.
  // Сделаем 4 варианта шума (по hash от x/y % 4) — достаточно разнообразия.
  const variant = ((tileX * 31 + tileY * 7) & 3) >>> 0;
  const key = `${biome}|${neighbors.N ?? '_'}|${neighbors.S ?? '_'}|${neighbors.E ?? '_'}|${neighbors.W ?? '_'}|v${variant}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  // Используем variant как смещение в hash, чтобы получить разные варианты текстуры
  // для одинаковых соседских конфигураций.
  const data = renderTilePixels(biome, variant * 1000 + tileX % 100, variant * 1000 + tileY % 100, neighbors);
  const imgData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  imgData.data.set(data);
  tileCache.set(key, imgData);
  return imgData;
}

// Сброс кэша (полезно при изменении палитры или dither-параметров).
export function clearTileCache(): void {
  tileCache.clear();
}
