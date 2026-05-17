import { ChevronDown, MapPin } from 'lucide-react';

interface Props {
  plotName: string;
  onSwitchPlot?: () => void;
}

export function PlotHeader({ plotName, onSwitchPlot }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-sm text-slate-300">
        <MapPin className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{plotName}</span>
      </div>
      <button
        type="button"
        onClick={onSwitchPlot}
        className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
      >
        Сменить
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
