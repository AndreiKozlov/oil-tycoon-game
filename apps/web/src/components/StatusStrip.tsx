import { Clock, Droplet, Gauge, TrendingUp } from 'lucide-react';
import type { PlotState } from '../data/mockData';
import { useGameStore } from '../store/gameStore';
import { formatBarrels, formatMoney } from '../lib/format';
import { PriceTicker } from './PriceTicker';

interface Props {
  plot: PlotState;
}

export function StatusStrip({ plot }: Props) {
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const reservesPercent = Math.round((plot.reservesRemaining / plot.reservesTotal) * 100);
  const tankPercent = Math.round((plot.tankFill / plot.tankCapacity) * 100);
  const tankFull = tankPercent >= 100;
  const exhausted = plot.reservesRemaining <= 0;
  const tankValueUsd = plot.tankFill * oilPrice;

  return (
    <div className="space-y-2 border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
      {/* Цена нефти */}
      <div className="flex items-center justify-between">
        <PriceTicker />
        <span className="flex items-center gap-1 font-mono text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />+{formatMoney(plot.extractionRatePerHour * oilPrice)}
          /час
        </span>
      </div>

      {/* Запасы в недрах */}
      <div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1">
            <Droplet className="h-3.5 w-3.5 text-amber-500" />
            Запасы:{' '}
            <span className="font-mono">
              {formatBarrels(plot.reservesRemaining)} / {formatBarrels(plot.reservesTotal)} бар
            </span>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {Number.isFinite(plot.daysRemaining) ? `${plot.daysRemaining} дн` : '∞'}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-amber-500" style={{ width: `${reservesPercent}%` }} />
        </div>
      </div>

      {/* Резервуар */}
      <div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1">
            <Gauge className={`h-3.5 w-3.5 ${tankFull ? 'text-rose-400' : 'text-sky-400'}`} />
            Резервуар:{' '}
            <span className="font-mono">
              {formatBarrels(plot.tankFill)} / {formatBarrels(plot.tankCapacity)} бар
            </span>
          </span>
          {plot.tankFill > 0 && (
            <span className="font-mono text-emerald-400">≈ {formatMoney(tankValueUsd)}</span>
          )}
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all ${tankFull ? 'bg-rose-500' : 'bg-sky-500'}`}
            style={{ width: `${tankPercent}%` }}
          />
        </div>
        {tankFull && (
          <p className="mt-1 text-[11px] text-rose-400">
            Резервуар полон. Добыча остановлена — продай нефть.
          </p>
        )}
        {!tankFull && exhausted && (
          <p className="mt-1 text-[11px] text-rose-400">Запас иссяк — нужен новый участок.</p>
        )}
      </div>
    </div>
  );
}
