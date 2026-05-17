// PM2 конфиг для авто-старта dev-сервера Oil Tycoon после ребута.
// Запуск:   pm2 start ecosystem.config.cjs
// Сохранить: pm2 save     (закрепить в systemd snapshot)
// Логи:     pm2 logs oil-tycoon-web
// Остановить: pm2 stop oil-tycoon-web
//
// На этом сервере уже крутится tradearena (17 приложений в pm2). Мы добавляем
// 18-е под именем oil-tycoon-web — пересечений по имени быть не должно.

module.exports = {
  apps: [
    {
      name: 'oil-tycoon-web',
      cwd: '/root/oil_tycoon_project/oil-tycoon-game',
      script: 'pnpm',
      args: '--filter @oil-tycoon/web dev',
      interpreter: 'none', // pnpm — это shell-скрипт, node-интерпретатор не нужен.
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Vite слушает только 127.0.0.1:5173 — снаружи приходит через nginx /game/.
      env: {
        NODE_ENV: 'development',
      },
      out_file: '/var/log/oil-tycoon/web-out.log',
      error_file: '/var/log/oil-tycoon/web-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
