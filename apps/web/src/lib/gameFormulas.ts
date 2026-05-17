// Чистые функции расчёта производных метрик участка. Без зависимостей от стора.
// Если меняешь формулу — отрази в DECISIONS.md / GDD.balance.
//
// Базовые юниты (level 1):
//   derrick   →  50 бар/час  ×1.15 за уровень
//   well      →  30 бар/час  ×1.15 за уровень
//   tank      → 500 бар ёмкости  ×1.25 за уровень
//   generator → 30 кВт мощности  ×1.20 за уровень
//   draw на каждую derrick = 12 кВт * (1 + 0.05*level) — растёт с уровнем
//   draw на каждую well     =  8 кВт * (1 + 0.05*level)
//   draw на tank/generator  =  0
//
// Энергобаланс пока считается, но НЕ влияет на добычу — это D.2.

import type { Building, BuildingType, PlotState } from '../data/mockData';

const BASE_EXTRACTION: Record<BuildingType, number> = {
  derrick: 50,
  well: 30,
  tank: 0,
  generator: 0,
};
const EXTRACTION_MULT = 1.15; // на каждый уровень

const BASE_TANK = 500;
const TANK_MULT = 1.25;

const BASE_POWER_GEN = 30; // у генератора
const POWER_GEN_MULT = 1.2;

const BASE_DRAW_DERRICK = 12;
const BASE_DRAW_WELL = 8;
const DRAW_GROWTH = 0.05;

// Сколько баррелей в час добывает одна постройка типа derrick/well.
export function buildingExtractionRate(b: Building): number {
  if (b.type !== 'derrick' && b.type !== 'well') return 0;
  return BASE_EXTRACTION[b.type] * EXTRACTION_MULT ** (b.level - 1);
}

// Сколько баррелей в час суммарно качает участок.
export function plotExtractionRate(plot: PlotState): number {
  return plot.buildings.reduce((sum, b) => sum + buildingExtractionRate(b), 0);
}

export function buildingTankCapacity(b: Building): number {
  if (b.type !== 'tank') return 0;
  return BASE_TANK * TANK_MULT ** (b.level - 1);
}

export function plotTankCapacity(plot: PlotState): number {
  return Math.round(plot.buildings.reduce((sum, b) => sum + buildingTankCapacity(b), 0));
}

export function buildingPowerProduction(b: Building): number {
  if (b.type !== 'generator') return 0;
  return BASE_POWER_GEN * POWER_GEN_MULT ** (b.level - 1);
}

export function buildingPowerDraw(b: Building): number {
  if (b.type === 'derrick') return BASE_DRAW_DERRICK * (1 + DRAW_GROWTH * (b.level - 1));
  if (b.type === 'well') return BASE_DRAW_WELL * (1 + DRAW_GROWTH * (b.level - 1));
  return 0;
}

export function plotPowerProduced(plot: PlotState): number {
  return Math.round(plot.buildings.reduce((sum, b) => sum + buildingPowerProduction(b), 0));
}

export function plotPowerDraw(plot: PlotState): number {
  return Math.round(plot.buildings.reduce((sum, b) => sum + buildingPowerDraw(b), 0));
}

// Цена апгрейда: BASE * 1.5^level.
const UPGRADE_BASE: Record<BuildingType, number> = {
  derrick: 50_000,
  well: 30_000,
  tank: 20_000,
  generator: 15_000,
};

export function upgradeCost(building: Building): number {
  return Math.round(UPGRADE_BASE[building.type] * 1.5 ** building.level);
}

// Цена постройки нового юнита: BASE * 2^count_existing_of_same_type.
// Чем больше у тебя вышек, тем дороже следующая — softcap по типу.
export function buildCost(type: BuildingType, existingCount: number): number {
  return Math.round(UPGRADE_BASE[type] * 2 ** existingCount);
}
