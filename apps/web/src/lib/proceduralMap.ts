// Прототипный генератор карты. Псевдо-Землеподобная карта на клиенте.
// На проде заменим серверной генерацией из Natural Earth raster (G.4+).
//
// Алгоритм:
//   1. height(x, y)   = value noise → определяет вода / суша / горы
//   2. temperature(y) = по широте (полюса холодные, экватор горячий)
//   3. moisture(x, y) = value noise → определяет лес / степь / пустыня
//
// Биом выбирается из пары (temperature, moisture) для суши, иначе вода.

import type { Biome } from './biomeMap';

// Детерминированный псевдо-хеш по (x, y, seed) → [0, 1).
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// Smoothstep для плавных переходов.
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// Двумерный value-noise. Возвращает [0, 1).
function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;

  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);

  const ux = smooth(fx);
  const uy = smooth(fy);

  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}

// Несколько октав = более «природный» рельеф.
function fbm(x: number, y: number, scale: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let maxAmp = 0;
  let s = scale;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x, y, s, seed + i * 1000) * amplitude;
    maxAmp += amplitude;
    amplitude *= 0.5;
    s *= 0.5;
  }
  return value / maxAmp;
}

export interface MapConfig {
  width: number;
  height: number;
  seed: number;
  // Морской уровень: какая часть карты — вода. 0.5 = половина вода.
  seaLevel: number;
}

// Прод-размер карты под 30 000 сухопутных тайлов (Земля = 29.2% суши).
// Сетка 452×227 = 102 604 тайлов всего, ~30 000 земных.
// Соотношение 2:1 как Меркатор.
//
// На этапе G.4 эта карта будет заменена на сервер-сгенерированную из
// Natural Earth raster (реальная Земля). Сейчас — процедурная Perlin-карта
// в прод-размере, чтобы клиент был сразу масштабирован под боевую нагрузку.
export const DEFAULT_MAP: MapConfig = {
  width: 452,
  height: 227,
  seed: 42,
  // 30 023 сухопутных тайла при 0.56 — точно цель GDD (~30k).
  seaLevel: 0.56,
};

export function biomeAt(x: number, y: number, cfg: MapConfig): Biome {
  const h = fbm(x, y, 30, 4, cfg.seed);

  // Морской уровень.
  if (h < cfg.seaLevel) return 'water';

  // Высота над уровнем моря [0, 1].
  const elevation = (h - cfg.seaLevel) / (1 - cfg.seaLevel);

  // Отдельный noise для горных хребтов — концентрирует горы в полосы
  // (не равномерно по всей суше).
  const ridge = fbm(x, y, 60, 3, cfg.seed + 11111);

  // Горы — комбинация высоты и горного noise. Так получаем "хребты" вдоль
  // континентов вместо редких отдельных пиков.
  if (elevation > 0.35 && ridge > 0.5) return 'mountain';
  if (elevation > 0.55) return 'mountain';

  // Температура от широты.
  const latNorm = (y / cfg.height) * 2 - 1;
  const temperature = 1 - Math.abs(latNorm);

  // Влажность — отдельный noise.
  const moisture = fbm(x, y, 40, 3, cfg.seed + 5000);

  // На экваторе при высокой влажности — джунгли (лес), не пустыня.
  // Пустыни — это широты ~20-40° (саванна-пустыня), не экватор.
  const isEquator = temperature > 0.85;
  const isSubtropic = temperature > 0.55 && temperature < 0.85;

  if (temperature < 0.25) {
    return 'tundra';
  }

  // Тропические леса на экваторе.
  if (isEquator && moisture > 0.45) {
    return 'forest';
  }

  // Пустыни в субтропиках с низкой влажностью (Сахара, Аравия, Австралия).
  if (isSubtropic && moisture < 0.38) {
    return 'desert';
  }

  // Экваториальные саванны/пустыни при сухости.
  if (isEquator && moisture < 0.3) {
    return 'desert';
  }

  // Низменные влажные участки — болота.
  if (elevation < 0.15 && moisture > 0.65 && temperature > 0.45) {
    return 'swamp';
  }

  // Влажные не-экваториальные — умеренные леса (тайга/смешанный лес).
  if (moisture > 0.55) {
    return 'forest';
  }

  // Травянистые степи.
  if (moisture > 0.35) {
    return 'grassland';
  }

  // Остальное — равнина.
  return 'plain';
}

// Полная карта в виде плоского массива биомов.
export function generateMap(cfg: MapConfig = DEFAULT_MAP): Biome[] {
  const out = new Array<Biome>(cfg.width * cfg.height);
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) {
      out[y * cfg.width + x] = biomeAt(x, y, cfg);
    }
  }
  return out;
}

export function biomeAtIndex(map: Biome[], cfg: MapConfig, x: number, y: number): Biome | null {
  if (x < 0 || x >= cfg.width || y < 0 || y >= cfg.height) return null;
  return map[y * cfg.width + x] ?? null;
}
