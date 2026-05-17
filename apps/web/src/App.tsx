import { useEffect, useState } from 'react';
import { GameShell } from './screens/GameShell';

// Landscape-first: игра растягивается на весь экран. На узком portrait-экране
// (телефон) показываем приглашение перевернуть устройство. На очень узких
// landscape (старый телефон, ~480px ширина) сворачиваем боковые панели.
//
// Минимально комфортная ширина: 800px. На меньшей — карту видно плохо.

const MIN_LANDSCAPE_WIDTH = 600;

export function App() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const isPortrait = size.h > size.w;
  const tooNarrow = size.w < MIN_LANDSCAPE_WIDTH;
  const shouldNudgeRotate = isPortrait && tooNarrow;

  if (shouldNudgeRotate) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center text-slate-200">
        <div className="text-5xl">📱➡️</div>
        <h1 className="text-xl font-semibold">Поверни телефон</h1>
        <p className="text-sm text-slate-400">
          Игра играется в горизонтальном (ландшафтном) режиме. Поверни устройство —
          интерфейс сам подстроится.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <GameShell />
    </div>
  );
}
