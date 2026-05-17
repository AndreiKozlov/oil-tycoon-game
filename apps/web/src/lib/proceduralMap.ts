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

export const DEFAULT_MAP: MapConfig = {
  width: 100,
  height: 60,
  seed: 42,
  seaLevel: 0.42,
};

export function biomeAt(x: number, y: number, cfg: MapConfig): Biome {
  const h = fbm(x, y, 30, 4, cfg.seed);

  // Морской уровень.
  if (h < cfg.seaLevel) return 'water';

  // Сколько высоко над уровнем моря.
  const elevation = (h - cfg.seaLevel) / (1 - cfg.seaLevel); // [0, 1]

  // Горы — высокие зоны.
  if (elevation > 0.78) return 'mountain';

  // Прибрежная полоса — узкая равнина у воды (раньше был отдельный биом shore,
  // теперь не нужен — wang-переходы рендерятся автоматически).
  if (elevation < 0.06) return 'plain';

  // Температура от широты (y=0 — северный полюс, y=height — южный).
  // На широте 0 и height: cold. На height/2: hot.
  const latNorm = (y / cfg.height) * 2 - 1; // [-1, 1]
  const temperature = 1 - Math.abs(latNorm); // 0 на полюсах, 1 на экваторе

  // Влажность — отдельный noise.
  const moisture = fbm(x, y, 40, 3, cfg.seed + 5000);

  // Логика биомов:
  if (temperature < 0.25) {
    // Близко к полюсам → тундра.
    return 'tundra';
  }
  if (temperature > 0.78 && moisture < 0.35) {
    // Экваториальная сушь → пустыня.
    return 'desert';
  }
  if (moisture > 0.62) {
    // Влажно → лес или болото.
    if (elevation < 0.18 && temperature > 0.5) return 'swamp';
    return 'forest';
  }
  if (moisture > 0.4) {
    return 'grassland';
  }
  // Остальное — равнина (мало плодородия, инфраструктурный потенциал).
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
