import { X } from 'lucide-react';
import type { ReactNode } from 'react';

// Правая контекстная панель. Открывается когда игрок выбрал что-то на карте
// или в центральном экране — туда подгружаются детали + действия.
// В landscape всегда видна (~280px), в narrow можно свернуть.

interface Props {
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  emptyHint?: string;
}

export function RightPanel({ title, onClose, children, emptyHint }: Props) {
  const empty = !children;
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900/60 backdrop-blur">
      {(title || onClose) && (
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-sm font-semibold">{title ?? ''}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-500">
            {emptyHint ?? 'Выбери постройку или тайл — здесь появятся детали.'}
          </div>
        ) : (
          children
        )}
      </div>
    </aside>
  );
}
