import { useEffect } from 'react';
import { hideMainButton, updateMainButton } from './telegram';

// Управление Telegram MainButton декларативно: пока хук смонтирован,
// кнопка отражает переданные опции. После размонтирования — скрывается.
export function useTelegramMainButton(opts: { text: string; visible: boolean; onClick: () => void }): void {
  useEffect(() => {
    if (!opts.visible) {
      hideMainButton();
      return;
    }
    updateMainButton(opts);
    return () => hideMainButton();
    // Намеренно не подписываемся на onClick в депсе — пересоздавать кнопку
    // каждый рендер слишком дорого. Текст и видимость обновляются нормально.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.text, opts.visible]);
}
