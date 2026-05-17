// Маппинг GDD-биома на список конкретных PNG-файлов тайлов.
// Прототип использует базовые тайлы из tiles/raw/bg/. Wang-переходы
// (cyan-маска RGB(0,255,255) → прозрачность) — этап полировки G.3.x.

export type Biome =
  | 'forest'
  | 'grassland'
  | 'mountain'
  | 'tundra'
  | 'desert'
  | 'swamp'
  | 'shore'
  | 'water'
  | 'plain'
  | 'volcanic';

// Базовый путь к тайлам, относительно public/.
const BASE = '/game/tiles/raw';

// Несколько вариантов на биом — клиент выберет случайный при отрисовке для
// разнообразия. Все 32×32 PNG.
export const BIOME_TILES: Record<Biome, string[]> = {
  // Лес — оттенки болотистой травы (#264e31) и valley (#3a3233).
  forest: [
    `${BASE}/bg/tswb000.png`,
    `${BASE}/bg/tswb001.png`,
    `${BASE}/bg/tswb002.png`,
    `${BASE}/bg/tswb010.png`,
    `${BASE}/bg/tswb011.png`,
  ],
  // Степь / поле — коричнево-зелёная трава.
  grassland: [
    `${BASE}/bg/tgrs000.png`,
    `${BASE}/bg/tgrs001.png`,
    `${BASE}/bg/tgrs002.png`,
    `${BASE}/bg/tgrs003.png`,
    `${BASE}/bg/tgrs010.png`,
  ],
  // Горы — тёмно-коричневые скалы.
  mountain: [
    `${BASE}/bg/trom000.png`,
    `${BASE}/bg/trom001.png`,
    `${BASE}/bg/trom002.png`,
    `${BASE}/bg/trom010.png`,
    `${BASE}/bg/trom011.png`,
  ],
  // Тундра — снег.
  tundra: [
    `${BASE}/bg/tsnb000.png`,
    `${BASE}/bg/tsnb001.png`,
    `${BASE}/bg/tsnb002.png`,
    `${BASE}/bg/tsnb003.png`,
    `${BASE}/bg/tsnb004.png`,
  ],
  // Пустыня — песок.
  desert: [
    `${BASE}/bg/tsab000.png`,
    `${BASE}/bg/tsab001.png`,
    `${BASE}/bg/tsab002.png`,
    `${BASE}/bg/tsab003.png`,
    `${BASE}/bg/tsab004.png`,
  ],
  // Болото — тёмная влажная.
  swamp: [
    `${BASE}/bg/tswd000.png`,
    `${BASE}/bg/tswd001.png`,
    `${BASE}/bg/tswd010.png`,
    `${BASE}/bg/tsws000.png`,
  ],
  // Прибрежная зона — пляжи.
  shore: [
    `${BASE}/bg/trob000.png`,
    `${BASE}/bg/trob001.png`,
    `${BASE}/bg/trob002.png`,
    `${BASE}/bg/tros000.png`,
    `${BASE}/bg/tros001.png`,
  ],
  // Вода — океан/море.
  water: [
    `${BASE}/bg/watrtl01.png`,
    `${BASE}/bg/watrtl02.png`,
    `${BASE}/bg/watrtl03.png`,
    `${BASE}/bg/watrtl04.png`,
  ],
  // Равнина (бесресурсная инфраструктурная) — светло-песчаная.
  plain: [
    `${BASE}/bg/tsus000.png`,
    `${BASE}/bg/tsus001.png`,
    `${BASE}/bg/tsus002.png`,
    `${BASE}/bg/tsud000.png`,
  ],
  // Вулканическая / непригодная (для редких тайлов).
  volcanic: [
    `${BASE}/bg/tvlb000.png`,
    `${BASE}/bg/tvlb001.png`,
    `${BASE}/bg/tvld000.png`,
  ],
};

// Метаданные биома: цвет для мини-карты (используем средние из аудита).
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
  shore: { name: 'Прибрежье', emoji: '🏖', isLand: true, hexColor: '#a38063' },
  water: { name: 'Вода', emoji: '🌊', isLand: false, hexColor: '#3a5060' },
  plain: { name: 'Равнина', emoji: '⬜', isLand: true, hexColor: '#b69072' },
  volcanic: { name: 'Пустошь', emoji: '🌋', isLand: true, hexColor: '#3a3233' },
};

// Выбор конкретного PNG для тайла. Детерминирован по seed (x, y), чтобы
// тайл не «прыгал» между ререндерами.
export function pickTileForBiome(biome: Biome, x: number, y: number): string {
  const variants = BIOME_TILES[biome];
  // Детерминированный пcевдо-хеш.
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return variants[h % variants.length]!;
}

export function getAllUniqueTilePaths(): string[] {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_TILES)) {
    for (const p of list) set.add(p);
  }
  return Array.from(set);
}
