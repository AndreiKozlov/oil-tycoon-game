// Wang-атлас: один PNG со всеми тайлами Heroes 3 + JSON с раскладкой.
//
// Атлас сгенерирован офлайн скриптом apps/web/scripts/build_game_atlas.py,
// который классифицирует каждый тайл по 4-битной маске углов (NW/NE/SW/SE).
// Здесь только загрузчик и API выбора тайла по соседям клетки.
//
// Маска углов клетки (x, y):
//   bit 0 (1)  = NW: общий угол клеток (x-1,y-1),(x,y-1),(x-1,y),(x,y)
//   bit 1 (2)  = NE: общий угол (x,y-1),(x+1,y-1),(x,y),(x+1,y)
//   bit 2 (4)  = SW: общий угол (x-1,y),(x,y),(x-1,y+1),(x,y+1)
//   bit 3 (8)  = SE: общий угол (x,y),(x+1,y),(x,y+1),(x+1,y+1)
// Угол считается "свой биом", если хотя бы одна из 4 соседних клеток
// принадлежит тому же биому-семейству (Heroes 3 group).

import type { Biome } from './biomeMap';

// Heroes 3 biome groups, соответствующие нашему атласу.
export type HBiome = 'grass' | 'dirt' | 'sand' | 'snow' | 'swamp' | 'sub' | 'volc' | 'rough';

// GDD biome → Heroes 3 biome для wang-стыковки.
//   forest    → swamp (тёмно-зелёная трава tswb, насыщенная)
//   grassland → grass (яркая трава tgrb)
//   mountain  → rough (скалы trob)
//   tundra    → snow (снег tsnb)
//   desert    → sand (песок tsab)
//   swamp     → swamp
//   plain     → dirt (земля tdtb)
//   volcanic  → volc (вулканическая порода tvlb)
//   water     → не в атласе, рисуется отдельно через SHORE_TILES_TX
export const BIOME_TO_HBIOME: Record<Biome, HBiome | null> = {
  forest: 'swamp',
  grassland: 'grass',
  mountain: 'rough',
  tundra: 'snow',
  desert: 'sand',
  swamp: 'swamp',
  plain: 'dirt',
  volcanic: 'volc',
  water: null,
};

export interface AtlasMeta {
  tile_size: number;
  atlas: { file: string; cols: number; rows: number; width: number; height: number; total_tiles: number };
  wang: Record<HBiome, Record<string, number[]>>;
  tile_names: string[];
}

let _atlasImage: HTMLImageElement | null = null;
let _atlasMeta: AtlasMeta | null = null;
let _loadingPromise: Promise<void> | null = null;

const ATLAS_PNG_URL = '/game/tiles/atlas.png';
const ATLAS_JSON_URL = '/game/tiles/atlas.json';

export async function loadAtlas(): Promise<void> {
  if (_atlasImage && _atlasMeta) return;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    const [img, meta] = await Promise.all([
      new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = (e) => reject(e);
        i.src = ATLAS_PNG_URL;
      }),
      fetch(ATLAS_JSON_URL).then((r) => r.json() as Promise<AtlasMeta>),
    ]);
    _atlasImage = img;
    _atlasMeta = meta;
  })();
  return _loadingPromise;
}

export function isAtlasReady(): boolean {
  return _atlasImage !== null && _atlasMeta !== null;
}

export function getAtlasImage(): HTMLImageElement | null {
  return _atlasImage;
}

export function getAtlasMeta(): AtlasMeta | null {
  return _atlasMeta;
}

// Псевдослучайный детерминированный выбор варианта тайла из бакета маски.
function hash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h >>> 0);
}

/**
 * Выбирает тайл из атласа по биому и 4-угловой маске.
 * Возвращает координаты (sx, sy) в атласе или null, если для маски нет тайлов.
 */
export function pickTileForMask(
  hbiome: HBiome,
  mask: number,
  x: number,
  y: number,
): { sx: number; sy: number } | null {
  const meta = _atlasMeta;
  if (!meta) return null;
  const biomeTable = meta.wang[hbiome];
  if (!biomeTable) return null;

  // Пробуем точную маску, потом fallback'и.
  const fallbackOrder = [mask, 15, 0, 3, 12, 5, 10, 7, 11, 13, 14];
  for (const m of fallbackOrder) {
    const candidates = biomeTable[String(m)];
    if (candidates && candidates.length > 0) {
      const idx = candidates[hash(x, y, m) % candidates.length]!;
      const cols = meta.atlas.cols;
      return {
        sx: (idx % cols) * meta.tile_size,
        sy: Math.floor(idx / cols) * meta.tile_size,
      };
    }
  }
  return null;
}

/**
 * Считает 4-угловую маску для клетки (cx, cy) по биом-карте.
 * Если хотя бы 1 из 4 клеток, формирующих угол, имеет тот же hbiome —
 * угол "свой".
 *
 * @param sample  callback(x, y) → HBiome | null. null = вне карты или вода.
 */
export function computeCornerMask(
  cx: number,
  cy: number,
  ownHBiome: HBiome,
  sample: (x: number, y: number) => HBiome | null,
): number {
  // 4 угла: каждый — общий между 4 клетками вокруг.
  // NW: (cx-1,cy-1),(cx,cy-1),(cx-1,cy),(cx,cy)
  // NE: (cx,cy-1),(cx+1,cy-1),(cx,cy),(cx+1,cy)
  // SW: (cx-1,cy),(cx,cy),(cx-1,cy+1),(cx,cy+1)
  // SE: (cx,cy),(cx+1,cy),(cx,cy+1),(cx+1,cy+1)
  const sameAs = (x: number, y: number) => sample(x, y) === ownHBiome;
  let mask = 0;
  if (sameAs(cx - 1, cy - 1) || sameAs(cx, cy - 1) || sameAs(cx - 1, cy) || sameAs(cx, cy)) mask |= 1;
  if (sameAs(cx, cy - 1) || sameAs(cx + 1, cy - 1) || sameAs(cx, cy) || sameAs(cx + 1, cy)) mask |= 2;
  if (sameAs(cx - 1, cy) || sameAs(cx, cy) || sameAs(cx - 1, cy + 1) || sameAs(cx, cy + 1)) mask |= 4;
  if (sameAs(cx, cy) || sameAs(cx + 1, cy) || sameAs(cx, cy + 1) || sameAs(cx + 1, cy + 1)) mask |= 8;
  return mask;
}
