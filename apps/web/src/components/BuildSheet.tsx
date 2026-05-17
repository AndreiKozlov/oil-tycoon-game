import { Battery, Droplet, Gauge, Hammer, X, type LucideIcon } from 'lucide-react';
import type { BuildingType } from '../data/mockData';
import { buildCost, selectActivePlot, useGameStore } from '../store/gameStore';
import { formatMoney } from '../lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPES: { type: BuildingType; label: string; hint: string; icon: LucideIcon }[] = [
  { type: 'derrick', label: 'Вышка', hint: '+50 бар/час (ур.1)', icon: Hammer },
  { type: 'well', label: 'Скважина', hint: '+30 бар/час (ур.1)', icon: Droplet },
  { type: 'tank', label: 'Резервуар', hint: '+500 бар ёмкости', icon: Gauge },
  { type: 'generator', label: 'ДГУ', hint: '+30 кВт мощности', icon: Battery },
];

export function BuildSheet({ open, onClose }: Props) {
  const plot = useGameStore(selectActivePlot);
  const buildings = plot.buildings;
  const maxSlots = plot.maxSlots;
  const money = useGameStore((s) => s.player.money);
  const buildBuilding = useGameStore((s) => s.buildBuilding);

  if (!open) return null;

  const slotsUsed = buildings.length;
  const slotsLeft = maxSlots - slotsUsed;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl border-t border-slate-700 bg-slate-900 p-5 shadow-2xl sm:max-w-sm sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Построить</h2>
            <p className="text-xs text-slate-400">
              Слотов:{' '}
              <span className={slotsLeft === 0 ? 'text-rose-400' : 'text-slate-200'}>
                {slotsUsed}/{maxSlots}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {TYPES.map(({ type, label, hint, icon: Icon }) => {
            const existing = buildings.filter((b) => b.type === type).length;
            const cost = buildCost(type, existing);
            const canBuild = slotsLeft > 0 && money >= cost;

            return (
              <button
                key={type}
                type="button"
                disabled={!canBuild}
                onClick={() => {
                  if (buildBuilding(type)) onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  canBuild
                    ? 'border-slate-700 bg-slate-800/50 hover:border-amber-700 hover:bg-amber-900/20'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    canBuild ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {label}{' '}
                      {existing > 0 && (
                        <span className="text-xs text-slate-500">(уже {existing})</span>
                      )}
                    </span>
                    <span
                      className={`font-mono text-sm ${
                        canBuild ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    >
                      {formatMoney(cost)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{hint}</p>
                </div>
              </button>
            );
          })}
        </div>

        {slotsLeft === 0 && (
          <p className="mt-3 text-center text-xs text-rose-400">
            Слоты заняты. Прокачай HQ чтобы получить больше места.
          </p>
        )}
      </div>
    </div>
  );
}
