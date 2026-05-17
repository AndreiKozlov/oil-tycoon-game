# Oil Tycoon

Симулятор-стратегия добычи нефти и газа. Telegram Mini App + Web → iOS/Android.

## Документация

Вся проектная документация — в [`docs/`](./docs/):

- [`START_HERE.md`](./docs/START_HERE.md) — общий контекст, навигатор для нового LLM-ассистента.
- [`PROGRESS_LOG.md`](./docs/PROGRESS_LOG.md) — журнал прогресса, **главный файл для восстановления контекста**.
- [`DECISIONS.md`](./docs/DECISIONS.md) — принятые решения, которые не переоткрываем.
- [`CHANGE_REQUESTS.md`](./docs/CHANGE_REQUESTS.md) — копилка мелких правок UX/UI.
- [`oil_game_gdd.md`](./docs/oil_game_gdd.md) — Game Design Document (~30k слов).
- [`oil_game_balance.md`](./docs/oil_game_balance.md), [`oil_game_architecture.md`](./docs/oil_game_architecture.md), [`oil_game_tech_stack.md`](./docs/oil_game_tech_stack.md), [`oil_game_roadmap.md`](./docs/oil_game_roadmap.md), [`oil_game_stage1_tasks.md`](./docs/oil_game_stage1_tasks.md) — детальные планы по разделам.

## Структура

```
apps/web              фронтенд игры (React 18 + Vite + Tailwind + Pixi.js позже)
apps/api              бэкенд (Fastify + Postgres + Redis) — этап 2
packages/shared       общие типы и константы
packages/game-engine  чистая игровая логика (без DOM/Node)
docs/                 проектная документация
ecosystem.config.cjs  pm2 конфиг для авто-старта Vite + Cloudflare Tunnel
```

## Запуск (dev на сервере)

```bash
pnpm install
pnpm --filter @oil-tycoon/web dev    # Vite на 127.0.0.1:5173
```

В прод-схеме сервера используется pm2 (см. `ecosystem.config.cjs`), nginx
проксирует `/game/` → Vite, Cloudflare Tunnel даёт HTTPS-доступ для Telegram.
