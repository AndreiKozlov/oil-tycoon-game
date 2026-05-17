import { BarChart3, Globe2, Hammer, Settings, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: 'build' | 'world' | 'market' | 'leaderboard' | 'settings';
  icon: LucideIcon;
  label: string;
}

const items: NavItem[] = [
  { id: 'build', icon: Hammer, label: 'Участок' },
  { id: 'world', icon: Globe2, label: 'Мир' },
  { id: 'market', icon: BarChart3, label: 'Биржа' },
  { id: 'leaderboard', icon: Trophy, label: 'Рейтинг' },
  { id: 'settings', icon: Settings, label: 'Опции' },
];

interface Props {
  active?: NavItem['id'];
  onChange?: (id: NavItem['id']) => void;
}

export function BottomNav({ active = 'build', onChange }: Props) {
  return (
    <nav className="border-t border-slate-800 bg-slate-900/80 px-2 py-1.5 backdrop-blur">
      <div className="flex items-stretch justify-around gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 transition ${
                isActive
                  ? 'bg-slate-800 text-amber-400'
                  : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
