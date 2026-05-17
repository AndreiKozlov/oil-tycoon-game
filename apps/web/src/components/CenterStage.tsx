import type { Building } from '../data/mockData';

interface Props {
  buildings: Building[];
  onSelect?: (id: string) => void;
}

// Позиции hit-зон совпадают с координатами SVG-форм построек.
// Порядок: derrick → well → tank → generator (как в mockData).
const HIT_ZONES: { cx: number; cy: number; r: number }[] = [
  { cx: 155, cy: 145, r: 30 }, // derrick (вышка)
  { cx: 242, cy: 185, r: 22 }, // well
  { cx: 109, cy: 192, r: 22 }, // tank
  { cx: 276, cy: 212, r: 18 }, // generator
];

// SVG-заглушка изометрии: земля + вышка/скважина/резервуар/ДГУ как простые формы.
// На этапе C заменим на Pixi.js сцену с настоящими спрайтами.
export function CenterStage({ buildings, onSelect }: Props) {
  return (
    <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      <svg
        viewBox="0 0 400 300"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f3a2c" />
            <stop offset="100%" stopColor="#1c1a14" />
          </linearGradient>
          <pattern
            id="grid"
            x="0"
            y="0"
            width="20"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="skewX(-30)"
          >
            <path d="M 0 0 L 20 0 M 0 10 L 20 10" stroke="#5c533b" strokeWidth="0.4" />
          </pattern>
        </defs>

        <polygon points="200,90 360,180 200,270 40,180" fill="url(#ground)" />
        <polygon points="200,90 360,180 200,270 40,180" fill="url(#grid)" opacity="0.4" />

        {/* Вышка */}
        <g transform="translate(140, 130)">
          <polygon points="0,40 30,40 25,0 5,0" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="5" y1="0" x2="25" y2="40" stroke="#f59e0b" strokeWidth="0.8" />
          <line x1="25" y1="0" x2="5" y2="40" stroke="#f59e0b" strokeWidth="0.8" />
          <line x1="15" y1="-15" x2="15" y2="0" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="15" cy="-18" r="2" fill="#f59e0b" />
        </g>

        {/* Скважина */}
        <g transform="translate(230, 175)">
          <rect x="0" y="20" width="24" height="6" fill="#475569" />
          <rect x="6" y="8" width="12" height="14" fill="#64748b" />
          <line x1="0" y1="14" x2="20" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
        </g>

        {/* Резервуар */}
        <g transform="translate(95, 175)">
          <ellipse cx="14" cy="6" rx="14" ry="4" fill="#1e293b" />
          <rect x="0" y="6" width="28" height="22" fill="#334155" />
          <rect x="0" y="22" width="28" height="6" fill="#0ea5e9" opacity="0.6" />
          <ellipse cx="14" cy="28" rx="14" ry="4" fill="#0ea5e9" opacity="0.4" />
        </g>

        {/* ДГУ */}
        <g transform="translate(265, 205)">
          <rect x="0" y="0" width="22" height="14" fill="#7f1d1d" />
          <rect x="3" y="3" width="4" height="4" fill="#fef3c7" opacity="0.8" />
          <rect x="9" y="3" width="4" height="4" fill="#fef3c7" opacity="0.8" />
        </g>

        {/* Статус-точки */}
        {buildings.map((b, i) => {
          const x = [155, 242, 109, 276][i] ?? 200;
          const y = [110, 165, 165, 195][i] ?? 90;
          const color =
            b.status === 'ok'
              ? '#10b981'
              : b.status === 'needs_repair'
                ? '#ef4444'
                : b.status === 'full'
                  ? '#eab308'
                  : '#94a3b8';
          return <circle key={`s-${b.id}`} cx={x} cy={y} r="3" fill={color} />;
        })}

        {/* Кликабельные hit-зоны (прозрачные круги поверх построек) */}
        {buildings.map((b, i) => {
          const zone = HIT_ZONES[i];
          if (!zone) return null;
          return (
            <circle
              key={`hit-${b.id}`}
              cx={zone.cx}
              cy={zone.cy}
              r={zone.r}
              fill="transparent"
              className="cursor-pointer transition hover:fill-amber-400/10"
              onClick={() => onSelect?.(b.id)}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-900/70 px-2 py-1 text-[10px] text-slate-500">
        Тапни постройку — увидишь её состояние
      </div>
    </div>
  );
}
