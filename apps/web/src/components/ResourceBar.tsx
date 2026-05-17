import { selectActivePlot, useGameStore } from '../store/gameStore';
import { plotTankCapacity, plotPowerProduced, plotPowerDraw } from '../lib/gameFormulas';
import { formatBarrels } from '../lib/format';

// Нижняя полоса с ресурсами текущего активного участка. На v2 расширим под
// все ресурсы игрока (лес/камень/...), пока показываем нефть/энергию из v1.
export function ResourceBar() {
  const plot = useGameStore(selectActivePlot);
  const capacity = plotTankCapacity(plot);
  const produced = plotPowerProduced(plot);
  const draw = plotPowerDraw(plot);

  const Chip = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <span
      className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs"
      title={label}
    >
      <span className="text-sm">{icon}</span>
      <span className="font-mono text-slate-200">{value}</span>
      <span className="hidden text-slate-500 sm:inline">{label}</span>
    </span>
  );

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-slate-800 bg-slate-900/80 px-3 py-1.5 backdrop-blur">
      <Chip
        icon="🛢"
        label="нефть в баке"
        value={`${formatBarrels(plot.tankFill)} / ${formatBarrels(capacity)}`}
      />
      <Chip icon="⚡" label="энергия" value={`${produced}/${draw} кВт`} />
      {/* TODO G.6: добавить chips для леса/камня/руды/еды/газа/электричества */}
      <span className="ml-auto whitespace-nowrap text-[10px] text-slate-500">
        v2-прототип · ресурсы по {plot.name}
      </span>
    </div>
  );
}
