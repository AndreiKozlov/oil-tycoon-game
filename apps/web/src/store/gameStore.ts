// Глобальное состояние игры. Zustand + persist (localStorage).
// Модель добычи (после C.1):
//   недра (reservesRemaining) → насос/вышка качает с темпом extractionRatePerHour →
//   нефть копится в резервуаре (tankFill, ограничено tankCapacity) →
//   игрок жмёт «Продать» → tankFill превращается в деньги по market.oilPrice.
// Если резервуар полон, добыча останавливается (нужно продавать или строить ещё бак).
//
// C.2: цена нефти не константа, а дрейфующий ряд (геометрическое броуновское движение
// в коридоре $50..$70 вокруг базы $60). История последних 30 точек в priceHistory.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  mockPlayer,
  mockPlot,
  type Building,
  type PlayerState,
  type PlotState,
} from '../data/mockData';

// Базовая цена нефти, целевой центр коридора.
export const OIL_PRICE_BASE = 60;
export const OIL_PRICE_MIN = 50;
export const OIL_PRICE_MAX = 70;
// Длина истории для sparkline (точки = тики, 1 тик = 1 сек).
export const PRICE_HISTORY_SIZE = 30;
// Сила реверсии к среднему: чем больше — тем сильнее цена возвращается к базе.
const MEAN_REVERSION = 0.02;
// Волатильность за тик (стандартное отклонение лог-доходности).
const VOLATILITY = 0.004;

export interface MarketState {
  oilPrice: number;
  priceHistory: number[];
}

interface GameState {
  player: PlayerState;
  plot: PlotState;
  market: MarketState;
  lastTickAt: number;

  tick: (deltaSec: number) => void;
  upgradeBuilding: (buildingId: string) => boolean;
  sellOil: () => number;
  reset: () => void;
}

const UPGRADE_BASE: Record<Building['type'], number> = {
  derrick: 50_000,
  well: 30_000,
  tank: 20_000,
  generator: 15_000,
};

const EXTRACTION_BOOST_PER_LEVEL = 0.15;
const TANK_CAPACITY_MULT_PER_LEVEL = 1.25;
const POWER_REDUCTION_PER_LEVEL = 0.9;

export function upgradeCost(building: Building): number {
  return Math.round(UPGRADE_BASE[building.type] * 1.5 ** building.level);
}

function recomputeDays(plot: PlotState): number {
  if (plot.extractionRatePerHour <= 0) return Infinity;
  const hoursLeft = plot.reservesRemaining / plot.extractionRatePerHour;
  return Math.max(0, Math.ceil(hoursLeft / 24));
}

function findBuildingStatus(building: Building, plot: PlotState): Building['status'] {
  if (building.type === 'tank') {
    return plot.tankFill >= plot.tankCapacity ? 'full' : 'ok';
  }
  return 'ok';
}

// Шаг цены: GBM с реверсией к среднему. На каждый Δсек делаем deltaSec шагов
// в линейной аппроксимации — этого достаточно для секундного тика.
function stepPrice(current: number, deltaSec: number): number {
  // Лог-отклонение от базы → возврат к среднему.
  const logDev = Math.log(current / OIL_PRICE_BASE);
  // Box-Muller — но проще: сумма двух uniform - 1 ~ N(0, 1/√6). Достаточно.
  const noise = (Math.random() - 0.5) * 2;
  const drift = -MEAN_REVERSION * logDev * deltaSec;
  const shock = VOLATILITY * noise * Math.sqrt(deltaSec);
  const next = current * Math.exp(drift + shock);
  return Math.max(OIL_PRICE_MIN, Math.min(OIL_PRICE_MAX, next));
}

