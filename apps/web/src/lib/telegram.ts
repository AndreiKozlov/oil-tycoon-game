// Тонкая обёртка над Telegram WebApp SDK. Безопасна для обычного браузера —
// если SDK не подгрузился или Telegram нет, все функции — no-op.
//
// Подробности: https://core.telegram.org/bots/webapps
import WebApp from '@twa-dev/sdk';

// SDK всегда экспортирует объект, даже вне Telegram — но многие методы там
// фактически no-op, а свойства (initData, themeParams) пустые.
// Чтобы безопасно проверить «реально ли мы в Telegram» — смотрим platform
// и наличие initData.
export function isTelegramEnvironment(): boolean {
  try {
    // 'unknown' = открыто в обычном браузере (а не в Telegram in-app)
    return WebApp.platform !== 'unknown';
  } catch {
    return false;
  }
}

export function initTelegram(): void {
  if (!isTelegramEnvironment()) return;
  try {
    WebApp.ready();
    WebApp.expand();
    // Разрешаем закрывать только при подтверждении (на случай если игрок
    // тапнул системный «назад» во время продажи). Никаких сюрпризов.
    WebApp.enableClosingConfirmation();
  } catch (e) {
    console.warn('Telegram WebApp init failed:', e);
  }
}

export function getTelegramUserFirstName(): string | null {
  if (!isTelegramEnvironment()) return null;
  try {
    const user = WebApp.initDataUnsafe?.user;
    return user?.first_name ?? null;
  } catch {
    return null;
  }
}

// MainButton: нативная Telegram-кнопка снизу экрана. Используем для самого
// частого действия «Продать нефть» — её удобно нажимать в Telegram, не
// целясь в маленькую кнопку в QuickActions.
export interface MainButtonOptions {
  text: string;
  visible: boolean;
  onClick: () => void;
}

let currentHandler: (() => void) | null = null;

export function updateMainButton(opts: MainButtonOptions): void {
  if (!isTelegramEnvironment()) return;
  try {
    const btn = WebApp.MainButton;
    btn.setText(opts.text);
    if (opts.visible) {
      btn.show();
    } else {
      btn.hide();
    }
    // Telegram сохраняет только один обработчик за раз — переподключаем.
    if (currentHandler) btn.offClick(currentHandler);
    currentHandler = opts.onClick;
    btn.onClick(currentHandler);
  } catch (e) {
    console.warn('Telegram MainButton update failed:', e);
  }
}

export function hideMainButton(): void {
  if (!isTelegramEnvironment()) return;
  try {
    if (currentHandler) WebApp.MainButton.offClick(currentHandler);
    currentHandler = null;
    WebApp.MainButton.hide();
  } catch {
    /* ignore */
  }
}

// Лёгкий хаптик-фидбек на тапы — приятно на телефоне.
export function haptic(type: 'success' | 'warning' | 'error' | 'medium'): void {
  if (!isTelegramEnvironment()) return;
  try {
    if (type === 'success' || type === 'warning' || type === 'error') {
      WebApp.HapticFeedback.notificationOccurred(type);
    } else {
      WebApp.HapticFeedback.impactOccurred(type);
    }
  } catch {
    /* ignore */
  }
}
