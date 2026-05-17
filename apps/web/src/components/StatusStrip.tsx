import { Clock, Droplet, Gauge, TrendingUp, Zap } from 'lucide-react';
import type { PlotState } from '../data/mockData';
import { plotSellPrice, powerRatio, useGameStore } from '../store/gameStore';
import { OIL_GRADE_INFO } from '../data/worldPlots';
import {
  plotExtractionRate,
  plotPowerDraw,
  plotPowerProduced,
  plotTankCapacity,
} from '../lib/gameFormulas';
import { formatBarrels, formatMoney } from '../lib/format';
import { PriceTicker } from './PriceTicker';

interface Props {
  plot: PlotState;
}

export function StatusStrip({ plot }: Props) {
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const extractionRate = plotExtractionRate(plot);
  const tankCapacity = plotTankCapacity(plot);
  const produced = plotPowerProduced(plot);
  const draw = plotPowerDraw(plot);
  const ratio = powerRatio(plot);
  const effectiveRate = extractionRate * ratio;
  const powerShortage = ratio < 1;

  const reservesPercent = Math.round((plot.reservesRemaining / plot.reservesTotal) * 100);
  const tankPercent = tankCapacity > 0 ? Math.round((plot.tankFill / tankCapacity) * 100) : 0;
  const tankFull = tankCapacity > 0 && tankPercent >= 100;
  const noTank = tankCapacity === 0;
  const exhausted = plot.reservesRemaining <= 0;
  const sellPrice = plotSellPrice(plot, oilPrice);
  const tankValueUsd = plot.tankFill * sellPrice;
  const gradeInfo = OIL_GRADE_INFO[plot.oilGrade ?? 'urals'];

  return (
    <div className="space-y-2 border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
      {/* Цена нефти + поток дохода (с учётом oilGrade этого участка) */}
      <div className="flex items-center justify-between">
        <PriceTicker />
        <div className="flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-1 font-mono text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />+{formatMoney(effectiveRate * sellPrice)}/час
          </span>
          <span
            className="rounded px-1 py-0 text-[9px] font-mono"
            style={{ color: gradeInfo.color, backgroundColor: `${gradeInfo.color}22` }}
            title={`${gradeInfo.name}: ×${gradeInfo.priceMult.toFixed(2)} к базовой цене`}
          >
            {gradeInfo.name} ×{gradeInfo.priceMult.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Энергобаланс */}
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-1 ${
            powerShortage ? 'text-rose-400' : 'text-slate-300'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="font-mono">
            {produced} / {draw} кВт
          </span>
        </span>
        {powerShortage && (
          <span className="text-[11px] text-rose-400">
            Не хватает энергии — добыча {Math.round(ratio * 100)}%
          </span>
        )}
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
              {formatBarrels(plot.tankFill)} / {formatBarrels(tankCapacity)} бар
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
        {noTank && (
          <p className="mt-1 text-[11px] text-rose-400">
            Нет резервуаров — нефть некуда складывать. Построй бак.
          </p>
        )}
        {tankFull && !noTank && (
          <p className="mt-1 text-[11px] text-rose-400">
            Резервуар полон. Добыча остановлена — продай нефть или построй ещё бак.
          </p>
        )}
        {!tankFull && exhausted && (
          <p className="mt-1 text-[11px] text-rose-400">Запас иссяк — нужен новый участок.</p>
        )}
      </div>
    </div>
  );
}
