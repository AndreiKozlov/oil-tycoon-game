// Маппинг GDD-биома на список конкретных PNG-файлов тайлов.
// Версия G.3.1 — использую только VERIFIED тайлы (проверены пиксельным анализом):
//   • Для биомов суши — только LLLLL (полностью суша во всех 4 углах + центр).
//   • Для глубокой воды — только WWWWW (полностью вода).
//   • Для берега — отдельная wang-таблица (тайлы где есть и суша, и вода).
//
// Wang-стыки берега: для водного тайла с сухопутными соседями выбираем
// файл по 4-битному коду углов (TL TR BL BR), где L=суша, W=вода.

export type Biome =
  | 'forest'
  | 'grassland'
  | 'mountain'
  | 'tundra'
  | 'desert'
  | 'swamp'
  | 'plain'
  | 'volcanic'
  | 'water';

const BASE = '/game/tiles/raw';

// ===== Чистые биомные тайлы (LLLLL) =====

export const BIOME_TILES: Record<Biome, string[]> = {
  // Лес = тёмная-зелёная палитра (tswb с lush green). Берём только LLLLL.
  forest: [
    `${BASE}/bg/tswb000.png`,
    `${BASE}/bg/tswb001.png`,
    `${BASE}/bg/tswb002.png`,
    `${BASE}/bg/tswb003.png`,
    `${BASE}/bg/tswb004.png`,
    `${BASE}/bg/tswb005.png`,
    `${BASE}/bg/tswb010.png`,
    `${BASE}/bg/tswb011.png`,
  ],
  // Степь — желто-зелёная трава (tgrs base).
  grassland: [
    `${BASE}/bg/tgrs000.png`,
    `${BASE}/bg/tgrs001.png`,
    `${BASE}/bg/tgrs002.png`,
    `${BASE}/bg/tgrs003.png`,
    `${BASE}/bg/tgrs010.png`,
  ],
  // Горы — trom (тёмный коричнево-серый).
  mountain: [
    `${BASE}/bg/trom000.png`,
    `${BASE}/bg/trom001.png`,
    `${BASE}/bg/trom002.png`,
    `${BASE}/bg/trom010.png`,
    `${BASE}/bg/trom011.png`,
  ],
  // Тундра — снег (tsnb).
  tundra: [
    `${BASE}/bg/tsnb000.png`,
    `${BASE}/bg/tsnb001.png`,
    `${BASE}/bg/tsnb002.png`,
    `${BASE}/bg/tsnb003.png`,
    `${BASE}/bg/tsnb004.png`,
  ],
  // Пустыня — песок (tsab).
  desert: [
    `${BASE}/bg/tsab000.png`,
    `${BASE}/bg/tsab001.png`,
    `${BASE}/bg/tsab002.png`,
    `${BASE}/bg/tsab003.png`,
    `${BASE}/bg/tsab004.png`,
  ],
  // Болото — tswd (грязно-зелёный).
  swamp: [
    `${BASE}/bg/tswd000.png`,
    `${BASE}/bg/tswd001.png`,
    `${BASE}/bg/tswd002.png`,
    `${BASE}/bg/tswd010.png`,
  ],
  // Равнина (бесресурсная инфраструктурная) — обычная земля (tdtb).
  plain: [
    `${BASE}/bg/tdtb000.png`,
    `${BASE}/bg/tdtb001.png`,
    `${BASE}/bg/tdtb002.png`,
    `${BASE}/bg/tdtb003.png`,
    `${BASE}/bg/tdtb010.png`,
  ],
  // Вулканическая пустошь — tvlb.
  volcanic: [
    `${BASE}/bg/tvlb000.png`,
    `${BASE}/bg/tvlb001.png`,
    `${BASE}/bg/tvlb002.png`,
    `${BASE}/bg/tvld000.png`,
  ],
  // Чистая глубокая вода — только WWWWW.
  water: [
    `${BASE}/bg/watrtl21.png`,
    `${BASE}/bg/watrtl22.png`,
    `${BASE}/bg/watrtl23.png`,
    `${BASE}/bg/watrtl24.png`,
    `${BASE}/bg/watrtl25.png`,
    `${BASE}/bg/watrtl26.png`,
  ],
};

// ===== Wang-таблица берегов (вода с островками-сушей по углам) =====
// Код угла: TL TR BL BR. L = в этом углу есть сушесосед, W = чистая вода.
// Применяется ТОЛЬКО к водным тайлам у берега.

export type ShoreCode =
  | 'LLLW'
  | 'LLWL'
  | 'WLLL'
  | 'LWLL'
  | 'LLWW'
  | 'WWLL'
  | 'LWLW'
  | 'WLWL'
  | 'LWWL'
  | 'WLLW'
  | 'WWLW'
  | 'WWWL';

