// Форматтеры чисел: $1.2M, 250 💎, 78%. Без зависимостей.

// Краткий формат — для лимитированной ширины (полоса состояния, бейджи).
export function formatMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// Полное число с разделителями — для главного баланса в TopBar, чтобы
// игрок видел как ползут единицы каждую секунду.
const ruFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
export function formatMoneyFull(value: number): string {
  return `$${ruFormatter.format(Math.floor(value))}`;
}

export function formatBarrels(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value.toFixed(0)}`;
}

export function formatRate(perHour: number): string {
  const sign = perHour >= 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(perHour))}/час`;
}
