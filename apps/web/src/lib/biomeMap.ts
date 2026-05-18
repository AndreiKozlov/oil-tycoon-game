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
  // Горы = тёмные скалы (trom). rocktl удалён пользователем.
  mountain: [
    `${BASE}/bg/trom000.png`,
    `${BASE}/bg/trom001.png`,
    `${BASE}/bg/trom002.png`,
    `${BASE}/bg/trom010.png`,
    `${BASE}/bg/trom011.png`,
    `${BASE}/bg/trom012.png`,
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
// Сам набор watrtl содержит ТОЛЬКО 4 базовых кода. Остальные 11 кодов
// получаются ЗЕРКАЛЬНЫМИ ОТРАЖЕНИЯМИ (horizontal flip / vertical flip /
// rotation 180°). Конкретные трансформации — см. SHORE_TILE_TRANSFORMS.
//
// Код угла: TL TR BL BR. L = есть сушесосед, W = чистая вода.
// 14 wang-кодов (15-й = WWWW = чистая глубокая вода).

export type ShoreCode =
  | 'LLLL' // вода окружена сушей со всех 4 сторон → озеро/залив
  | 'LLLW' // вода в BR
  | 'LLWL' // вода в BL
  | 'LWLL' // вода в TR
  | 'WLLL' // вода в TL
  | 'LLWW' // вода в BL+BR (низ)
  | 'WWLL' // вода в TL+TR (верх)
  | 'LWLW' // вода в TR+BR (правая)
  | 'WLWL' // вода в TL+BL (левая)
  | 'LWWL' // вода в TR+BL (диагональ ↗)
  | 'WLLW' // вода в TL+BR (диагональ ↘)
  | 'WWWL' // вода в TL+TR+BL, суша в BR
  | 'WWLW' // вода в TL+TR+BR, суша в BL
  | 'WLWW' // вода в TL+BL+BR, суша в TR
  | 'LWWW' // вода в TR+BL+BR, суша в TL
  ;

// Базовые watrtl-тайлы с натуральными wang-кодами (из аудита):
const WATRTL_LLLW = [
  `${BASE}/bg/watrtl01.png`,
  `${BASE}/bg/watrtl02.png`,
  `${BASE}/bg/watrtl03.png`,
  `${BASE}/bg/watrtl04.png`,
  `${BASE}/bg/watrtl17.png`,
  `${BASE}/bg/watrtl18.png`,
];
const WATRTL_LLWW = [
  `${BASE}/bg/watrtl09.png`,
  `${BASE}/bg/watrtl10.png`,
  `${BASE}/bg/watrtl11.png`,
  `${BASE}/bg/watrtl12.png`,
];
const WATRTL_LWLW = [
  `${BASE}/bg/watrtl05.png`,
  `${BASE}/bg/watrtl06.png`,
  `${BASE}/bg/watrtl07.png`,
  `${BASE}/bg/watrtl08.png`,
];
const WATRTL_WWWL = [
  `${BASE}/bg/watrtl13.png`,
  `${BASE}/bg/watrtl14.png`,
  `${BASE}/bg/watrtl15.png`,
  `${BASE}/bg/watrtl16.png`,
  `${BASE}/bg/watrtl19.png`,
  `${BASE}/bg/watrtl20.png`,
];

// Трансформации в Canvas: flipH = scale(-1, 1), flipV = scale(1, -1),
// rotate180 = scale(-1, -1).
export type TileTransform = 'none' | 'flipH' | 'flipV' | 'rotate180';

export interface ShoreSelection {
  path: string;
  transform: TileTransform;
}

// Для каждого wang-кода: список вариантов (файл + трансформация).
// Получаем 14 кодов из 4 базовых watrtl-наборов.
export const SHORE_TILES_TX: Record<ShoreCode, { src: string[]; tx: TileTransform }[]> = {
  // Натуральные.
  LLLW: [{ src: WATRTL_LLLW, tx: 'none' }],
  LLWW: [{ src: WATRTL_LLWW, tx: 'none' }],
  LWLW: [{ src: WATRTL_LWLW, tx: 'none' }],
  WWWL: [{ src: WATRTL_WWWL, tx: 'none' }],

  // Зеркала: flipH = поменять L и R углы (TL↔TR, BL↔BR).
  //   LLLW (вода в BR) →flipH→ LLWL (вода в BL).
  LLWL: [{ src: WATRTL_LLLW, tx: 'flipH' }],
  //   LWLW (вода справа) →flipH→ WLWL (вода слева).
  WLWL: [{ src: WATRTL_LWLW, tx: 'flipH' }],
  //   WWWL (суша в BR) →flipH→ WWLW (суша в BL).
  WWLW: [{ src: WATRTL_WWWL, tx: 'flipH' }],

  // flipV = поменять T и B углы (TL↔BL, TR↔BR).
  //   LLLW (вода в BR) →flipV→ LWLL (вода в TR).
  LWLL: [{ src: WATRTL_LLLW, tx: 'flipV' }],
  //   LLWW (вода снизу) →flipV→ WWLL (вода сверху).
  WWLL: [{ src: WATRTL_LLWW, tx: 'flipV' }],
  //   WWWL (суша в BR) →flipV→ LWWW (суша в TR).
  LWWW: [{ src: WATRTL_WWWL, tx: 'flipV' }],

  // rotate180 = и H и V.
  //   LLLW →rot→ WLLL (вода в TL).
  WLLL: [{ src: WATRTL_LLLW, tx: 'rotate180' }],
  //   WWWL →rot→ WLWW (суша в TR... нет, в TL). Проверим:
  //     WWWL = (TL=W, TR=W, BL=W, BR=L)
  //     rotate180: новый TL = старый BR = L; TR = BL = W; BL = TR = W; BR = TL = W
  //     → LWWW. Тот же что flipV?
  //     LWWW = (TL=L, TR=W, BL=W, BR=W). Да, совпадает.
  //   Возьмём для WLWW: WWWL →flipH→ WWLW, WWWL →flipV→ LWWW. Что даст WLWW?
  //     WLWW = (TL=W, TR=L, BL=W, BR=W). Это LWWW зеркальный по H.
  //   LWWW →flipH→ WLWW (если LWWW не повторяет WWLW). Проверим LWWW vs WWLW:
  //     LWWW = (L,W,W,W); WWLW = (W,W,L,W). Разные.
  //   Получаем 4 из WWWL через 4 трансформации:
  //     none      → WWWL: (W,W,W,L)
  //     flipH     → WWLW: (W,W,L,W)
  //     flipV     → LWWW: (L,W,W,W)
  //     rotate180 → WLWW: (W,L,W,W)
  WLWW: [{ src: WATRTL_WWWL, tx: 'rotate180' }],

  // Аналогично для LLLW (4 трансформации):
  //     none      → LLLW: (L,L,L,W)
  //     flipH     → LLWL: (L,L,W,L)
  //     flipV     → LWLL: (L,W,L,L)
  //     rotate180 → WLLL: (W,L,L,L)
  // Уже выше.

  // LWLW + rotate180 = WLWL (уже выше через flipH, дубль)
  //   LWLW = (L,W,L,W); rotate180 = (W,L,W,L) = WLWL. Совпадает с flipH-результатом.

  // LLWW + flipH = LLWW (симметрично!). flipV = WWLL (уже). rotate180 = WWLL тоже.
  //   LLWW = (L,L,W,W); flipH = (L,L,W,W) = LLWW. Самоинверсия по H.
  //   LLWW + flipV = WWLL. Уже добавили.

  // Диагональные коды LWWL и WLLW. Из watrtl у нас НЕТ диагоналей напрямую.
  // Но LWLW + flipV ничего не даёт (=LWLW).
  // Можно ли получить диагональ из имеющегося? Нет — это редкие случаи
  // (полуострова с водой по диагонали). Для них fallback в чистую воду.
  LWWL: [{ src: WATRTL_WWWL, tx: 'flipH' }, { src: WATRTL_WWWL, tx: 'flipV' }], // приближение
  WLLW: [{ src: WATRTL_WWWL, tx: 'none' }, { src: WATRTL_WWWL, tx: 'rotate180' }], // приближение

  // LLLL — водный тайл, окружённый сушей со всех 4 сторон (озеро). Редкое.
  // Используем самый "сухой" вариант из имеющегося.
  LLLL: [{ src: WATRTL_LLLW, tx: 'none' }],
};

// Backwards-compat: старый плоский маппинг (используется в getAllUniqueTilePaths).
export const SHORE_TILES: Record<string, string[]> = {
  LLLW: WATRTL_LLLW,
  LLWW: WATRTL_LLWW,
  LWLW: WATRTL_LWLW,
  WWWL: WATRTL_WWWL,
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

// Старая функция — оставлена для совместимости, но не используется.
export function pickShoreTile(code: ShoreCode, x: number, y: number): string {
  const variants = SHORE_TILES_TX[code];
  if (!variants) return WATRTL_LLLW[0]!;
  const v = variants[hash(x, y, 2) % variants.length]!;
  return v.src[hash(x, y, 3) % v.src.length]!;
}

// Новая функция — возвращает путь + трансформацию (flip/rotate).
export function pickShoreTileTx(code: ShoreCode, x: number, y: number): ShoreSelection {
  const variants = SHORE_TILES_TX[code];
  if (!variants || variants.length === 0) {
    return { path: WATRTL_LLLW[0]!, transform: 'none' };
  }
  const v = variants[hash(x, y, 2) % variants.length]!;
  const path = v.src[hash(x, y, 3) % v.src.length]!;
  return { path, transform: v.tx };
}

export const KNOWN_SHORE_CODES: ShoreCode[] = [
  'LLLL', 'LLLW', 'LLWL', 'LWLL', 'WLLL',
  'LLWW', 'WWLL', 'LWLW', 'WLWL', 'LWWL', 'WLLW',
  'WWWL', 'WWLW', 'WLWW', 'LWWW',
];

// ===== Список всех уникальных PNG для предзагрузки =====

export function getAllUniqueTilePaths(): string[] {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_TILES)) {
    for (const p of list) set.add(p);
  }
  for (const variants of Object.values(SHORE_TILES_TX)) {
    for (const v of variants) {
      for (const p of v.src) set.add(p);
    }
  }
  return Array.from(set);
}
