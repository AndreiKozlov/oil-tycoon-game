// Каталог технологий. Эффекты применяются как множители/добавки в
// gameFormulas.ts через объект ResearchEffects (см. store/gameStore.ts).
//
// Время исследования сейчас в реальных секундах. На этап F.3 (премиум) добавим
// возможность ускорять кристаллами.

export type TechId =
  | 'deeper_survey'
  | 'efficient_pumps'
  | 'big_tanks'
  | 'energy_saving'
  | 'deep_drilling';

export interface Technology {
  id: TechId;
  name: string;
  description: string;
  costMoney: number;
  durationSec: number;
  prereqIds: TechId[];
  // Эффекты — складываются от всех завершённых технологий.
  effects: TechEffects;
}

// Все возможные эффекты технологий. Применяются в gameFormulas через объект
// ResearchEffects. Default-значения = «без эффекта».
export interface TechEffects {
  reserveMult?: number;        // ×N к стартовым запасам новых участков
  extractionMult?: number;     // ×N к добыче (все вышки/скважины)
  tankCapacityMult?: number;   // ×N к ёмкости резервуаров
  powerDrawMult?: number;      // ×N к потреблению (меньше = лучше)
}

export const TECHNOLOGIES: Technology[] = [
  {
    id: 'deeper_survey',
    name: 'Углублённая разведка',
    description: 'Геологи находят на 20% больше нефти в новых участках.',
    costMoney: 100_000,
    durationSec: 120, // 2 минуты
    prereqIds: [],
    effects: { reserveMult: 1.2 },
  },
  {
    id: 'efficient_pumps',
    name: 'Эффективные насосы',
    description: 'Все вышки и скважины качают на 10% быстрее.',
    costMoney: 150_000,
    durationSec: 180,
    prereqIds: [],
    effects: { extractionMult: 1.1 },
  },
  {
    id: 'big_tanks',
    name: 'Большие цистерны',
    description: 'Резервуары вмещают на 50% больше нефти.',
    costMoney: 80_000,
    durationSec: 90,
    prereqIds: [],
    effects: { tankCapacityMult: 1.5 },
  },
  {
    id: 'energy_saving',
    name: 'Энергосбережение',
    description: 'Постройки потребляют на 20% меньше энергии.',
    costMoney: 120_000,
    durationSec: 150,
    prereqIds: [],
    effects: { powerDrawMult: 0.8 },
  },
  {
    id: 'deep_drilling',
    name: 'Глубокое бурение',
    description: 'Открывает доступ к следующему типу нефти. (Скоро)',
    costMoney: 500_000,
    durationSec: 600, // 10 минут — долгий перк, для long-session
    prereqIds: ['deeper_survey', 'efficient_pumps'],
    effects: { extractionMult: 1.25, reserveMult: 1.5 },
  },
];

export function getTechById(id: TechId): Technology | undefined {
  return TECHNOLOGIES.find((t) => t.id === id);
}
