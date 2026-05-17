import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { getTechById } from '../data/technologies';
import { useGameStore } from '../store/gameStore';

// Всплывающий баннер «Технология готова».
export function ResearchDoneToast() {
  const techId = useGameStore((s) => s.pendingResearchDone);
  const ack = useGameStore((s) => s.acknowledgeResearchDone);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!techId) return;
    setVisible(true);
    const t1 = window.setTimeout(() => setVisible(false), 2400);
    const t2 = window.setTimeout(ack, 2800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [techId, ack]);

  if (!techId) return null;
  const tech = getTechById(techId);
  if (!tech) return null;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div className="flex max-w-xs items-center gap-2 rounded-2xl border border-amber-600/50 bg-amber-900/90 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-2xl backdrop-blur">
        <FlaskConical className="h-5 w-5 shrink-0" />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-amber-300/80">Исследование готово</p>
          <p className="leading-tight">{tech.name}</p>
        </div>
      </div>
    </div>
  );
}
