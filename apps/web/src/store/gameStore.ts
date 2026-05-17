// Глобальное состояние игры. Zustand + persist (localStorage).
//
// После D.1 модель изменилась: темп добычи / ёмкость бака / энергия — НЕ хранятся
// в plot, а вычисляются из buildings через формулы в lib/gameFormulas.ts.
// Это значит: добавить вторую вышку = автоматически вырастает добыча.
//
// Текущее состояние хранит только то что нельзя вывести: какие постройки есть,
// сколько нефти в недрах, сколько в баке, цена нефти, деньги/XP игрока.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  mockPlayer,
  mockPlot,
  type Building,
  type BuildingType,
  type PlayerState,
  type PlotState,
} from '../data/mockData';
import {
  buildCost,
  plotExtractionRate,
  plotPowerDraw,
  plotPowerProduced,
  plotTankCapacity,
  upgradeCost,
} from '../lib/gameFormulas';

// Если мощности производят меньше чем требуется — добыча идёт с понижающим
// коэффициентом. Это связывает все 4 типа построек.
export function powerRatio(plot: PlotState): number {
  const produced = plotPowerProduced(plot);
  const draw = plotPowerDraw(plot);
  if (draw <= 0) return 1;
  return Math.max(0, Math.min(1, produced / draw));
}

// База цены нефти и коридор. Подробнее см. C.2 в PROGRESS_LOG.
export const OIL_PRICE_BASE = 60;
export const OIL_PRICE_MIN = 50;
export const OIL_PRICE_MAX = 70;
export const PRICE_HISTORY_SIZE = 30;
const MEAN_REVERSION = 0.02;
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
  // Один-раз-флаг: после каждого level up выставляется в новый уровень.
  // PlotScreen читает его и показывает баннер, потом обнуляет.
  pendingLevelUp: number | null;

  tick: (deltaSec: number) => void;
  upgradeBuilding: (buildingId: string) => boolean;
  buildBuilding: (type: BuildingType) => boolean;
  sellOil: () => number;
  acknowledgeLevelUp: () => void;
  reset: () => void;
}

// XP за продажу: 1 XP за каждые $100 выручки (округляется вверх).
const XP_PER_USD = 1 / 100;
// Стоимость следующего уровня растёт ×1.5 от предыдущего.
const XP_GROWTH = 1.5;

function recomputeDays(plot: PlotState): number {
  const rate = plotExtractionRate(plot) * powerRatio(plot);
  if (rate <= 0) return Infinity;
  const hoursLeft = plot.reservesRemaining / rate;
  return Math.max(0, Math.ceil(hoursLeft / 24));
}

function updateBuildingDerivedStatus(plot: PlotState, tankFull: boolean): Building[] {
  return plot.buildings.map((b) => {
    if (b.type === 'tank') {
      return {
        ...b,
        status: tankFull ? ('full' as const) : ('ok' as const),
        fillPercent:
          plotTankCapacity(plot) > 0
            ? Math.round((plot.tankFill / plotTankCapacity(plot)) * 100)
            : 0,
      };
    }
    return b;
  });
}

