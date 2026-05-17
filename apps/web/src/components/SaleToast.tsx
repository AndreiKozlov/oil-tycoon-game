import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../lib/format';

interface Props {
  amount: number | null;
  onDone: () => void;
}

// Простой тост-баннер: всплывает на 2 секунды после продажи, без зависимостей.
export function SaleToast({ amount, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (amount === null) return;
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDone, 200);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [amount, onDone]);

  if (amount === null) return null;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div className="flex items-center gap-2 rounded-full border border-emerald-600/50 bg-emerald-900/90 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-2xl backdrop-blur">
        <CheckCircle2 className="h-4 w-4" />
        Продано на {formatMoney(amount)}
      </div>
    </div>
  );
}
