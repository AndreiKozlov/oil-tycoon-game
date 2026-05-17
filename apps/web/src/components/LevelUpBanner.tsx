import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

// Полноэкранная плашка при повышении уровня. Видна 2 секунды, потом
// плавно исчезает. Подписывается на pendingLevelUp в сторе.
export function LevelUpBanner() {
  const level = useGameStore((s) => s.pendingLevelUp);
  const acknowledge = useGameStore((s) => s.acknowledgeLevelUp);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (level === null) return;
    setVisible(true);
    const fadeAt = window.setTimeout(() => setVisible(false), 1800);
    const ackAt = window.setTimeout(acknowledge, 2200);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(ackAt);
    };
  }, [level, acknowledge]);

  if (level === null) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-amber-900/30 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-3 rounded-3xl border border-amber-400/50 bg-slate-900/90 px-10 py-8 shadow-2xl">
        <Sparkles className="h-10 w-10 text-amber-400" />
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-amber-400/80">Новый уровень</p>
          <p className="font-mono text-4xl font-bold text-amber-300">{level}</p>
        </div>
      </div>
    </div>
  );
}
