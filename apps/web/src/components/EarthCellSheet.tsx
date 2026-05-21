// Sheet выбранной клетки на глобальной карте: показ статуса, покупка, разведка.
//
// Состояния:
//   1) Клетка свободна            → кнопка «Купить» (цена зависит от биома)
//   2) Куплена мной, не разведана → кнопка «Разведать»
//   3) Куплена мной, разведана    → показ результата (нефть/газ/пусто)
//                                   + будущая кнопка «Строить» (placeholder)
//   4) Куплена NPC                → инфо «занято игроком ⟨ник⟩»
//
// Без сервера: всё локально через mapStore+gameStore.

import { useMemo } from 'react';
import type { EarthTileSelection, EarthBiome } from './EarthGlobeCanvas';
import {
  useMapStore,
  cellPrice,
  prospectCost,
  type OwnedCell,
  type ProspectResult,
} from '../store/mapStore';
import { useGameStore } from '../store/gameStore';

interface Props {
  tile: EarthTileSelection;
  biomeInfo: { name: string; emoji: string; isLand: boolean };
  onClose: () => void;
}

const RESULT_ICON: Record<ProspectResult, string> = {
  oil: '🛢️',
  gas: '💨',
  empty: '🪨',
};

const RESULT_LABEL: Record<ProspectResult, string> = {
  oil: 'Найдена нефть',
  gas: 'Найден природный газ',
  empty: 'Ресурсов не обнаружено',
};

const RESULT_TONE: Record<ProspectResult, string> = {
  oil: 'text-amber-300',
  gas: 'text-sky-300',
  empty: 'text-slate-400',
};

export function EarthCellSheet({ tile, biomeInfo, onClose }: Props) {
  const cell = useMapStore((s) => s.owned[`${tile.gx}_${tile.gy}`]) as OwnedCell | undefined;
  const claimCell = useMapStore((s) => s.claimCell);
  const prospect = useMapStore((s) => s.prospect);
  const money = useGameStore((s) => s.player.money);
  const spendMoney = useGameStore((s) => s.spendMoney);

  const biomeForPrice: 'water' | 'land' = tile.biome === 'land' ? 'land' : 'water';
  const price = useMemo(
    () => cellPrice(tile.gx, tile.gy, biomeForPrice),
    [tile.gx, tile.gy, biomeForPrice],
  );
  const exploreCost = prospectCost(biomeForPrice);

  // ===== ACTIONS =====
  const handleBuy = () => {
    if (cell) return;
    if (!spendMoney(price)) return;
    claimCell(tile.gx, tile.gy, biomeForPrice);
  };

  const handleProspect = () => {
    if (!cell || cell.owner !== 'me' || cell.prospected) return;
    if (!spendMoney(exploreCost)) return;
    prospect(tile.gx, tile.gy);
  };

  // ===== RENDER =====
  const canAfford = money >= price;
  const canProspect = cell?.owner === 'me' && !cell.prospected && money >= exploreCost;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-20 mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-sm shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-mono text-[11px] text-slate-500">
            Участок #{tile.id} · ({tile.gx}, {tile.gy})
          </p>
          <p className="mt-0.5 text-base font-semibold">
            {biomeInfo.emoji} {biomeInfo.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      {/* === Состояние клетки === */}
      <div className="mt-3 space-y-3">
        {/* 1) Свободна — можно купить */}
        {!cell && (
          <>
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
              Свободный участок. Можно купить для дальнейшего освоения.
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-500">Стоимость</div>
                <div className="text-lg font-semibold text-amber-300">
                  {price.toLocaleString('ru-RU')} $
                </div>
              </div>
              <button
                type="button"
                disabled={!canAfford}
                onClick={handleBuy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {canAfford ? 'Купить' : 'Не хватает $'}
              </button>
            </div>
          </>
        )}

        {/* 2) Моя, не разведана */}
        {cell?.owner === 'me' && !cell.prospected && (
          <>
            <div className="rounded-lg bg-emerald-900/40 px-3 py-2 text-xs text-emerald-200">
              ✓ Ваш участок · не разведан
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-500">Стоимость разведки</div>
                <div className="text-lg font-semibold text-amber-300">
                  {exploreCost.toLocaleString('ru-RU')} $
                </div>
              </div>
              <button
                type="button"
                disabled={!canProspect}
                onClick={handleProspect}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {canProspect ? '🔍 Разведать' : 'Не хватает $'}
              </button>
            </div>
          </>
        )}

        {/* 3) Моя, разведана */}
        {cell?.owner === 'me' && cell.prospected && cell.result && (
          <>
            <div className="rounded-lg bg-emerald-900/40 px-3 py-2 text-xs text-emerald-200">
              ✓ Ваш участок · разведан
            </div>
            <div
              className={`rounded-lg bg-slate-800/70 px-3 py-3 text-center ${RESULT_TONE[cell.result]}`}
            >
              <div className="text-3xl">{RESULT_ICON[cell.result]}</div>
              <div className="mt-1 text-sm font-semibold">{RESULT_LABEL[cell.result]}</div>
            </div>
            {cell.result !== 'empty' ? (
              <button
                type="button"
                disabled
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-300"
                title="Доступно после G.6"
              >
                🏗 Построить вышку (скоро)
              </button>
            ) : (
              <div className="text-center text-[11px] text-slate-500">
                Участок пуст. Его всё ещё можно перепродать (доступно после G.6).
              </div>
            )}
          </>
        )}

        {/* 4) NPC */}
        {cell?.owner === 'npc' && (
          <div className="rounded-lg bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
            🚫 Занято игроком{cell.ownerName ? ` «${cell.ownerName}»` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
