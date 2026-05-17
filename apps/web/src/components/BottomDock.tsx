import { DollarSign, Hammer, MapPin } from 'lucide-react';
import { selectActivePlot, plotSellPrice, useGameStore } from '../store/gameStore';
import { plotTankCapacity } from '../lib/gameFormulas';
import { formatBarrels, formatMoney } from '../lib/format';

// Узкий dock в правом нижнем углу. Заменяет PlotHeader + StatusStrip + QuickActions.
// На сцене занимает мало места, разворачивается по тапу.

interface Props {
  onSell: () => void;
  onOpenBuild: () => void;
  onOpenWorld: () => void;
}

export function BottomDock({ onSell, onOpenBuild, onOpenWorld }: Props) {
  const plot = useGameStore(selectActivePlot);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const capacity = plotTankCapacity(plot);
  const tankPercent = capacity > 0 ? Math.round((plot.tankFill / capacity) * 100) : 0;
  const tankValue = plot.tankFill * plotSellPrice(plot, oilPrice);
  const canSell = plot.tankFill > 0;
  const tankFull = capacity > 0 && tankPercent >= 100;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex items-end justify-between gap-2 px-2">
      {/* Слева снизу: компактная инфа об активном участке (тап → переход на карту) */}
      <button
        type="button"
        onClick={onOpenWorld}
        className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-900/85 px-3 py-2 text-left shadow-lg backdrop-blur transition hover:bg-slate-800 active:scale-[0.98]"
      >
        <span className="text-lg leading-none">{plot.emoji ?? '⛽'}</span>
        <div className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 text-xs font-semibold">
            <MapPin className="h-3 w-3 text-amber-400" />
            {plot.name}
          </span>
          <span
            className={`font-mono text-[10px] ${
              tankFull ? 'text-rose-400' : 'text-slate-400'
            }`}
            title="Заполнение резервуара"
          >
            🛢 {formatBarrels(plot.tankFill)}/{formatBarrels(capacity)} ({tankPercent}%)
          </span>
        </div>
      </button>

      {/* Справа снизу: две главные кнопки действий */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBuild}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/85 text-amber-300 shadow-lg backdrop-blur transition hover:bg-slate-800 active:scale-95"
          title="Построить"
        >
          <Hammer className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSell}
          disabled={!canSell}
          className={`flex h-12 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold shadow-lg backdrop-blur transition active:scale-95 ${
            canSell
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'cursor-not-allowed bg-slate-800/85 text-slate-600'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          {canSell ? formatMoney(tankValue) : 'Бак пуст'}
        </button>
      </div>
    </div>
  );
}
