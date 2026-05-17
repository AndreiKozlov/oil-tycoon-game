import { Droplet } from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '@oil-tycoon/shared';
import { engineGreeting } from '@oil-tycoon/game-engine';

export function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <Droplet className="h-16 w-16 text-oil-accent" strokeWidth={1.5} />
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{GAME_NAME}</h1>
      <p className="max-w-md text-base text-slate-400">
        Симулятор добычи нефти и газа. Прототип v{GAME_VERSION}.
      </p>
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-500">
        {engineGreeting()}
      </div>
    </main>
  );
}
