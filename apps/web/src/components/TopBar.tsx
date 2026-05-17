import { Gem, User, Zap } from 'lucide-react';
import type { PlayerState } from '../data/mockData';
import { formatMoney } from '../lib/format';

interface Props {
  player: PlayerState;
}

export function TopBar({ player }: Props) {
  const xpPercent = Math.min(100, Math.round((player.xp / player.xpToNextLevel) * 100));
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800">
            <User className="h-4 w-4 text-slate-300" />
          </span>
          <span className="font-medium">{player.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono font-semibold text-emerald-400">
            {formatMoney(player.money)}
          </span>
          <span className="flex items-center gap-1 font-mono font-semibold text-sky-400">
            <Gem className="h-3.5 w-3.5" />
            {player.crystals}
          </span>
          <span
            className="flex items-center gap-1 font-mono font-semibold text-amber-400"
            title={`${player.xp} / ${player.xpToNextLevel} XP`}
          >
            <Zap className="h-3.5 w-3.5" />
            {player.level}
          </span>
        </div>
      </div>

      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-amber-500/70" style={{ width: `${xpPercent}%` }} />
      </div>
    </header>
  );
}
