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

// Маппинг подобран после визуального пиксельного аудита всех LLLLL-тайлов.
// Группы: см. /tmp/audit_land.py.
export const BIOME_TILES: Record<Biome, string[]> = {
  // Лес = насыщенный тёмно-зелёный (tswb base, #2a4e2f).
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
  // Поле/степь = ярко-зелёная трава (tilemap/tgrb, #30491d). 24 файла.
  grassland: [
    `${BASE}/tilemap/tgrb000.png`,
    `${BASE}/tilemap/tgrb001.png`,
    `${BASE}/tilemap/tgrb002.png`,
    `${BASE}/tilemap/tgrb003.png`,
    `${BASE}/tilemap/tgrb010.png`,
    `${BASE}/tilemap/tgrb011.png`,
    `${BASE}/tilemap/tgrb012.png`,
    `${BASE}/tilemap/tgrb013.png`,
    `${BASE}/tilemap/tgrb020.png`,
    `${BASE}/tilemap/tgrb021.png`,
  ],
  // Горы = тёмные скалы (trom + rocktl). 63 файла суммарно.
  mountain: [
    `${BASE}/bg/trom000.png`,
    `${BASE}/bg/trom001.png`,
    `${BASE}/bg/trom002.png`,
    `${BASE}/bg/trom010.png`,
    `${BASE}/bg/trom011.png`,
    `${BASE}/bg/trom012.png`,
    `${BASE}/tilemap/rocktl01.png`,
    `${BASE}/tilemap/rocktl02.png`,
    `${BASE}/tilemap/rocktl03.png`,
    `${BASE}/tilemap/rocktl04.png`,
    `${BASE}/tilemap/rocktl05.png`,
  ],
  // Тундра = снег (tsnb, #e8eaef). Самый светлый.
  tundra: [
    `${BASE}/bg/tsnb000.png`,
    `${BASE}/bg/tsnb001.png`,
    `${BASE}/bg/tsnb002.png`,
    `${BASE}/bg/tsnb003.png`,
    `${BASE}/bg/tsnb004.png`,
    `${BASE}/bg/tsnb005.png`,
    `${BASE}/bg/tsnb010.png`,
    `${BASE}/bg/tsnb011.png`,
  ],
  // Пустыня = песок (tsab, #b69374). Тёплый светло-коричневый.
  desert: [
    `${BASE}/bg/tsab000.png`,
    `${BASE}/bg/tsab001.png`,
    `${BASE}/bg/tsab002.png`,
    `${BASE}/bg/tsab003.png`,
    `${BASE}/bg/tsab004.png`,
    `${BASE}/bg/tsab005.png`,
    `${BASE}/bg/tsab010.png`,
    `${BASE}/bg/tsab011.png`,
  ],
  // Болото = желто-зелёная грязь (tswd + tsws, #445232).
  swamp: [
    `${BASE}/bg/tswd000.png`,
    `${BASE}/bg/tswd001.png`,
    `${BASE}/bg/tswd002.png`,
    `${BASE}/bg/tswd010.png`,
    `${BASE}/bg/tsws000.png`,
    `${BASE}/bg/tsws001.png`,
  ],
  // Равнина = обычная земля/дёрн (tdtb, #6b4d2e). Бесресурсная.
  plain: [
    `${BASE}/tilemap/tdtb000.png`,
    `${BASE}/tilemap/tdtb001.png`,
    `${BASE}/tilemap/tdtb002.png`,
    `${BASE}/tilemap/tdtb003.png`,
    `${BASE}/tilemap/tdtb010.png`,
    `${BASE}/tilemap/tdtb011.png`,
  ],
  // Сухая степь / прерия (бывшая grassland, теперь второй вариант) = tgrs (#6e6743).
  // Используется как «выжженное поле»: оставлен в типе biome для будущего.
  volcanic: [
    `${BASE}/bg/tvlb000.png`,
    `${BASE}/bg/tvlb001.png`,
    `${BASE}/bg/tvlb002.png`,
    `${BASE}/bg/tvld000.png`,
  ],
  // Чистая глубокая вода (watrtl21-26, WWWWW).
  water: [
    `${BASE}/bg/watrtl21.png`,
    `${BASE}/bg/watrtl22.png`,
    `${BASE}/bg/watrtl23.png`,
    `${BASE}/bg/watrtl24.png`,
    `${BASE}/bg/watrtl25.png`,
    `${BASE}/bg/watrtl26.png`,
  ],
};

// ===== Wang-таблица берегов =====
// Tshrc/Tshre удалены пользователем как несовместимые. Используем только
// watrtl, поэтому покрыты 4 wang-кода. Недостающие коды рисуются как чистая
// вода (fallback в WorldMapCanvas).
//
// Код угла: TL TR BL BR. L = есть сушесосед, W = чистая вода.

export type ShoreCode = 'LLLW' | 'LLWW' | 'LWLW' | 'WWWL';

export const SHORE_TILES: Record<ShoreCode, string[]> = {
  // Суша в 3 углах, вода в BR.
  LLLW: [
    `${BASE}/bg/watrtl01.png`,
    `${BASE}/bg/watrtl02.png`,
    `${BASE}/bg/watrtl03.png`,
    `${BASE}/bg/watrtl04.png`,
    `${BASE}/bg/watrtl17.png`,
    `${BASE}/bg/watrtl18.png`,
  ],
  // Суша сверху (TL, TR), вода снизу.
  LLWW: [
    `${BASE}/bg/watrtl09.png`,
    `${BASE}/bg/watrtl10.png`,
    `${BASE}/bg/watrtl11.png`,
    `${BASE}/bg/watrtl12.png`,
  ],
  // Суша слева (TL, BL), вода справа.
  LWLW: [
    `${BASE}/bg/watrtl05.png`,
    `${BASE}/bg/watrtl06.png`,
    `${BASE}/bg/watrtl07.png`,
    `${BASE}/bg/watrtl08.png`,
  ],
  // Вода в 3 углах, суша только в BR.
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
