import { TrendingDown, TrendingUp } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

// Маленький бейдж с текущей ценой нефти + sparkline за последние 30 секунд.
// Sparkline — чистый SVG, без библиотек.
export function PriceTicker() {
  const price = useGameStore((s) => s.market.oilPrice);
  const history = useGameStore((s) => s.market.priceHistory);

  const prev = history[history.length - 2] ?? price;
  const up = price >= prev;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const width = 80;
  const height = 18;
  const step = width / (history.length - 1);
  const points = history
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
      <div className="flex flex-col leading-none">
        <span className="text-[10px] text-slate-500">Brent</span>
        <span className="font-mono text-xs font-semibold text-slate-200">
          ${price.toFixed(2)}
        </span>
      </div>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={up ? '#10b981' : '#f43f5e'}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {up ? (
        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
      )}
    </div>
  );
}
