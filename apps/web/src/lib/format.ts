// Форматтеры чисел: $1.2M, 250 💎, 78%. Без зависимостей.

export function formatMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
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
