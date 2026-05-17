// Стартовое состояние игры (мок). Реальная инициализация — через стор.
// Числа берутся примерно из oil_game_balance.md (середина прогрессии).

export interface PlayerState {
  name: string;
  level: number;
  money: number;
  crystals: number;
  xp: number;
  xpToNextLevel: number;
}

export type BuildingType = 'derrick' | 'well' | 'tank' | 'generator';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  status: 'ok' | 'needs_repair' | 'full' | 'building';
  fillPercent?: number;
}

export interface PlotState {
  id: string;
  name: string;
  // Запасы в недрах (баррели) — иссякают по мере добычи.
  reservesRemaining: number;
  reservesTotal: number;
  // Дней до истощения при текущем темпе (вычисляется в сторе).
  daysRemaining: number;
  // Текущее заполнение резервуара (всех баков суммарно), баррелей.
  tankFill: number;
  // Лимит количества построек на участке. Растёт с уровнем HQ позже.
  maxSlots: number;
  buildings: Building[];
}

export const mockPlayer: PlayerState = {
  name: 'Олег',
  level: 8,
  money: 1_200_000,
  crystals: 250,
  xp: 1450,
  xpToNextLevel: 2200,
};

// Стартовое состояние: 1 вышка, 1 скважина, 1 бак, 1 генератор. 8 слотов всего.
export const mockPlot: PlotState = {
  id: 'tyumen-3',
  name: 'Тюменская-3',
  reservesRemaining: 234_000,
  reservesTotal: 500_000,
  daysRemaining: 18,
  tankFill: 780,
  maxSlots: 8,
  buildings: [
    { id: 'b1', type: 'derrick', level: 5, status: 'ok' },
    { id: 'b2', type: 'well', level: 3, status: 'ok' },
    { id: 'b3', type: 'tank', level: 4, status: 'ok' },
    { id: 'b4', type: 'generator', level: 2, status: 'ok' },
  ],
};
