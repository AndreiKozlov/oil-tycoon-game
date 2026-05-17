import { GameShell } from './screens/GameShell';

// Mobile-first контейнер: 420×844 на десктопе («телефон»), fullscreen на телефоне.
export function App() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-slate-950 sm:p-4">
      <div className="relative flex h-screen w-full max-w-[420px] flex-col overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl sm:h-[844px] sm:rounded-3xl">
        <GameShell />
      </div>
    </div>
  );
}
