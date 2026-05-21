// Стейт глобальной карты участков (отдельно от gameStore).
//
// Логика:
//   • Каждая клетка карты идентифицируется (gx, gy).
//   • Клетка может быть: свободна / куплена мной / куплена другим (NPC-mock).
//   • Купленная клетка может быть «разведана» — тогда вскрывается есть ли
//     там нефть/газ/пусто (моковая вероятность).
//   • Стоимость покупки — функция (биом, координаты). Без сервера, локально.
//
// Persist в localStorage чтобы прогресс не терялся при перезагрузке.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CellOwner = 'me' | 'npc';

export type ProspectResult = 'empty' | 'oil' | 'gas';

export interface OwnedCell {
  gx: number;
  gy: number;
  /** биом из карты в момент покупки — фиксируем, чтобы цена/доход не плавали */
  biome: 'water' | 'land';
  owner: CellOwner;
  /** unix-секунды */
  purchasedAt: number;
  /** разведана ли клетка */
  prospected: boolean;
  /** результат разведки (если prospected=true) */
  result?: ProspectResult;
  /** ник владельца для NPC, чтобы было что показать в UI */
  ownerName?: string;
}

interface MapState {
  // Map<`${gx}_${gy}`, OwnedCell>
  owned: Record<string, OwnedCell>;

  // ====== queries ======
  getCell: (gx: number, gy: number) => OwnedCell | undefined;
  myCellsCount: () => number;

  // ====== actions ======
  /** Зарегистрировать клетку как мою. Не проверяет деньги — это делает caller. */
  claimCell: (gx: number, gy: number, biome: 'water' | 'land') => void;
  /** Развед клетку. Возвращает результат. */
  prospect: (gx: number, gy: number) => ProspectResult | null;

  reset: () => void;
}

const STORAGE_KEY = 'oil-tycoon:map:v1';

function cellKey(gx: number, gy: number) {
  return `${gx}_${gy}`;
}

// Псевдослучайный, но детерминированный roll — чтобы при перезагрузке
// результат разведки не менялся для одной и той же клетки.
function hashRoll(gx: number, gy: number): number {
  let h = (gx * 73856093) ^ (gy * 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function rollProspect(gx: number, gy: number, biome: 'water' | 'land'): ProspectResult {
  const r = hashRoll(gx, gy);
  // Прибрежная вода — чаще газ; суша — чаще нефть.
  if (biome === 'water') {
    if (r < 0.15) return 'gas';
    if (r < 0.20) return 'oil';
    return 'empty';
  } else {
    if (r < 0.22) return 'oil';
    if (r < 0.30) return 'gas';
    return 'empty';
  }
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      owned: {},

      getCell: (gx, gy) => get().owned[cellKey(gx, gy)],

      myCellsCount: () =>
        Object.values(get().owned).filter((c) => c.owner === 'me').length,

      claimCell: (gx, gy, biome) =>
        set((state) => {
          const key = cellKey(gx, gy);
          if (state.owned[key]) return state; // уже занята
          return {
            owned: {
              ...state.owned,
              [key]: {
                gx,
                gy,
                biome,
                owner: 'me',
                purchasedAt: Math.floor(Date.now() / 1000),
                prospected: false,
              },
            },
          };
        }),

      prospect: (gx, gy) => {
        const key = cellKey(gx, gy);
        const cell = get().owned[key];
        if (!cell || cell.owner !== 'me') return null;
        if (cell.prospected) return cell.result ?? 'empty';
        const result = rollProspect(gx, gy, cell.biome);
        set((state) => ({
          owned: {
            ...state.owned,
            [key]: { ...cell, prospected: true, result },
          },
        }));
        return result;
      },

      reset: () => set({ owned: {} }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

// Цена покупки клетки. Зависит от биома и широты (континентальный центр дороже).
export function cellPrice(gx: number, gy: number, biome: 'water' | 'land'): number {
  // gy 0..149: 0=полюс, 75=экватор, 149=полюс. Центральные широты дороже.
  const equatorDist = Math.abs(gy - 75) / 75; // 0 на экваторе, 1 на полюсе
  const latMult = 1.6 - equatorDist * 0.8;    // 1.6 на экваторе, 0.8 у полюса
  const biomeBase = biome === 'land' ? 12_000 : 3_500;
  return Math.round(biomeBase * latMult);
}

export function prospectCost(biome: 'water' | 'land'): number {
  return biome === 'land' ? 5_000 : 2_000;
}
