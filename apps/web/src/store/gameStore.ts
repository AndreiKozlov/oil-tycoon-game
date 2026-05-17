// Глобальное состояние игры. Zustand — минимальный стор, без бойлерплейта.
// На этапе B держим только данные одного участка + игрока. Сохранения в
// localStorage добавлю отдельным тикетом (B.5).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  mockPlayer,
  mockPlot,
  type Building,
  type PlayerState,
  type PlotState,
} from '../data/mockData';

// Грубая константа цены нефти (Brent ~$60/бар). Будет заменена биржевой
// логикой на этапе 2. Используется тиком, чтобы пересчитать сколько баррелей
// уходит за реальный поток дохода.
export const OIL_USD_PER_BARREL = 60;

interface GameState {
  player: PlayerState;
  plot: PlotState;
  // Локальный таймстамп последнего тика — устойчиво к скачкам requestAnimationFrame.
  lastTickAt: number;

  // Прибавить deltaSec секунд игрового времени. Дробное число — ок.
  tick: (deltaSec: number) => void;
  // Апгрейд постройки: списать деньги, повысить уровень, поднять incomePerHour.
  // Возвращает true если апгрейд прошёл, false если денег не хватило.
  upgradeBuilding: (buildingId: string) => boolean;
  // Сбросить в исходное состояние (для отладки).
  reset: () => void;
}

// Стоимость следующего апгрейда: базовая цена * 1.5^current_level.
// Бaза зависит от типа постройки — вышка дорогая, генератор дешёвый.
const UPGRADE_BASE: Record<Building['type'], number> = {
  derrick: 50_000,
  well: 30_000,
  tank: 20_000,
  generator: 15_000,
};

// Каждый апгрейд даёт +20% к общему доходу участка. На этапе B упрощённо —
// потом заменю расчётом «доход вышки * множитель × оборудование».
const INCOME_BONUS_PER_UPGRADE = 0.2;

export function upgradeCost(building: Building): number {
  return Math.round(UPGRADE_BASE[building.type] * 1.5 ** building.level);
}

function recomputeDays(plot: PlotState): number {
  if (plot.incomePerHour <= 0) return Infinity;
  const barrelsPerHour = plot.incomePerHour / OIL_USD_PER_BARREL;
  const hoursLeft = plot.reservesRemaining / barrelsPerHour;
  return Math.max(0, Math.ceil(hoursLeft / 24));
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      player: { ...mockPlayer },
      plot: { ...mockPlot, buildings: mockPlot.buildings.map((b: Building) => ({ ...b })) },
      lastTickAt: Date.now(),

      tick: (deltaSec) =>
        set((state) => {
          if (deltaSec <= 0) return state;

          const incomePerSec = state.plot.incomePerHour / 3600;
          const barrelsPerSec = incomePerSec / OIL_USD_PER_BARREL;

          const earned = incomePerSec * deltaSec;
          const consumedBarrels = barrelsPerSec * deltaSec;

          const nextReserves = Math.max(0, state.plot.reservesRemaining - consumedBarrels);
          // Если запас иссяк — обнуляем доход (вышка ничего не качает).
          const exhausted = nextReserves <= 0;
          const nextIncome = exhausted ? 0 : state.plot.incomePerHour;

          const nextPlot: PlotState = {
            ...state.plot,
            reservesRemaining: nextReserves,
            incomePerHour: nextIncome,
            daysRemaining: 0,
          };
          nextPlot.daysRemaining = recomputeDays(nextPlot);

          return {
            player: { ...state.player, money: state.player.money + earned },
            plot: nextPlot,
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

          ok = true;
          return {
            player: { ...state.player, money: state.player.money - cost },
            plot: {
              ...state.plot,
              buildings: nextBuildings,
              incomePerHour: Math.round(state.plot.incomePerHour * (1 + INCOME_BONUS_PER_UPGRADE)),
            },
          };
        });
        return ok;
      },

      reset: () =>
        set({
          player: { ...mockPlayer },
          plot: { ...mockPlot, buildings: mockPlot.buildings.map((b) => ({ ...b })) },
          lastTickAt: Date.now(),
        }),
    }),
    {
      name: 'oil-tycoon-save',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Сохраняем только игровое состояние, не функции.
      partialize: (state) => ({
        player: state.player,
        plot: state.plot,
        lastTickAt: state.lastTickAt,
      }),
      // При загрузке — начислим оффлайн-прибыль (макс 8 часов, чтобы не было
      // эксплойта «оставил вкладку на месяц → +миллион»).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const offlineSec = Math.min(8 * 3600, Math.max(0, (Date.now() - state.lastTickAt) / 1000));
        if (offlineSec > 0) state.tick(offlineSec);
      },
    },
  ),
);