export const SHORE_TILES: Record<ShoreCode, string[]> = {
  // 1 угол вода (LLLW = вода в BR, остальные суша)
  LLLW: [
    `${BASE}/bg/Tshre01.png`,
    `${BASE}/bg/Tshre21.png`,
    `${BASE}/bg/Tshre24.png`,
    `${BASE}/bg/watrtl01.png`,
    `${BASE}/bg/watrtl02.png`,
    `${BASE}/bg/watrtl03.png`,
    `${BASE}/bg/watrtl04.png`,
    `${BASE}/bg/watrtl17.png`,
    `${BASE}/bg/watrtl18.png`,
  ],
  LLWL: [
    `${BASE}/bg/Tshrc03.png`,
    `${BASE}/bg/Tshre00.png`,
    `${BASE}/bg/Tshre16.png`,
    `${BASE}/bg/Tshre18.png`,
    `${BASE}/bg/Tshre19.png`,
  ],
  WLLL: [
    `${BASE}/bg/Tshre20.png`,
    `${BASE}/bg/Tshre25.png`,
  ],
  LWLL: [`${BASE}/bg/Tshre30.png`],

  // 2 угла вода (диагональ)
  LWLW: [
    `${BASE}/bg/Tshrc04.png`,
    `${BASE}/bg/watrtl05.png`,
    `${BASE}/bg/watrtl06.png`,
    `${BASE}/bg/watrtl07.png`,
    `${BASE}/bg/watrtl08.png`,
  ],
  WLWL: [
    `${BASE}/bg/Tshre02.png`,
    `${BASE}/bg/Tshre03.png`,
    `${BASE}/bg/Tshre26.png`,
  ],
  // 2 угла вода (сторона)
  LLWW: [
    `${BASE}/bg/Tshrc01.png`,
    `${BASE}/bg/Tshre23.png`,
    `${BASE}/bg/watrtl09.png`,
    `${BASE}/bg/watrtl10.png`,
    `${BASE}/bg/watrtl11.png`,
    `${BASE}/bg/watrtl12.png`,
  ],
  WWLL: [
    `${BASE}/bg/Tshre04.png`,
    `${BASE}/bg/Tshre05.png`,
    `${BASE}/bg/Tshre22.png`,
  ],
  LWWL: [
    `${BASE}/bg/Tshre11.png`,
    `${BASE}/bg/Tshre13.png`,
    `${BASE}/bg/Tshre27.png`,
  ],
  WLLW: [
    `${BASE}/bg/Tshre12.png`,
    `${BASE}/bg/Tshre17.png`,
    `${BASE}/bg/Tshre28.png`,
  ],

  // 3 угла вода
  WWLW: [
    `${BASE}/bg/Tshrc02.png`,
    `${BASE}/bg/Tshre15.png`,
  ],
  WWWL: [
    `${BASE}/bg/watrtl13.png`,
    `${BASE}/bg/watrtl14.png`,
    `${BASE}/bg/watrtl15.png`,
    `${BASE}/bg/watrtl16.png`,
    `${BASE}/bg/watrtl19.png`,
    `${BASE}/bg/watrtl20.png`,
  ],
};

// ===== Метаданные биома =====

export const BIOME_INFO: Record<
  Biome,
  { name: string; emoji: string; isLand: boolean; hexColor: string }
> = {
  forest: { name: 'Лес', emoji: '🌲', isLand: true, hexColor: '#264e31' },
  grassland: { name: 'Поле', emoji: '🌾', isLand: true, hexColor: '#83724f' },
  mountain: { name: 'Горы', emoji: '⛰', isLand: true, hexColor: '#7e6145' },
  tundra: { name: 'Тундра', emoji: '❄️', isLand: true, hexColor: '#d4d9e0' },
  desert: { name: 'Пустыня', emoji: '🏜', isLand: true, hexColor: '#c59a7a' },
  swamp: { name: 'Болото', emoji: '🪵', isLand: true, hexColor: '#4f5334' },
  plain: { name: 'Равнина', emoji: '⬜', isLand: true, hexColor: '#b69072' },
  volcanic: { name: 'Пустошь', emoji: '🌋', isLand: true, hexColor: '#3a3233' },
  water: { name: 'Вода', emoji: '🌊', isLand: false, hexColor: '#3a5060' },
};

// ===== Детерминированный выбор варианта =====

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = h >>> 0;
  return h;
}

export function pickBiomeTile(biome: Biome, x: number, y: number): string {
  const variants = BIOME_TILES[biome];
  return variants[hash(x, y, 1) % variants.length]!;
}

export function pickShoreTile(code: ShoreCode, x: number, y: number): string {
  const variants = SHORE_TILES[code];
  return variants[hash(x, y, 2) % variants.length]!;
}

// ===== Список всех уникальных PNG для предзагрузки =====

export function getAllUniqueTilePaths(): string[] {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_TILES)) {
    for (const p of list) set.add(p);
  }
  for (const list of Object.values(SHORE_TILES)) {
    for (const p of list) set.add(p);
  }
  return Array.from(set);
}
