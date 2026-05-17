import { Check, Coins, Globe2, Lock, MapPin } from 'lucide-react';
import type { PlotState } from '../data/mockData';
import { OIL_GRADE_INFO, WORLD_PLOTS, type WorldPlotTemplate } from '../data/worldPlots';
import { aggregateTechEffects, plotSellPrice, useGameStore } from '../store/gameStore';
import { plotExtractionRate, plotTankCapacity } from '../lib/gameFormulas';
import { formatBarrels, formatMoney } from '../lib/format';
import { haptic } from '../lib/telegram';

interface OwnedRowProps {
  plot: PlotState;
  active: boolean;
  oilPrice: number;
  onSwitch: () => void;
}

function OwnedRow({ plot, active, oilPrice, onSwitch }: OwnedRowProps) {
  const grade = OIL_GRADE_INFO[plot.oilGrade ?? 'urals'];
  const reservesPercent = Math.round((plot.reservesRemaining / plot.reservesTotal) * 100);
  const tankCap = plotTankCapacity(plot);
  const tankPercent = tankCap > 0 ? Math.round((plot.tankFill / tankCap) * 100) : 0;
  const rate = plotExtractionRate(plot);
  const sellPrice = plotSellPrice(plot, oilPrice);

  return (
    <button
      type="button"
      onClick={onSwitch}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        active
          ? 'border-amber-500 bg-amber-900/20'
          : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
      }`}
    >
      <span className="text-2xl">{plot.emoji ?? '⛽'}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{plot.name}</h3>
          {active && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <Check className="h-3 w-3" />
              Активен
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400">{plot.region ?? '—'}</p>

        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
          <span
            className="rounded px-1.5 py-0.5 font-mono"
            style={{ color: grade.color, backgroundColor: `${grade.color}22` }}
          >
            {grade.name} ×{grade.priceMult.toFixed(2)}
          </span>
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-300">
            {formatBarrels(plot.reservesRemaining)} бар ({reservesPercent}%)
          </span>
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-300">
            +{formatMoney(rate * sellPrice)}/час
          </span>
          {plot.tankFill > 0 && (
            <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-300">
              Бак {tankPercent}% · {formatMoney(plot.tankFill * sellPrice)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface AvailableRowProps {
  template: WorldPlotTemplate;
  playerLevel: number;
  money: number;
  reserveMult: number;
  onBuy: () => void;
}

function AvailableRow({ template, playerLevel, money, reserveMult, onBuy }: AvailableRowProps) {
  const grade = OIL_GRADE_INFO[template.oilGrade];
  const levelOk = playerLevel >= template.minPlayerLevel;
  const moneyOk = money >= template.price;
  const canBuy = levelOk && moneyOk;
  const effectiveReserves = Math.round(template.reservesTotal * reserveMult);

  return (
    <div
      className={`rounded-xl border p-3 ${
        levelOk ? 'border-slate-700 bg-slate-900/50' : 'border-slate-800 bg-slate-900/40 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-2xl ${!levelOk ? 'grayscale' : ''}`}>{template.emoji}</span>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {template.name}
              {!levelOk && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-rose-400">
                  <Lock className="h-2.5 w-2.5" />
                  ур.{template.minPlayerLevel}
                </span>
              )}
            </h3>
            <span className="font-mono text-sm text-emerald-400">
              {formatMoney(template.price)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{template.region}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
            <span
              className="rounded px-1.5 py-0.5 font-mono"
              style={{ color: grade.color, backgroundColor: `${grade.color}22` }}
            >
              {grade.name} ×{grade.priceMult.toFixed(2)}
            </span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-300">
              {formatBarrels(effectiveReserves)} бар запасов
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!canBuy}
        onClick={onBuy}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
          canBuy
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]'
            : 'cursor-not-allowed bg-slate-800 text-slate-500'
        }`}
      >
        {!levelOk
          ? `Откроется на ${template.minPlayerLevel} уровне`
          : !moneyOk
            ? `Не хватает ${formatMoney(template.price - money)}`
            : 'Купить'}
      </button>
    </div>
  );
}

export function WorldMapScreen() {
  const plots = useGameStore((s) => s.plots);
  const activePlotId = useGameStore((s) => s.activePlotId);
  const money = useGameStore((s) => s.player.money);
  const playerLevel = useGameStore((s) => s.player.level);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const research = useGameStore((s) => s.research);
  const buyPlot = useGameStore((s) => s.buyPlot);
  const switchPlot = useGameStore((s) => s.switchPlot);

  const reserveMult = aggregateTechEffects(research.completed).reserveMult;

  const ownedIds = new Set(plots.map((p) => p.id));
  const available = WORLD_PLOTS.filter((t) => !ownedIds.has(t.id));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Globe2 className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold">Эпоха «Сибирская»</h2>
        </div>
        <p className="text-[11px] text-slate-500">
          Купи новые участки, чтобы добывать параллельно. Добыча идёт даже на неактивных.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {/* Свои участки */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
            <MapPin className="h-3 w-3" />
            Твои участки ({plots.length})
          </div>
          <div className="space-y-2">
            {plots.map((p) => (
              <OwnedRow
                key={p.id}
                plot={p}
                active={p.id === activePlotId}
                oilPrice={oilPrice}
                onSwitch={() => {
                  if (p.id !== activePlotId) {
                    switchPlot(p.id);
                    haptic('medium');
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Доступные к покупке */}
        {available.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              <Coins className="h-3 w-3" />
              Доступно к покупке ({available.length})
            </div>
            <div className="space-y-2">
              {available.map((t) => (
                <AvailableRow
                  key={t.id}
                  template={t}
                  playerLevel={playerLevel}
                  money={money}
                  reserveMult={reserveMult}
                  onBuy={() => {
                    if (buyPlot(t.id)) haptic('success');
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {available.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
            Все участки эпохи скуплены. Жди следующей эпохи — карта обновится.
          </p>
        )}
      </div>
    </div>
  );
}
