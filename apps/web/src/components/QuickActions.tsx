import { DollarSign, ShoppingBag, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  tone: 'primary' | 'success' | 'muted';
  onClick?: () => void;
}

function ActionButton({ icon: Icon, label, tone, onClick }: ActionButtonProps) {
  const toneClasses: Record<ActionButtonProps['tone'], string> = {
    primary: 'border-amber-700 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50',
    success: 'border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50',
    muted: 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${toneClasses[tone]}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function QuickActions() {
  return (
    <div className="flex gap-2 border-t border-slate-800 bg-slate-900/40 px-3 py-2">
      <ActionButton icon={ShoppingBag} label="Магазин" tone="primary" />
      <ActionButton icon={DollarSign} label="Продать" tone="success" />
      <ActionButton icon={Wrench} label="Ремонт" tone="muted" />
    </div>
  );
}
