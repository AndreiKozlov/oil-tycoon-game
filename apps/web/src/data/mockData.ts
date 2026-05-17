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
  // Запасы в недрах (баррели) — иссякают по мере добычи.
  reservesRemaining: number;
  reservesTotal: number;
  // Дней до истощения при текущем темпе.
  daysRemaining: number;
  // Темп добычи в баррелях в час. Зависит от уровней вышки/скважин.
  extractionRatePerHour: number;
  // Резервуар: вместимость и текущее заполнение, тоже в баррелях.
  tankCapacity: number;
  tankFill: number;
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

// Базовый темп добычи: ~247 бар/час (при $60/бар это ~$14.8k/час, как раньше).
// Резервуар: 1000 бар — чуть больше 4 часов добычи, чтобы было что продавать
// каждый сеанс. Заполнен на 78% при старте.
export const mockPlot: PlotState = {
  id: 'tyumen-3',
  name: 'Тюменская-3',
  reservesRemaining: 234_000,
  reservesTotal: 500_000,
  daysRemaining: 18,
  extractionRatePerHour: 247,
  tankCapacity: 1000,
  tankFill: 780,
  powerDraw: 42,
  buildings: [
    { id: 'b1', type: 'derrick', level: 5, status: 'ok' },
    { id: 'b2', type: 'well', level: 3, status: 'ok' },
    { id: 'b3', type: 'tank', level: 4, status: 'ok' },
    { id: 'b4', type: 'generator', level: 2, status: 'ok' },
  ],
};
