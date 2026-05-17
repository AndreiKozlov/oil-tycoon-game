// G.3: новый экран Глобальной карты.
// Старая версия со списком купленных участков (нефтяной прототип) отправлена
// в legacy-oil-only branch на GitHub. Здесь — настоящая карта мира с Canvas.
//
// Что показано:
//   • Канвас 100×60 тайлов (прототипный размер; на проде 30000+).
//   • Pan (drag), zoom (wheel/pinch), клик по тайлу.
//   • Подсказка с координатой и биомом при наведении.
//   • При клике — пока просто алерт. Sheet с действиями (Разведать/Купить)
//     добавим, когда пользователь нарисует UI для него.

import { useState } from 'react';
import { WorldMapCanvas, type TileSelection } from '../components/WorldMapCanvas';
import { BIOME_INFO } from '../lib/biomeMap';

export function WorldMapScreen() {
  const [lastTile, setLastTile] = useState<TileSelection | null>(null);

  return (
    <div className="relative h-full w-full">
      <WorldMapCanvas onTileClick={setLastTile} />

      {/* Sheet с инфой о выбранном тайле. Вода неактивна — sheet не показывается
          (фильтр в WorldMapCanvas onTileClick). */}
      {lastTile && (
        <div className="pointer-events-auto absolute bottom-20 left-3 right-3 z-20 mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-3 text-sm shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-slate-500">
                Тайл ({lastTile.x}, {lastTile.y})
              </p>
              <p className="text-base font-semibold">
                {BIOME_INFO[lastTile.biome].emoji} {BIOME_INFO[lastTile.biome].name}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Свободен. Можно разведать или купить (доступно после G.5).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLastTile(null)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
