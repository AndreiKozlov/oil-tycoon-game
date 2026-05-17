import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Доступы:
//   http://147.45.220.59/game/                       — через nginx → Vite (dev на сервере)
//   https://*.trycloudflare.com/game/                — через Cloudflare Tunnel (Telegram)
// Vite слушает только 127.0.0.1 — наружу его пробрасывают nginx/cloudflared.
//
// HMR-конфиг подобран под HTTP-доступ (147.45.220.59). Через Cloudflare-туннель
// HMR не работает (websockets на trycloudflare не настроены автоматически) —
// это ок, обновляем страницу руками при тесте в Telegram.
export default defineConfig({
  base: '/game/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Разрешаем заголовок Host от nginx, локалки и любого поддомена Cloudflare
    // Quick Tunnel. Vite ≥5 поддерживает leading-dot wildcard.
    allowedHosts: ['147.45.220.59', 'localhost', '.trycloudflare.com'],
    hmr: {
      host: '147.45.220.59',
      protocol: 'ws',
      clientPort: 80,
      path: '/game/',
    },
  },
});
