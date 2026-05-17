import { Gem, Menu, User, Zap } from 'lucide-react';
import type { PlayerState } from '../data/mockData';
import { formatMoneyFull } from '../lib/format';

// Floating HUD: чипы в углах, без постоянных полос.
// - Слева сверху: гамбургер + имя (компактно).
// - Справа сверху: деньги / кристаллы / уровень.
// Полу-прозрачные backdrop, не отъедают высоту сцены.

interface Props {
  player: PlayerState;
  onOpenMenu: () => void;
}

export function HudOverlay({ player, onOpenMenu }: Props) {
  const xpPercent = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));

  return (
    <>
      {/* Top-left: меню + имя */}
      <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-slate-200 shadow-lg backdrop-blur transition hover:bg-slate-800 active:scale-95"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur">
          <User className="h-3.5 w-3.5 text-slate-400" />
          {player.name}
        </div>
      </div>

      {/* Top-right: деньги + кристаллы + уровень. Скомпонованы в одну колонку
          из двух рядов на узких экранах; на десктопе в одну линию. */}
      <div className="pointer-events-none absolute right-2 top-2 z-30 flex flex-col items-end gap-1.5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur">
          <span className="font-mono tabular-nums text-emerald-400">
            {formatMoneyFull(player.money)}
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span className="flex items-center gap-1 font-mono text-sky-400">
            <Gem className="h-3 w-3" />
            {player.crystals}
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span
            className="flex items-center gap-1 font-mono text-amber-400"
            title={`${player.xp} / ${player.xpToNextLevel} XP`}
          >
            <Zap className="h-3 w-3" />
            {player.level}
          </span>
        </div>
        {/* XP-бар тонкая полоска под чипом */}
        <div className="pointer-events-none h-0.5 w-32 overflow-hidden rounded-full bg-slate-800/80">
          <div className="h-full bg-amber-500/70" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>
    </>
  );
}
