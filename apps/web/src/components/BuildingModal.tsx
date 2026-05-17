import { ArrowUp, Battery, Droplet, Hammer, X, type LucideIcon } from 'lucide-react';
import type { Building } from '../data/mockData';
import { formatMoney } from '../lib/format';
import { selectActivePlot, upgradeCost, useGameStore } from '../store/gameStore';

interface Props {
  buildingId: string | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<Building['type'], string> = {
  derrick: 'Вышка',
  well: 'Скважина',
  tank: 'Резервуар',
  generator: 'ДГУ',
};

const TYPE_ICON: Record<Building['type'], LucideIcon> = {
  derrick: Hammer,
  well: Droplet,
  tank: Droplet,
  generator: Battery,
};

const STATUS_LABEL: Record<Building['status'], { text: string; color: string }> = {
  ok: { text: 'Работает', color: 'text-emerald-400' },
  needs_repair: { text: 'Нужен ремонт', color: 'text-rose-400' },
  full: { text: 'Заполнен', color: 'text-amber-400' },
  building: { text: 'Строится', color: 'text-slate-400' },
};

export function BuildingModal({ buildingId, onClose }: Props) {
  const plot = useGameStore(selectActivePlot);
  const building = buildingId ? plot.buildings.find((b) => b.id === buildingId) ?? null : null;
  const money = useGameStore((s) => s.player.money);
  const upgrade = useGameStore((s) => s.upgradeBuilding);

  if (!building) return null;

  const cost = upgradeCost(building);
  const canAfford = money >= cost;
  const Icon = TYPE_ICON[building.type];
  const status = STATUS_LABEL[building.status];

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
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-900/30">
              <Icon className="h-6 w-6 text-amber-400" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{TYPE_LABEL[building.type]}</h2>
              <p className="text-xs text-slate-400">Уровень {building.level}</p>
            </div>
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

        <div className="mb-4 space-y-2 rounded-lg bg-slate-800/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Статус</span>
            <span className={`font-medium ${status.color}`}>{status.text}</span>
          </div>
          {building.fillPercent !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">Заполнен</span>
              <span className="font-mono text-slate-200">{building.fillPercent}%</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Бонус к добыче</span>
            <span className="font-mono text-emerald-400">+20% за уровень</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!canAfford}
          onClick={() => {
            if (upgrade(building.id)) onClose();
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            canAfford
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          }`}
        >
          <ArrowUp className="h-4 w-4" />
          Улучшить до ур. {building.level + 1}
          <span className="ml-1 font-mono">{formatMoney(cost)}</span>
        </button>

        {!canAfford && (
          <p className="mt-2 text-center text-xs text-rose-400">
            Не хватает {formatMoney(cost - money)}
          </p>
        )}
      </div>
    </div>
  );
}
