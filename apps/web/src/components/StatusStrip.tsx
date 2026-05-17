import { Clock, Droplet, TrendingUp, Zap } from 'lucide-react';
import type { PlotState } from '../data/mockData';
import { formatBarrels, formatMoney } from '../lib/format';

interface Props {
  plot: PlotState;
}

export function StatusStrip({ plot }: Props) {
  const reservesPercent = Math.round((plot.reservesRemaining / plot.reservesTotal) * 100);

  return (
    <div className="space-y-1.5 border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-slate-300">
          <Droplet className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-mono">
            {formatBarrels(plot.reservesRemaining)} / {formatBarrels(plot.reservesTotal)} бар
          </span>
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {plot.daysRemaining} дн
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-amber-500"
          style={{ width: `${reservesPercent}%` }}
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1 font-mono text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />+{formatMoney(plot.incomePerHour)}/час
        </span>
        <span className="flex items-center gap-1 font-mono text-rose-400">
          <Zap className="h-3.5 w-3.5" />−{plot.powerDraw} кВт
        </span>
      </div>
    </div>
  );
}
