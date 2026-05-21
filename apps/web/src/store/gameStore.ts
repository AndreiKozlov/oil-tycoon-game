// Глобальное состояние игры. Zustand + persist (localStorage).
//
// История модели:
//   B.x — single plot, prod считалось как plot.incomePerHour.
//   D.1 — добыча/бак/энергия выведены в derived через gameFormulas.
//   F.1 — добавилось дерево технологий с глобальными множителями.
//   F.2 — стейт перешёл с одного plot на МАССИВ plots[] + activePlotId.
//         Каждый купленный участок добывает параллельно (idle-стиль).
//         Игрок переключается между ними как между «комнатами», но добыча
//         не останавливается на неактивных.
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
import {
  OIL_GRADE_INFO,
  WORLD_PLOTS,
  createPlotFromTemplate,
  getWorldPlot,
  type OilGrade,
} from '../data/worldPlots';

// ============ Технологии ============

export interface ResearchState {
  inProgress: { techId: TechId; startedAt: number } | null;
  completed: TechId[];
}

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

// ============ Геомеханика ============

export function powerRatio(plot: PlotState, effects?: Required<TechEffects>): number {
  const produced = plotPowerProduced(plot);
  const draw = plotPowerDraw(plot) * (effects?.powerDrawMult ?? 1);
  if (draw <= 0) return 1;
  return Math.max(0, Math.min(1, produced / draw));
}

export function effectiveExtractionRate(plot: PlotState, effects: Required<TechEffects>): number {
  return plotExtractionRate(plot) * effects.extractionMult;
}

export function effectiveTankCapacity(plot: PlotState, effects: Required<TechEffects>): number {
  return plotTankCapacity(plot) * effects.tankCapacityMult;
}

function recomputeDays(plot: PlotState, effects?: Required<TechEffects>): number {
  const eff = effects ?? aggregateTechEffects([]);
  const rate = effectiveExtractionRate(plot, eff) * powerRatio(plot, eff);
  if (rate <= 0) return Infinity;
  const hoursLeft = plot.reservesRemaining / rate;
  return Math.max(0, Math.ceil(hoursLeft / 24));
}

function updateBuildingDerivedStatus(plot: PlotState, tankFull: boolean): Building[] {
  const capacity = plotTankCapacity(plot);
  return plot.buildings.map((b) => {
    if (b.type === 'tank') {
      return {
        ...b,
        status: tankFull ? ('full' as const) : ('ok' as const),
        fillPercent: capacity > 0 ? Math.round((plot.tankFill / capacity) * 100) : 0,
      };
    }
    return b;
  });
}

// Применить один тик к одному участку. Возвращает новый PlotState.
function tickPlot(plot: PlotState, effects: Required<TechEffects>, deltaSec: number): PlotState {
  const baseRate = effectiveExtractionRate(plot, effects);
  const ratio = powerRatio(plot, effects);
  const rate = baseRate * ratio;
  const capacity = effectiveTankCapacity(plot, effects);
  const ratePerSec = rate / 3600;
  const wantBarrels = ratePerSec * deltaSec;
  const freeTankSpace = Math.max(0, capacity - plot.tankFill);
  const extractable = Math.max(0, Math.min(wantBarrels, plot.reservesRemaining, freeTankSpace));

  const nextReserves = plot.reservesRemaining - extractable;
  const nextTankFill = plot.tankFill + extractable;
  const tankFull = capacity > 0 && nextTankFill >= capacity;

  const next: PlotState = {
    ...plot,
    reservesRemaining: nextReserves,
    tankFill: nextTankFill,
    daysRemaining: 0,
  };
  next.daysRemaining = recomputeDays(next, effects);
  next.buildings = updateBuildingDerivedStatus(next, tankFull);
  return next;
}

// ============ Рынок ============

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

// Цена продажи в $/бар с учётом oilGrade конкретного участка.
export function plotSellPrice(plot: PlotState, marketPrice: number): number {
  const grade: OilGrade = plot.oilGrade ?? 'urals';
  return marketPrice * OIL_GRADE_INFO[grade].priceMult;
}

// ============ Игрок и XP ============

const XP_PER_USD = 1 / 100;
const XP_GROWTH = 1.5;

// ============ Стор ============

interface GameState {
  player: PlayerState;
  plots: PlotState[];
  activePlotId: string;
  market: MarketState;
  research: ResearchState;
  lastTickAt: number;
  pendingLevelUp: number | null;
  pendingResearchDone: TechId | null;

