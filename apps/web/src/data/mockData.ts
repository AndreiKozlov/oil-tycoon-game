// Заглушки до появления реального state-менеджера и сохранения в localStorage.
// Все числа из oil_game_balance.md / GDD — соответствуют середине прогрессии (~уровень 8).

export interface PlayerState {
  name: string;
  level: number;
  money: number;
  crystals: number;
  xp: number;
  xpToNextLevel: number;
}

export interface Building {
  id: string;
  type: 'derrick' | 'well' | 'tank' | 'generator';
  level: number;
  status: 'ok' | 'needs_repair' | 'full' | 'building';
  fillPercent?: number;
}

export interface PlotState {
  id: string;
  name: string;
  reservesRemaining: number;
  reservesTotal: number;
  daysRemaining: number;
  incomePerHour: number;
  powerDraw: number;
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

export const mockPlot: PlotState = {
  id: 'tyumen-3',
  name: 'Тюменская-3',
  reservesRemaining: 234_000,
  reservesTotal: 500_000,
  daysRemaining: 18,
  incomePerHour: 14_800,
  powerDraw: 42,
  buildings: [
    { id: 'b1', type: 'derrick', level: 5, status: 'ok' },
    { id: 'b2', type: 'well', level: 3, status: 'ok' },
    { id: 'b3', type: 'tank', level: 4, status: 'full', fillPercent: 78 },
    { id: 'b4', type: 'generator', level: 2, status: 'ok' },
  ],
};
