// Хук, который тикает стор каждую секунду. Использует setInterval, но
// фактическую дельту считает по Date.now() — устойчиво к тормозам вкладки
// в фоне (когда таб не активен, браузер пропускает интервалы).
import { useEffect } from 'react';
import { useGameStore } from './gameStore';

const TICK_MS = 1000;

export function useGameTick(): void {
  useEffect(() => {
    let lastAt = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - lastAt) / 1000;
      lastAt = now;
      useGameStore.getState().tick(deltaSec);
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);
}