function stepPrice(current: number, deltaSec: number): number {
  const logDev = Math.log(current / OIL_PRICE_BASE);
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

// Уникальный id для новых построек (счётчик в памяти + timestamp хвост).
let buildIdSeq = 100;
function nextBuildingId(): string {
  buildIdSeq += 1;
  return `b${buildIdSeq}-${Date.now().toString(36).slice(-4)}`;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      player: { ...mockPlayer },
      plot: { ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) },
      market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
      lastTickAt: Date.now(),
      pendingLevelUp: null,

      tick: (deltaSec) =>
        set((state) => {
          if (deltaSec <= 0) return state;

          // 1. Цена.
          const newPrice = stepPrice(state.market.oilPrice, deltaSec);
          const nextHistory = [...state.market.priceHistory.slice(1), newPrice];

          // 2. Добыча — с учётом нехватки энергии.
          const baseRate = plotExtractionRate(state.plot);
          const ratio = powerRatio(state.plot);
          const rate = baseRate * ratio;
          const capacity = plotTankCapacity(state.plot);
          const ratePerSec = rate / 3600;
          const wantBarrels = ratePerSec * deltaSec;
          const freeTankSpace = Math.max(0, capacity - state.plot.tankFill);
          const extractable = Math.max(
            0,
            Math.min(wantBarrels, state.plot.reservesRemaining, freeTankSpace),
          );

          const nextReserves = state.plot.reservesRemaining - extractable;
          const nextTankFill = state.plot.tankFill + extractable;

          const nextPlot: PlotState = {
            ...state.plot,
            reservesRemaining: nextReserves,
            tankFill: nextTankFill,
            daysRemaining: 0,
          };
          const tankFull = capacity > 0 && nextTankFill >= capacity;
          nextPlot.daysRemaining = recomputeDays(nextPlot);
          nextPlot.buildings = updateBuildingDerivedStatus(nextPlot, tankFull);

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
          nextPlot.daysRemaining = recomputeDays(nextPlot);

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - cost },
            plot: nextPlot,
          };
        });
        return ok;
      },

      buildBuilding: (type) => {
        let ok = false;
        set((state) => {
          if (state.plot.buildings.length >= state.plot.maxSlots) return state;
          const existingCount = state.plot.buildings.filter((b) => b.type === type).length;
          const cost = buildCost(type, existingCount);
          if (state.player.money < cost) return state;

          const newBuilding: Building = {
            id: nextBuildingId(),
            type,
            level: 1,
            status: 'ok',
          };
          const nextPlot: PlotState = {
            ...state.plot,
            buildings: [...state.plot.buildings, newBuilding],
          };
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

          // XP и потенциальный level up. Может случиться сразу несколько
          // апов при крупной продаже на низком уровне — обрабатываем циклом.
          let xp = state.player.xp + revenue * XP_PER_USD;
          let level = state.player.level;
          let xpToNext = state.player.xpToNextLevel;
          let leveledTo: number | null = null;
          while (xp >= xpToNext) {
            xp -= xpToNext;
            level += 1;
            xpToNext = Math.round(xpToNext * XP_GROWTH);
            leveledTo = level;
          }

          const nextPlot: PlotState = {
            ...state.plot,
            tankFill: 0,
            buildings: state.plot.buildings.map((b) =>
              b.type === 'tank' ? { ...b, status: 'ok', fillPercent: 0 } : b,
            ),
          };
          return {
            player: {
              ...state.player,
              money: state.player.money + revenue,
              xp: Math.floor(xp),
              xpToNextLevel: xpToNext,
              level,
            },
            plot: nextPlot,
            pendingLevelUp: leveledTo ?? state.pendingLevelUp,
          };
        });
        return revenue;
      },

      acknowledgeLevelUp: () => set({ pendingLevelUp: null }),

      reset: () =>
        set({
          player: { ...mockPlayer },
          plot: { ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) },
          market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
          lastTickAt: Date.now(),
          pendingLevelUp: null,
        }),
    }),
    {
      name: 'oil-tycoon-save',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        player: state.player,
        plot: state.plot,
        market: state.market,
        lastTickAt: state.lastTickAt,
      }),
      // Миграции:
      //   v1 (B.5): incomePerHour, без бака.
      //   v2 (C.1): extractionRatePerHour + tankCapacity/tankFill, без market.
      //   v3 (C.2): добавилось market.
      //   v4 (D.1): убраны extractionRatePerHour/tankCapacity/powerDraw (производные).
      //             Добавилось maxSlots.
      migrate: (persistedState, version) => {
        type RawSave = {
          player?: PlayerState;
          plot?: Partial<PlotState> & {
            incomePerHour?: number;
            extractionRatePerHour?: number;
            tankCapacity?: number;
            powerDraw?: number;
          };
          market?: MarketState;
          lastTickAt?: number;
        };
        const old = persistedState as RawSave;

        const buildings = old.plot?.buildings ?? mockPlot.buildings;
        const reservesRemaining = old.plot?.reservesRemaining ?? mockPlot.reservesRemaining;
        const reservesTotal = old.plot?.reservesTotal ?? mockPlot.reservesTotal;
        // Бак: в старых версиях хранился отдельный capacity. Если есть — игнорируем
        // (теперь capacity = сумма tank-построек). Но tankFill переносим, кэппя сверху.
        const tankFill = Math.max(0, Math.min(old.plot?.tankFill ?? 0, mockPlot.tankFill * 2));

        const plot: PlotState = {
          id: old.plot?.id ?? mockPlot.id,
          name: old.plot?.name ?? mockPlot.name,
          reservesRemaining,
          reservesTotal,
          daysRemaining: 0,
          tankFill,
          maxSlots: mockPlot.maxSlots,
          buildings,
        };
        plot.daysRemaining = recomputeDays(plot);

        return {
          player: old.player ?? mockPlayer,
          plot,
          market: old.market ?? {
            ...initialMarket,
            priceHistory: [...initialMarket.priceHistory],
          },
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

export { upgradeCost, buildCost };
