import { Globe2, MapPin } from 'lucide-react';
import { OIL_GRADE_INFO } from '../data/worldPlots';
import { selectActivePlot, useGameStore } from '../store/gameStore';

interface Props {
  onOpenWorld?: () => void;
}

export function PlotHeader({ onOpenWorld }: Props) {
  const plot = useGameStore(selectActivePlot);
  const plotsCount = useGameStore((s) => s.plots.length);
  const grade = OIL_GRADE_INFO[plot.oilGrade ?? 'urals'];

  return (
    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-sm text-slate-300">
        <span className="text-base">{plot.emoji ?? '⛽'}</span>
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{plot.name}</span>
          {plot.region && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <MapPin className="h-2.5 w-2.5" />
              {plot.region} · <span style={{ color: grade.color }}>{grade.name}</span>
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenWorld}
        className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
      >
        <Globe2 className="h-3.5 w-3.5" />
        Мир ({plotsCount})
      </button>
    </div>
  );
}
