// Каталог участков мира. Стартовый (Тюмень) бесплатный, остальные покупаются.
// Эпоха 1 — Сибирская. На прод добавим карту Аравия (эпоха 2), Северное море и т.д.

import type { BuildingType, PlotState } from './mockData';

// Типы нефти. На бирже все эти grade-ы будут торговаться отдельно (этап 2);
// сейчас цена базовой нефти из market.oilPrice умножается на gradeMult.
export type OilGrade = 'urals' | 'brent' | 'wti' | 'dubai' | 'heavy';

export const OIL_GRADE_INFO: Record<OilGrade, { name: string; priceMult: number; color: string }> = {
  urals: { name: 'Urals', priceMult: 0.92, color: '#94a3b8' },
  brent: { name: 'Brent', priceMult: 1.0, color: '#f59e0b' },
  wti: { name: 'WTI', priceMult: 0.97, color: '#fbbf24' },
  dubai: { name: 'Dubai', priceMult: 0.95, color: '#fb923c' },
  heavy: { name: 'Heavy', priceMult: 0.7, color: '#7f1d1d' },
};

export interface WorldPlotTemplate {
  id: string;
  name: string;
  region: string;
  emoji: string;
  oilGrade: OilGrade;
  reservesTotal: number;
  // Цена покупки участка (стартовый — 0).
  price: number;
  // Минимальный уровень игрока для покупки. 0 = доступно сразу.
  minPlayerLevel: number;
  // Стартовые постройки на новом участке (только для стартового).
  startingBuildings?: { type: BuildingType; level: number }[];
}

export const WORLD_PLOTS: WorldPlotTemplate[] = [
  {
    id: 'tyumen-3',
    name: 'Тюменская-3',
    region: 'Западная Сибирь',
    emoji: '🌲',
    oilGrade: 'urals',
    reservesTotal: 500_000,
    price: 0,
    minPlayerLevel: 0,
    startingBuildings: [
      { type: 'derrick', level: 5 },
      { type: 'well', level: 3 },
      { type: 'tank', level: 4 },
      { type: 'generator', level: 2 },
    ],
  },
  {
    id: 'samotlor',
    name: 'Самотлор-7',
    region: 'Ханты-Мансийск',
    emoji: '❄️',
    oilGrade: 'urals',
    reservesTotal: 800_000,
    price: 250_000,
    minPlayerLevel: 9,
  },
  {
    id: 'urengoy',
    name: 'Уренгой-VIP',
    region: 'Ямал',
    emoji: '🏔',
    oilGrade: 'urals',
    reservesTotal: 1_400_000,
    price: 750_000,
    minPlayerLevel: 11,
  },
  {
    id: 'caspian-shelf',
    name: 'Каспий-Шельф',
    region: 'Каспийское море',
    emoji: '🌊',
    oilGrade: 'brent',
    reservesTotal: 1_200_000,
    price: 1_500_000,
    minPlayerLevel: 13,
  },
  {
    id: 'sakhalin',
    name: 'Сахалин-Восток',
    region: 'Дальний Восток',
    emoji: '🐋',
    oilGrade: 'dubai',
    reservesTotal: 900_000,
    price: 900_000,
    minPlayerLevel: 12,
  },
  {
    id: 'orenburg-deep',
    name: 'Оренбург-Глубокий',
    region: 'Урал',
    emoji: '⛏',
    oilGrade: 'heavy',
    reservesTotal: 2_500_000,
    price: 2_000_000,
    minPlayerLevel: 15,
  },
];

// Создать чистый PlotState из шаблона. Используется при покупке и старте.
export function createPlotFromTemplate(template: WorldPlotTemplate, reserveMult = 1): PlotState {
  const reservesTotal = Math.round(template.reservesTotal * reserveMult);
  return {
    id: template.id,
    name: template.name,
    reservesRemaining: reservesTotal,
    reservesTotal,
    daysRemaining: 0,
    tankFill: 0,
    maxSlots: 8,
    buildings: (template.startingBuildings ?? []).map((b, i) => ({
      id: `${template.id}-b${i}`,
      type: b.type,
      level: b.level,
      status: 'ok',
    })),
  };
}

export function getWorldPlot(id: string): WorldPlotTemplate | undefined {
  return WORLD_PLOTS.find((p) => p.id === id);
}
