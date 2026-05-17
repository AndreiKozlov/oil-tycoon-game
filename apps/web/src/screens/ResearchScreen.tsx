import { useEffect, useState } from 'react';
import { CheckCircle2, FlaskConical, Lock } from 'lucide-react';
import { TECHNOLOGIES, type Technology } from '../data/technologies';
import { useGameStore } from '../store/gameStore';
import { formatMoney } from '../lib/format';
import { haptic } from '../lib/telegram';

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}с`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h}ч ${mm}м` : `${h}ч`;
}

function effectsHint(tech: Technology): string[] {
  const out: string[] = [];
  const e = tech.effects;
  if (e.reserveMult) out.push(`+${Math.round((e.reserveMult - 1) * 100)}% запасы`);
  if (e.extractionMult) out.push(`+${Math.round((e.extractionMult - 1) * 100)}% добыча`);
  if (e.tankCapacityMult) out.push(`+${Math.round((e.tankCapacityMult - 1) * 100)}% ёмкость`);
  if (e.powerDrawMult && e.powerDrawMult < 1)
    out.push(`−${Math.round((1 - e.powerDrawMult) * 100)}% энергопотребление`);
  return out;
}

interface CardProps {
  tech: Technology;
}

function ResearchCard({ tech }: CardProps) {
  const research = useGameStore((s) => s.research);
  const money = useGameStore((s) => s.player.money);
  const startResearch = useGameStore((s) => s.startResearch);

  const completed = research.completed.includes(tech.id);
  const inProgress = research.inProgress?.techId === tech.id;
  const someoneElseInProgress = research.inProgress !== null && !inProgress;
  const prereqsMet = tech.prereqIds.every((p) => research.completed.includes(p));
  const canAfford = money >= tech.costMoney;
  const canStart = !completed && !inProgress && !someoneElseInProgress && prereqsMet && canAfford;

  // Live прогресс — пересчитываем каждую секунду тиком стора (можно отдельный rAF,
  // но текущий tick достаточен — он бьёт каждую секунду и обновляет research).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, [inProgress]);

  let progress = 0;
  let remainingSec = 0;
  if (inProgress && research.inProgress) {
    const elapsed = (Date.now() - research.inProgress.startedAt) / 1000;
    progress = Math.min(100, (elapsed / tech.durationSec) * 100);
    remainingSec = Math.max(0, Math.ceil(tech.durationSec - elapsed));
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        completed
          ? 'border-emerald-700/60 bg-emerald-900/20'
          : inProgress
            ? 'border-amber-600 bg-amber-900/20'
            : !prereqsMet
              ? 'border-slate-800 bg-slate-900/50 opacity-60'
              : 'border-slate-700 bg-slate-900/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            completed
              ? 'bg-emerald-900/40 text-emerald-300'
              : !prereqsMet
                ? 'bg-slate-800 text-slate-600'
                : 'bg-amber-900/30 text-amber-300'
          }`}
        >
          {completed ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : !prereqsMet ? (
            <Lock className="h-5 w-5" />
          ) : (
            <FlaskConical className="h-5 w-5" />
          )}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{tech.name}</h3>
            {!completed && (
              <span className="font-mono text-xs text-emerald-400">
                {formatMoney(tech.costMoney)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{tech.description}</p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {effectsHint(tech).map((e, i) => (
              <span
                key={i}
                className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300"
              >
                {e}
              </span>
            ))}
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-500">
              ⏱ {formatDuration(tech.durationSec)}
            </span>
          </div>

          {!prereqsMet && tech.prereqIds.length > 0 && (
            <p className="mt-1.5 text-[11px] text-rose-400">
              Требуется:{' '}
              {tech.prereqIds
                .map((p) => TECHNOLOGIES.find((t) => t.id === p)?.name ?? p)
                .join(', ')}
            </p>
          )}
        </div>
      </div>

      {inProgress && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-amber-400">Идёт исследование…</span>
            <span className="font-mono text-slate-400">{formatDuration(remainingSec)} осталось</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!completed && !inProgress && (
        <button
          type="button"
          disabled={!canStart}
          onClick={() => {
            if (startResearch(tech.id)) haptic('medium');
          }}
          className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
            canStart
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          }`}
        >
          {!prereqsMet
            ? 'Заблокировано'
            : someoneElseInProgress
              ? 'Уже идёт другое исследование'
              : !canAfford
                ? `Не хватает ${formatMoney(tech.costMoney - money)}`
                : 'Начать исследование'}
        </button>
      )}
    </div>
  );
}

export function ResearchScreen() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-900/60 px-3 py-2">
        <h2 className="text-sm font-semibold">Технологии</h2>
        <p className="text-[11px] text-slate-500">
          Исследования постоянно улучшают добычу. Одновременно — только одно.
        </p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {TECHNOLOGIES.map((tech) => (
          <ResearchCard key={tech.id} tech={tech} />
        ))}
      </div>
    </div>
  );
}
