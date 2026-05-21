// Глобальная карта Земли (G.4): viewer + sheet выбранной клетки с покупкой
// и разведкой. Локальный mapStore (zustand+persist), без сервера.

import { useState } from 'react';
import {
  EarthGlobeCanvas,
  EARTH_BIOME_INFO,
  type EarthTileSelection,
} from '../components/EarthGlobeCanvas';
import { EarthCellSheet } from '../components/EarthCellSheet';
import { useMapStore } from '../store/mapStore';
import { useGameStore } from '../store/gameStore';

export function WorldMapScreen() {
  const [tile, setTile] = useState<EarthTileSelection | null>(null);
  const ownedMap = useMapStore((s) => s.owned);
  const myCellsCount = useMapStore((s) => s.myCellsCount());
  const money = useGameStore((s) => s.player.money);

  return (
    <div className="relative h-full w-full">
      <EarthGlobeCanvas onTileClick={setTile} ownedCells={ownedMap} />

      {/* Топ-бар: баланс + сколько моих участков */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow backdrop-blur">
          💰 {Math.floor(money).toLocaleString('ru-RU')} $
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow backdrop-blur">
          🗺 {myCellsCount} участков
        </div>
      </div>

      {tile && (
        <EarthCellSheet
          tile={tile}
          biomeInfo={EARTH_BIOME_INFO[tile.biome]}
          onClose={() => setTile(null)}
        />
      )}
    </div>
  );
}