const initialMarket: MarketState = {
  oilPrice: OIL_PRICE_BASE,
  priceHistory: Array(PRICE_HISTORY_SIZE).fill(OIL_PRICE_BASE),
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      player: { ...mockPlayer },
      plot: { ...mockPlot, buildings: mockPlot.buildings.map((b: Building) => ({ ...b })) },
      market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
      lastTickAt: Date.now(),

      tick: (deltaSec) =>
        set((state) => {
          if (deltaSec <= 0) return state;

          // 1. Дрейф цены.
          const newPrice = stepPrice(state.market.oilPrice, deltaSec);
          const nextHistory = [...state.market.priceHistory.slice(1), newPrice];

          // 2. Добыча.
          const ratePerSec = state.plot.extractionRatePerHour / 3600;
          const wantBarrels = ratePerSec * deltaSec;
          const freeTankSpace = Math.max(0, state.plot.tankCapacity - state.plot.tankFill);
          const extractable = Math.max(
            0,
            Math.min(wantBarrels, state.plot.reservesRemaining, freeTankSpace),
          );

          const nextReserves = state.plot.reservesRemaining - extractable;
          const nextTankFill = state.plot.tankFill + extractable;
          const exhausted = nextReserves <= 0;
          const nextRate = exhausted ? 0 : state.plot.extractionRatePerHour;

          const nextPlot: PlotState = {
            ...state.plot,
            reservesRemaining: nextReserves,
            tankFill: nextTankFill,
            extractionRatePerHour: nextRate,
            daysRemaining: 0,
          };
          nextPlot.daysRemaining = recomputeDays(nextPlot);
          nextPlot.buildings = nextPlot.buildings.map((b) => ({
            ...b,
            status: findBuildingStatus(b, nextPlot),
            fillPercent:
              b.type === 'tank'
                ? Math.round((nextPlot.tankFill / nextPlot.tankCapacity) * 100)
                : b.fillPercent,
          }));

          return {
            plot: nextPlot,
            market: { oilPrice: newPrice, priceHistory: nextHistory },
            lastTickAt: Date.now(),
          };
        }),

      upgradeBuilding: (buildingId) => {
        let ok = false;
        set((state) => {
          const idx = state.plot.buildings.findIndex((b) => b.id === buildingId);
          if (idx === -1) return state;
          const building = state.plot.buildings[idx]!;
          const cost = upgradeCost(building);
          if (state.player.money < cost) return state;

          const nextBuildings = state.plot.buildings.slice();
          nextBuildings[idx] = { ...building, level: building.level + 1 };

          const nextPlot: PlotState = { ...state.plot, buildings: nextBuildings };

          switch (building.type) {
            case 'derrick':
            case 'well':
              nextPlot.extractionRatePerHour = Math.round(
                state.plot.extractionRatePerHour * (1 + EXTRACTION_BOOST_PER_LEVEL),
              );
              break;
            case 'tank':
              nextPlot.tankCapacity = Math.round(
                state.plot.tankCapacity * TANK_CAPACITY_MULT_PER_LEVEL,
              );
              break;
            case 'generator':
              nextPlot.powerDraw = Math.max(
                1,
                Math.round(state.plot.powerDraw * POWER_REDUCTION_PER_LEVEL),
              );
              break;
          }

          nextPlot.daysRemaining = recomputeDays(nextPlot);

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - cost },
            plot: nextPlot,
          };
        });
        return ok;
      },

      sellOil: () => {
        let revenue = 0;
        set((state) => {
          if (state.plot.tankFill <= 0) return state;
          revenue = Math.round(state.plot.tankFill * state.market.oilPrice);
          const nextPlot: PlotState = {
            ...state.plot,
            tankFill: 0,
            buildings: state.plot.buildings.map((b) =>
              b.type === 'tank' ? { ...b, status: 'ok', fillPercent: 0 } : b,
            ),
          };
          return {
            player: { ...state.player, money: state.player.money + revenue },
            plot: nextPlot,
          };
        });
        return revenue;
      },

      reset: () =>
        set({
          player: { ...mockPlayer },
          plot: { ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) },
          market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
          lastTickAt: Date.now(),
        }),
    }),
    {
      name: 'oil-tycoon-save',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        player: state.player,
        plot: state.plot,
        market: state.market,
        lastTickAt: state.lastTickAt,
      }),
      // C.1 → C.2: добавилось поле market. Старым сейвам подкладываем initialMarket.
      migrate: (persistedState, version) => {
        type RawSave = {
          player?: PlayerState;
          plot?: Partial<PlotState> & { incomePerHour?: number };
          market?: MarketState;
          lastTickAt?: number;
        };
        const old = persistedState as RawSave;

        let plot: PlotState;
        if (version < 2) {
          // B.5 формат: incomePerHour без extractionRatePerHour и резервуара.
          const incomeOld = old.plot?.incomePerHour ?? mockPlot.extractionRatePerHour * OIL_PRICE_BASE;
          plot = {
            ...mockPlot,
            ...(old.plot as Partial<PlotState>),
            extractionRatePerHour: Math.round(incomeOld / OIL_PRICE_BASE),
            tankCapacity: mockPlot.tankCapacity,
            tankFill: 0,
          };
        } else {
          plot = {
            ...mockPlot,
            ...(old.plot as Partial<PlotState>),
          };
        }

        return {
          player: old.player ?? mockPlayer,
          plot,
          market: old.market ?? { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
          lastTickAt: old.lastTickAt ?? Date.now(),
        } as GameState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const offlineSec = Math.min(8 * 3600, Math.max(0, (Date.now() - state.lastTickAt) / 1000));
        if (offlineSec > 0) state.tick(offlineSec);
      },
    },
  ),
);
