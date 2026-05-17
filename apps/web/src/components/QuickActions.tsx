import { DollarSign, Hammer, ShoppingBag, type LucideIcon } from 'lucide-react';
import { selectActivePlot, useGameStore, plotSellPrice } from '../store/gameStore';
import { formatMoney } from '../lib/format';

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tone: 'primary' | 'success' | 'muted';
  disabled?: boolean;
  onClick?: () => void;
}

function ActionButton({ icon: Icon, label, hint, tone, disabled, onClick }: ActionButtonProps) {
  const toneClasses: Record<ActionButtonProps['tone'], string> = {
    primary: 'border-amber-700 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50',
    success: 'border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50',
    muted: 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600 ${toneClasses[tone]}`}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {hint && <span className="font-mono text-[10px] opacity-80">{hint}</span>}
    </button>
  );
}

interface Props {
  onSold?: (revenue: number) => void;
  onOpenBuild?: () => void;
}

export function QuickActions({ onSold, onOpenBuild }: Props) {
  const plot = useGameStore(selectActivePlot);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const sellOil = useGameStore((s) => s.sellOil);

  const tankFill = plot.tankFill;
  const slotsUsed = plot.buildings.length;
  const maxSlots = plot.maxSlots;
  const tankValue = Math.round(tankFill * plotSellPrice(plot, oilPrice));
  const canSell = tankFill > 0;
  const slotsHint = `${slotsUsed}/${maxSlots}`;

  return (
    <div className="flex gap-2 border-t border-slate-800 bg-slate-900/40 px-3 py-2">
      <ActionButton
        icon={Hammer}
        label="Построить"
        hint={slotsHint}
        tone="primary"
        onClick={onOpenBuild}
        disabled={slotsUsed >= maxSlots}
      />
      <ActionButton
        icon={DollarSign}
        label="Продать"
        hint={canSell ? formatMoney(tankValue) : '—'}
        tone="success"
        disabled={!canSell}
        onClick={() => {
          const revenue = sellOil();
          if (revenue > 0) onSold?.(revenue);
        }}
      />
      <ActionButton icon={ShoppingBag} label="Магазин" tone="muted" />
    </div>
  );
}
