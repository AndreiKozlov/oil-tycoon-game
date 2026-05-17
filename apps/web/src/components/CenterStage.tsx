import type { Building } from '../data/mockData';
import { useGameStore } from '../store/gameStore';

interface Props {
  buildings: Building[];
  onSelect?: (id: string) => void;
}

const HIT_ZONES: { cx: number; cy: number; r: number }[] = [
  { cx: 155, cy: 145, r: 30 }, // derrick
  { cx: 242, cy: 185, r: 22 }, // well
  { cx: 109, cy: 192, r: 22 }, // tank
  { cx: 276, cy: 212, r: 18 }, // generator
];

// SVG-сцена участка. Минимальная анимация средствами SMIL + CSS keyframes:
// - балансир скважины качается
// - индикатор работы пульсирует когда добыча активна
// - жидкость в резервуаре растёт согласно tankFill/tankCapacity
// Заменим на Pixi.js с настоящими спрайтами на этапе D.
export function CenterStage({ buildings, onSelect }: Props) {
  const tankFill = useGameStore((s) => s.plot.tankFill);
  const tankCapacity = useGameStore((s) => s.plot.tankCapacity);
  const extracting = useGameStore(
    (s) => s.plot.extractionRatePerHour > 0 && s.plot.tankFill < s.plot.tankCapacity,
  );

  const tankPercent = Math.max(0, Math.min(1, tankFill / tankCapacity));
  // Геометрия резервуара (в координатах SVG, см. ниже).
  const TANK_TOP = 6;
  const TANK_BOTTOM = 28;
  const tankFluidTop = TANK_TOP + (TANK_BOTTOM - TANK_TOP) * (1 - tankPercent);
  const tankFluidH = TANK_BOTTOM - tankFluidTop;

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

        {/* Вышка — статичный каркас, наверху огонёк */}
        <g transform="translate(140, 130)">
          <polygon points="0,40 30,40 25,0 5,0" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="5" y1="0" x2="25" y2="40" stroke="#f59e0b" strokeWidth="0.8" />
          <line x1="25" y1="0" x2="5" y2="40" stroke="#f59e0b" strokeWidth="0.8" />
          <line x1="15" y1="-15" x2="15" y2="0" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="15" cy="-18" r="2" fill="#f59e0b">
            {extracting && (
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur="1.4s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        </g>

        {/* Скважина — корпус + балансир, который качается когда идёт добыча */}
        <g transform="translate(230, 175)">
          <rect x="0" y="20" width="24" height="6" fill="#475569" />
          <rect x="6" y="8" width="12" height="14" fill="#64748b" />
          {/* Балансир: пивот в (10, 14). transform-origin для SVG задаём через атрибут. */}
          <g style={{ transformOrigin: '10px 14px' }} className={extracting ? 'pumpjack' : ''}>
            <line x1="0" y1="14" x2="20" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
          </g>
        </g>

        {/* Резервуар — растущая жидкость */}
        <g transform="translate(95, 175)">
          {/* Корпус */}
          <ellipse cx="14" cy="6" rx="14" ry="4" fill="#1e293b" />
          <rect x="0" y="6" width="28" height="22" fill="#334155" />

          {/* Жидкость внутри (анимируется height/y по tankFill) */}
          <rect
            x="0"
            y={tankFluidTop}
            width="28"
            height={tankFluidH}
            fill={tankPercent >= 1 ? '#f43f5e' : '#0ea5e9'}
            opacity="0.7"
            style={{ transition: 'y 0.6s linear, height 0.6s linear' }}
          />
          {tankFluidH > 0 && (
            <ellipse
              cx="14"
              cy={tankFluidTop}
              rx="14"
              ry="1.5"
              fill={tankPercent >= 1 ? '#f43f5e' : '#0ea5e9'}
              opacity="0.9"
              style={{ transition: 'cy 0.6s linear' }}
            />
          )}
          {/* Верхняя кромка корпуса поверх жидкости */}
          <ellipse cx="14" cy="6" rx="14" ry="4" fill="none" stroke="#475569" strokeWidth="0.5" />
        </g>

        {/* ДГУ */}
        <g transform="translate(265, 205)">
          <rect x="0" y="0" width="22" height="14" fill="#7f1d1d" />
          <rect x="3" y="3" width="4" height="4" fill="#fef3c7" opacity="0.8">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </rect>
          <rect x="9" y="3" width="4" height="4" fill="#fef3c7" opacity="0.8">
            <animate
              attributeName="opacity"
              values="0.9;0.4;0.9"
              dur="2s"
              repeatCount="indefinite"
            />
          </rect>
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

        {/* Кликабельные hit-зоны */}
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
