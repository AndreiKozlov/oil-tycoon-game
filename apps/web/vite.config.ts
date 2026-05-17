import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path должен совпадать с location в nginx (/game/).
// Vite слушает только 127.0.0.1 — наружу торчит nginx.
export default defineConfig({
  base: '/game/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // nginx подставляет Host: 147.45.220.59 — Vite иначе блокирует.
    allowedHosts: ['147.45.220.59', 'localhost'],
    hmr: {
      // HMR пробрасывается через nginx → клиент должен стучаться на тот же хост/порт 80.
      host: '147.45.220.59',
      protocol: 'ws',
      clientPort: 80,
      path: '/game/',
    },
  },
});
