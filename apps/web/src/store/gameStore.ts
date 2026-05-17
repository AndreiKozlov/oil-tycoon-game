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
import { type TechEffects, type TechId, getTechById } from '../data/technologies';

// Состояние науки.
export interface ResearchState {
  // Запущенное в данный момент исследование (или null).
  inProgress: { techId: TechId; startedAt: number } | null;
  // Завершённые технологии — даём кумулятивные эффекты.
  completed: TechId[];
}

// Свернуть список завершённых технологий в единый объект множителей.
// Перемножаем мультипликаторы, складываем аддитивные (если будут).
export function aggregateTechEffects(completed: TechId[]): Required<TechEffects> {
  const base: Required<TechEffects> = {
    reserveMult: 1,
    extractionMult: 1,
    tankCapacityMult: 1,
    powerDrawMult: 1,
  };
  for (const id of completed) {
    const tech = getTechById(id);
    if (!tech) continue;
    if (tech.effects.reserveMult) base.reserveMult *= tech.effects.reserveMult;
    if (tech.effects.extractionMult) base.extractionMult *= tech.effects.extractionMult;
    if (tech.effects.tankCapacityMult) base.tankCapacityMult *= tech.effects.tankCapacityMult;
    if (tech.effects.powerDrawMult) base.powerDrawMult *= tech.effects.powerDrawMult;
  }
  return base;
}

// Если мощности производят меньше чем требуется — добыча идёт с понижающим
// коэффициентом. Это связывает все 4 типа построек.
// Учитывает technology powerDrawMult (меньше draw = больше ratio).
export function powerRatio(plot: PlotState, effects?: Required<TechEffects>): number {
  const produced = plotPowerProduced(plot);
  const draw = plotPowerDraw(plot) * (effects?.powerDrawMult ?? 1);
  if (draw <= 0) return 1;
  return Math.max(0, Math.min(1, produced / draw));
}

// Effective значения с учётом technology effects.
export function effectiveExtractionRate(plot: PlotState, effects: Required<TechEffects>): number {
  return plotExtractionRate(plot) * effects.extractionMult;
}

export function effectiveTankCapacity(plot: PlotState, effects: Required<TechEffects>): number {
  return plotTankCapacity(plot) * effects.tankCapacityMult;
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
  research: ResearchState;
  lastTickAt: number;
  pendingLevelUp: number | null;
  // Уведомление о завершившейся технологии (TechId | null).
  pendingResearchDone: TechId | null;

  tick: (deltaSec: number) => void;
  upgradeBuilding: (buildingId: string) => boolean;
  buildBuilding: (type: BuildingType) => boolean;
  sellOil: () => number;
  startResearch: (techId: TechId) => boolean;
  acknowledgeLevelUp: () => void;
  acknowledgeResearchDone: () => void;
  setPlayerName: (name: string) => void;
  reset: () => void;
}

// XP за продажу: 1 XP за каждые $100 выручки (округляется вверх).
const XP_PER_USD = 1 / 100;
// Стоимость следующего уровня растёт ×1.5 от предыдущего.
const XP_GROWTH = 1.5;

function recomputeDays(plot: PlotState, effects?: Required<TechEffects>): number {
  const eff = effects ?? aggregateTechEffects([]);
  const rate = effectiveExtractionRate(plot, eff) * powerRatio(plot, eff);
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
      research: { inProgress: null, completed: [] },
      lastTickAt: Date.now(),
      pendingLevelUp: null,
      pendingResearchDone: null,

      tick: (deltaSec) =>
        set((state) => {
          if (deltaSec <= 0) return state;

          // Эффекты от завершённых технологий — применяются ко всему тику.
          const effects = aggregateTechEffects(state.research.completed);

          // 1. Цена.
          const newPrice = stepPrice(state.market.oilPrice, deltaSec);
          const nextHistory = [...state.market.priceHistory.slice(1), newPrice];

          // 2. Добыча — с учётом нехватки энергии и технологий.
          const baseRate = effectiveExtractionRate(state.plot, effects);
          const ratio = powerRatio(state.plot, effects);
          const rate = baseRate * ratio;
          const capacity = effectiveTankCapacity(state.plot, effects);
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
          nextPlot.daysRemaining = recomputeDays(nextPlot, effects);
          nextPlot.buildings = updateBuildingDerivedStatus(nextPlot, tankFull);

          // 3. Прогресс исследования.
          let nextResearch = state.research;
          let researchDone: TechId | null = null;
          if (state.research.inProgress) {
            const tech = getTechById(state.research.inProgress.techId);
            if (tech) {
              const elapsed = (Date.now() - state.research.inProgress.startedAt) / 1000;
              if (elapsed >= tech.durationSec) {
                researchDone = state.research.inProgress.techId;
                nextResearch = {
                  inProgress: null,
                  completed: [...state.research.completed, researchDone],
                };
              }
            }
          }

          return {
            plot: nextPlot,
            market: { oilPrice: newPrice, priceHistory: nextHistory },
            research: nextResearch,
            pendingResearchDone: researchDone ?? state.pendingResearchDone,
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

      startResearch: (techId) => {
        let ok = false;
        set((state) => {
          if (state.research.inProgress) return state;
          if (state.research.completed.includes(techId)) return state;
          const tech = getTechById(techId);
          if (!tech) return state;
          // Все пререквизиты должны быть в completed.
          const haveAllPrereqs = tech.prereqIds.every((p) => state.research.completed.includes(p));
          if (!haveAllPrereqs) return state;
          if (state.player.money < tech.costMoney) return state;

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - tech.costMoney },
            research: { ...state.research, inProgress: { techId, startedAt: Date.now() } },
          };
        });
        return ok;
      },

      acknowledgeResearchDone: () => set({ pendingResearchDone: null }),

      setPlayerName: (name) =>
        set((state) => ({ player: { ...state.player, name: name || state.player.name } })),

      reset: () =>
        set({
          player: { ...mockPlayer },
          plot: { ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) },
          market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
          research: { inProgress: null, completed: [] },
          lastTickAt: Date.now(),
          pendingLevelUp: null,
          pendingResearchDone: null,
        }),
    }),
    {
      name: 'oil-tycoon-save',
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        player: state.player,
        plot: state.plot,
        market: state.market,
        research: state.research,
        lastTickAt: state.lastTickAt,
      }),
      // Миграции:
      //   v1 (B.5): incomePerHour, без бака.
      //   v2 (C.1): extractionRatePerHour + tankCapacity/tankFill, без market.
      //   v3 (C.2): добавилось market.
      //   v4 (D.1): убраны extractionRatePerHour/tankCapacity/powerDraw (производные).
      //             Добавилось maxSlots.
      //   v5 (F.1): добавилось research (inProgress + completed).
      //   v5 (F.1): добавилось research (inProgress + completed).
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

        const research =
          (old as { research?: ResearchState }).research ?? { inProgress: null, completed: [] };

        return {
          player: old.player ?? mockPlayer,
          plot,
          market: old.market ?? {
            ...initialMarket,
            priceHistory: [...initialMarket.priceHistory],
          },
          research,
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
