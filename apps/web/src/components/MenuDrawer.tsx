import { BarChart3, FlaskConical, Globe2, Hammer, Trophy, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Drawer слева. Открывается кликом по гамбургеру. Закрывается крестиком
// или тапом по затемнению. Стандарт мобильных игр (Last Day on Earth, Township).
export type NavTabId = 'build' | 'world' | 'market' | 'leaderboard' | 'research';

interface Item {
  id: NavTabId;
  icon: LucideIcon;
  label: string;
  hint: string;
}

const items: Item[] = [
  { id: 'build', icon: Hammer, label: 'Участок', hint: 'Твой текущий участок' },
  { id: 'world', icon: Globe2, label: 'Карта мира', hint: 'Купить или сменить участок' },
  { id: 'market', icon: BarChart3, label: 'Биржа', hint: 'Цены и история сделок' },
  { id: 'research', icon: FlaskConical, label: 'Наука', hint: 'Технологии и исследования' },
  { id: 'leaderboard', icon: Trophy, label: 'Рейтинг', hint: 'Топ игроков' },
];

interface Props {
  open: boolean;
  active: NavTabId;
  onChange: (id: NavTabId) => void;
  onClose: () => void;
}

export function MenuDrawer({ open, active, onChange, onClose }: Props) {
  return (
    <>
      {/* Затемнение */}
      <div
        className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      {/* Сам drawer */}
      <aside
        className={`absolute left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold">Меню</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isActive
                    ? 'bg-amber-900/30 text-amber-300'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-slate-500">{item.hint}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
