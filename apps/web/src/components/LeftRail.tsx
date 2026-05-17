import { BarChart3, FlaskConical, Globe2, Hammer, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Левый рейл с вертикальной навигацией. Заменяет BottomNav в landscape-режиме.
export type NavTabId = 'build' | 'world' | 'market' | 'leaderboard' | 'research';

interface NavItem {
  id: NavTabId;
  icon: LucideIcon;
  label: string;
}

const items: NavItem[] = [
  { id: 'build', icon: Hammer, label: 'Участок' },
  { id: 'world', icon: Globe2, label: 'Мир' },
  { id: 'market', icon: BarChart3, label: 'Биржа' },
  { id: 'research', icon: FlaskConical, label: 'Наука' },
  { id: 'leaderboard', icon: Trophy, label: 'Рейтинг' },
];

interface Props {
  active: NavTabId;
  onChange: (id: NavTabId) => void;
}

export function LeftRail({ active, onChange }: Props) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-stretch border-r border-slate-800 bg-slate-900/80 py-2 backdrop-blur sm:w-16">
      <div className="flex flex-col gap-1 px-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-2 transition ${
                isActive
                  ? 'bg-slate-800 text-amber-400'
                  : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