  tick: (deltaSec: number) => void;
  upgradeBuilding: (buildingId: string) => boolean;
  buildBuilding: (type: BuildingType) => boolean;
  sellOil: (plotId?: string) => number;
  startResearch: (techId: TechId) => boolean;
  buyPlot: (worldPlotId: string) => boolean;
  switchPlot: (plotId: string) => void;
  acknowledgeLevelUp: () => void;
  acknowledgeResearchDone: () => void;
  setPlayerName: (name: string) => void;
  /** Универсальная трата. Возвращает true если деньги были и списались. */
  spendMoney: (amount: number) => boolean;
  reset: () => void;
}

let buildIdSeq = 100;
function nextBuildingId(): string {
  buildIdSeq += 1;
  return `b${buildIdSeq}-${Date.now().toString(36).slice(-4)}`;
}

// Получить активный участок из массива. Безопасно: если activePlotId неактуален —
// откатывается на первый.
function getActive(state: { plots: PlotState[]; activePlotId: string }): {
  plot: PlotState;
  index: number;
} {
  const idx = state.plots.findIndex((p) => p.id === state.activePlotId);
  const safeIdx = idx === -1 ? 0 : idx;
  return { plot: state.plots[safeIdx]!, index: safeIdx };
}

// Заменить участок в массиве по индексу.
function replacePlotAt(plots: PlotState[], idx: number, next: PlotState): PlotState[] {
  const out = plots.slice();
  out[idx] = next;
  return out;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      player: { ...mockPlayer },
      plots: [{ ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) }],
      activePlotId: mockPlot.id,
      market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
      research: { inProgress: null, completed: [] },
      lastTickAt: Date.now(),
      pendingLevelUp: null,
      pendingResearchDone: null,

      tick: (deltaSec) =>
        set((state) => {
          if (deltaSec <= 0) return state;
          const effects = aggregateTechEffects(state.research.completed);

          // 1. Цена.
          const newPrice = stepPrice(state.market.oilPrice, deltaSec);
          const nextHistory = [...state.market.priceHistory.slice(1), newPrice];

          // 2. Тик по каждому участку.
          const nextPlots = state.plots.map((p) => tickPlot(p, effects, deltaSec));

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
            plots: nextPlots,
            market: { oilPrice: newPrice, priceHistory: nextHistory },
            research: nextResearch,
            pendingResearchDone: researchDone ?? state.pendingResearchDone,
            lastTickAt: Date.now(),
          };
        }),

      upgradeBuilding: (buildingId) => {
        let ok = false;
        set((state) => {
          const { plot, index } = getActive(state);
          const idx = plot.buildings.findIndex((b) => b.id === buildingId);
          if (idx === -1) return state;
          const building = plot.buildings[idx]!;
          const cost = upgradeCost(building);
          if (state.player.money < cost) return state;

          const nextBuildings = plot.buildings.slice();
          nextBuildings[idx] = { ...building, level: building.level + 1 };
          const nextPlot: PlotState = { ...plot, buildings: nextBuildings };
          nextPlot.daysRemaining = recomputeDays(nextPlot);

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - cost },
            plots: replacePlotAt(state.plots, index, nextPlot),
          };
        });
        return ok;
      },

      buildBuilding: (type) => {
        let ok = false;
        set((state) => {
          const { plot, index } = getActive(state);
          if (plot.buildings.length >= plot.maxSlots) return state;
          const existingCount = plot.buildings.filter((b) => b.type === type).length;
          const cost = buildCost(type, existingCount);
          if (state.player.money < cost) return state;

          const newBuilding: Building = {
            id: nextBuildingId(),
            type,
            level: 1,
            status: 'ok',
          };
          const nextPlot: PlotState = { ...plot, buildings: [...plot.buildings, newBuilding] };
          nextPlot.daysRemaining = recomputeDays(nextPlot);

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - cost },
            plots: replacePlotAt(state.plots, index, nextPlot),
          };
        });
        return ok;
      },

      sellOil: (plotId) => {
        let revenue = 0;
        set((state) => {
          const idx = plotId
            ? state.plots.findIndex((p) => p.id === plotId)
            : state.plots.findIndex((p) => p.id === state.activePlotId);
          if (idx === -1) return state;
          const plot = state.plots[idx]!;
          if (plot.tankFill <= 0) return state;

          const price = plotSellPrice(plot, state.market.oilPrice);
          revenue = Math.round(plot.tankFill * price);

          // XP + level up (циклический).
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
            ...plot,
            tankFill: 0,
            buildings: plot.buildings.map((b) =>
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
            plots: replacePlotAt(state.plots, idx, nextPlot),
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

      buyPlot: (worldPlotId) => {
        let ok = false;
        set((state) => {
          // Уже куплен.
          if (state.plots.some((p) => p.id === worldPlotId)) return state;

          const template = getWorldPlot(worldPlotId);
          if (!template) return state;
          if (state.player.money < template.price) return state;
          if (state.player.level < template.minPlayerLevel) return state;

          // Эффекты науки на стартовые запасы при покупке.
          const effects = aggregateTechEffects(state.research.completed);
          const newPlot = createPlotFromTemplate(template, effects.reserveMult);

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - template.price },
            plots: [...state.plots, newPlot],
            // Сразу переключаемся на новый — иначе игрок не поймёт что произошло.
            activePlotId: newPlot.id,
          };
        });
        return ok;
      },

      switchPlot: (plotId) => {
        set((state) => {
          if (!state.plots.some((p) => p.id === plotId)) return state;
          return { activePlotId: plotId };
        });
      },

      setPlayerName: (name) =>
        set((state) => ({ player: { ...state.player, name: name || state.player.name } })),

      spendMoney: (amount) => {
        let ok = false;
        set((state) => {
          if (state.player.money < amount) return state;
          ok = true;
          return { player: { ...state.player, money: state.player.money - amount } };
        });
        return ok;
      },

      reset: () =>
        set({
          player: { ...mockPlayer },
          plots: [{ ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) }],
          activePlotId: mockPlot.id,
          market: { ...initialMarket, priceHistory: [...initialMarket.priceHistory] },
          research: { inProgress: null, completed: [] },
          lastTickAt: Date.now(),
          pendingLevelUp: null,
          pendingResearchDone: null,
        }),
    }),
    {
      name: 'oil-tycoon-save',
      version: 6,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        player: state.player,
        plots: state.plots,
        activePlotId: state.activePlotId,
        market: state.market,
        research: state.research,
        lastTickAt: state.lastTickAt,
      }),
      // Миграции:
      //   v1 (B.5): incomePerHour, без бака.
      //   v2 (C.1): + extractionRatePerHour + tankCapacity/tankFill.
      //   v3 (C.2): + market.
      //   v4 (D.1): убраны derived поля. + maxSlots.
      //   v5 (F.1): + research.
      //   v6 (F.2): plot → plots[] + activePlotId. У PlotState появился oilGrade.
      migrate: (persistedState, version) => {
        type RawSave = {
          player?: PlayerState;
          plot?: Partial<PlotState> & {
            incomePerHour?: number;
            extractionRatePerHour?: number;
            tankCapacity?: number;
            powerDraw?: number;
          };
          plots?: PlotState[];
          activePlotId?: string;
          market?: MarketState;
          research?: ResearchState;
          lastTickAt?: number;
        };
        const old = persistedState as RawSave;

        // Собираем список участков. Если был один plot — превращаем в массив.
        let plots: PlotState[];
        if (old.plots && old.plots.length > 0) {
          plots = old.plots.map((p) => ({
            ...p,
            oilGrade: p.oilGrade ?? 'urals',
            region: p.region ?? mockPlot.region,
            emoji: p.emoji ?? mockPlot.emoji,
          }));
        } else if (old.plot) {
          const buildings = old.plot.buildings ?? mockPlot.buildings;
          const reservesRemaining = old.plot.reservesRemaining ?? mockPlot.reservesRemaining;
          const reservesTotal = old.plot.reservesTotal ?? mockPlot.reservesTotal;
          const tankFill = Math.max(0, Math.min(old.plot.tankFill ?? 0, mockPlot.tankFill * 2));

          const plot: PlotState = {
            id: old.plot.id ?? mockPlot.id,
            name: old.plot.name ?? mockPlot.name,
            region: mockPlot.region,
            emoji: mockPlot.emoji,
            oilGrade: 'urals',
            reservesRemaining,
            reservesTotal,
            daysRemaining: 0,
            tankFill,
            maxSlots: mockPlot.maxSlots,
            buildings,
          };
          plot.daysRemaining = recomputeDays(plot);
          plots = [plot];
        } else {
          plots = [{ ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) }];
        }

        const activePlotId = old.activePlotId ?? plots[0]!.id;
        const research = old.research ?? { inProgress: null, completed: [] };

        return {
          player: old.player ?? mockPlayer,
          plots,
          activePlotId,
          market: old.market ?? {
            ...initialMarket,
            priceHistory: [...initialMarket.priceHistory],
          },
          research,
          lastTickAt: old.lastTickAt ?? Date.now(),
          pendingLevelUp: null,
          pendingResearchDone: null,
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

// Помощник для UI — селектор активного участка.
export function selectActivePlot(state: GameState): PlotState {
  const idx = state.plots.findIndex((p) => p.id === state.activePlotId);
  return state.plots[idx === -1 ? 0 : idx]!;
}

// Сколько всего стоит вся нефть во всех баках (по текущему рынку).
export function selectTotalTankValue(state: GameState): number {
  return state.plots.reduce(
    (sum, p) => sum + p.tankFill * plotSellPrice(p, state.market.oilPrice),
    0,
  );
}

export { upgradeCost, buildCost, WORLD_PLOTS, OIL_GRADE_INFO };
