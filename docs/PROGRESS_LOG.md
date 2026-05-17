# Oil Tycoon — Журнал прогресса

> Этот файл — **истина в последней инстанции** о том, что уже сделано в проекте.
> Каждый ассистент после `/clear` обязан:
> 1. Прочитать `START_HERE.md` (контекст и принятые решения)
> 2. Прочитать **этот файл** (что физически сделано на сервере)
> 3. Прочитать `DECISIONS.md` (ответы пользователя на вопросы)
> 4. Продолжить с последней незакрытой задачи
>
> Формат записи: дата + ID тикета + что сделано + следующий шаг.
> Дописывать **в конец**, не переписывать историю.

---

## 2026-05-17 — Старт этапа 1

### Принятые ответы пользователя на 4 вопроса (из START_HERE.md)

| # | Вопрос | Ответ |
|---|--------|-------|
| 1 | Время | Пользователь готов работать **фултайм** («всё своё время») |
| 2 | Где кодим | **На этом сервере** (`/root/oil_tycoon_project/`), потом перенесём на рабочую машину |
| 3 | Графика | Сейчас — **ассистент генерирует сам** (SVG, заглушки, CSS-арт). Midjourney подключаем перед продакшеном |
| 4 | Telegram BotFather | **Да**, пользователь готов создать тестового бота, когда дойдём до тикета E.2 |

Это значит:
- Темп — агрессивный, ориентир 3 недели до конца этапа 1.
- Весь код пишется в `/root/oil_tycoon_project/` (внутри родительской папки добавим `oil-tycoon-game/` под сам исходник, чтобы документация и код не мешались).
- Графика — никаких внешних подписок пока; SVG/CSS/эмодзи + одинаковая стилистика.

### Состояние инструментов на сервере (проверка перед A.1)

```
Node.js     v20.20.2          ✅ (LTS, годится)
npm         10.8.2            ✅
pnpm        — пытается ставить 11 через corepack, ломается (требует Node 22)
                              ⚠ нужно поставить pnpm 9 напрямую через npm i -g pnpm@9
PostgreSQL  16.13             ✅
Redis       7.0.15            ✅
Git         2.43.0            ✅
```

---

## 2026-05-17 — ✅ ФАЗА A полностью закрыта

### A.1 — окружение готово
- `/usr/bin/pnpm` был corepack-шимом (тащил pnpm 11, несовместимый с Node 20) — снёс симлинки `/usr/bin/pnpm` и `/usr/bin/pnpx`.
- Установил pnpm 9.15.9 через `npm i -g pnpm@9`.
- Все инструменты: Node 20.20.2 / pnpm 9.15.9 / Postgres 16.13 / Redis 7.0.15 / Git 2.43.0.

### A.2 — git-репозиторий
- Создал `/root/oil_tycoon_project/oil-tycoon-game/` — здесь живёт код. Документация — в родительской папке.
- `git init -b main`, ветка по умолчанию **main**.
- Локальный git-юзер: `Oil Tycoon Dev <dev@oil-tycoon.local>` (только локально, не глобально).
- `.gitignore` (Node + IDE + ОС + env), `README.md` (одна строка).
- Добавил `/root/oil_tycoon_project/oil-tycoon-game` в `safe.directory` глобально.
- Первый коммит: `593ce3c` `chore: initial commit (empty repo with gitignore + readme)`.
- **GitHub remote — отложен.** Нужен SSH-ключ от пользователя или его GitHub-аккаунт. Сделаем когда понадобится.

### A.3 — монорепо
Структура:
```
oil-tycoon-game/
├── package.json          (корневой, packageManager=pnpm@9.15.9)
├── pnpm-workspace.yaml   (apps/* + packages/*)
├── pnpm-lock.yaml
├── tsconfig.base.json    (strict, noUncheckedIndexedAccess, ES2022, Bundler)
├── .prettierrc.json / .prettierignore / .editorconfig / .npmrc
├── apps/
│   ├── web/    (@oil-tycoon/web, type:module, заглушки dev/build до B.1)
│   └── api/    (@oil-tycoon/api, заглушки до этапа 2)
└── packages/
    ├── shared/        (@oil-tycoon/shared, экспортирует GAME_NAME/GAME_VERSION)
    └── game-engine/   (@oil-tycoon/game-engine, зависит от shared через workspace:*)
```
Корневые скрипты: `build / dev / lint / format / typecheck / clean` — все идут через `pnpm -r`.

Установленные dev-deps на root: `typescript@5.9.3`, `eslint@9.39.4`, `prettier@3.8.3`, `rimraf@6.1.3`, `@types/node@20.19.41`.

`pnpm install` — OK. `pnpm -r typecheck` — OK (web/api пока заглушки, shared+game-engine реально проверяются).

Коммит A.3: `chore(A.3): bootstrap pnpm monorepo (web/api + shared/game-engine)`.

### Что важно знать следующему ассистенту
- **Не использовать corepack** — он принудительно тянет pnpm 11, не работающий на Node 20. Pnpm 9 ставится через `npm i -g pnpm@9`.
- Все `pnpm`-команды запускать **из** `/root/oil_tycoon_project/oil-tycoon-game/` (либо передавать `-C /root/oil_tycoon_project/oil-tycoon-game`).
- `composite + project references` я **намеренно убрал** в shared/game-engine — для прототипа это лишний build-step. Если когда-нибудь захотим публиковать пакеты — вернём.
- В web/api скрипт `typecheck` сейчас echo-заглушка, чтобы `pnpm -r typecheck` зеленел до B.1.

---

## 2026-05-17 — ФАЗА B стартовала

### B.1 — Vite + React 18 + TS + Tailwind в apps/web ✅

Положил руками (без `create vite`), стек:
- `vite@5`, `@vitejs/plugin-react@4`
- `react@18.3`, `react-dom@18.3`
- `tailwindcss@3.4`, `postcss`, `autoprefixer`
- `lucide-react` (иконки)
- workspace-импорты: `@oil-tycoon/shared`, `@oil-tycoon/game-engine`

Стартовая страница `apps/web/src/App.tsx`: иконка нефтекапли + заголовок «Oil Tycoon» + версия. Tailwind с тёмной темой по умолчанию, кастомные цвета `oil.accent/oil.dim`.

**Важное в `vite.config.ts`:**
- `base: '/game/'` — должно совпадать с location в nginx.
- `server.host: '127.0.0.1'` — Vite **не торчит наружу**, только через nginx.
- `server.strictPort: true` — не "уползёт" на 5174 если порт занят, упадёт явно.
- `server.allowedHosts: ['147.45.220.59', 'localhost']` — иначе Vite 5 блокирует Host-заголовок от nginx.
- `server.hmr` — `host: '147.45.220.59'`, `clientPort: 80`, `path: '/game/'`, `protocol: 'ws'`. Hot-reload в браузере работает через nginx.

`pnpm --filter @oil-tycoon/web dev` — Vite слушает на 127.0.0.1:5173 (запущен в фоне через ассистента, при ребуте сервера не стартанёт сам — пока не делаем PM2/systemd, это тикет E или раньше если задолбает).

### nginx — отдельный server-блок для /game/ ✅

Создал `/etc/nginx/sites-available/oil-tycoon-game` (+ симлинк в sites-enabled):
- `listen 80` (НЕ default_server — чтобы случайно не перехватить чужие домены).
- `server_name 147.45.220.59` — матчится **только при заходе по IP**.
- `location /game/` → `proxy_pass http://127.0.0.1:5173/game/` + WebSocket-апгрейды для HMR.
- `location = /` → text/plain «Open /game/ to play».
- Логи: `/var/log/nginx/oil-tycoon.{access,error}.log`.

`nginx -t` зелёный, `systemctl reload nginx`. **tradearena.tech не тронут** — он матчится по своему server_name (HTTPS 200 после reload подтверждено).

### Что доступно из браузера прямо сейчас

| URL | Что |
|-----|-----|
| `http://147.45.220.59/` | подсказка `Oil Tycoon dev. Open /game/ to play.` |
| `http://147.45.220.59/game/` | прототип игры (стартовая страница) |
| `https://tradearena.tech/` | без изменений, как и было |

### Безопасность ⚠️

- Пользователь прислал root-пароль в чате — попросил **немедленно** сменить через `passwd root`. Висит как открытый таск, пока он не подтвердит.
- В будущем заведём non-root юзера + SSH-ключи (этап 2 при настройке деплоя).

---

## 2026-05-17 — B.2 Каркас главного экрана ✅

Реализовал каркас «Экран 4 — Главный экран участка» из GDD (раздел 23, строки ~1635-1675). Mobile-first, контейнер 420px max-width, на десктопе — «телефон» с закруглёнными углами в центре.

### Структура файлов `apps/web/src/`

```
src/
├── App.tsx                       контейнер «телефона» (420×844 на десктопе)
├── main.tsx                      bootstrap
├── index.css                     tailwind
├── data/
│   └── mockData.ts               PlayerState, PlotState, Building + моки (Олег / Тюменская-3)
├── lib/
│   └── format.ts                 formatMoney, formatBarrels, formatRate ($1.2M / 234k бар)
├── screens/
│   └── PlotScreen.tsx            сборка экрана участка
└── components/
    ├── TopBar.tsx                юзер / $ / 💎 / уровень + XP-полоска
    ├── PlotHeader.tsx            название участка + «Сменить»
    ├── CenterStage.tsx           SVG-изометрия (вышка/скважина/резервуар/ДГУ + статус-точки)
    ├── StatusStrip.tsx           запасы / дни / $/час / кВт + прогресс-бар
    ├── QuickActions.tsx          [Магазин] [Продать] [Ремонт]
    └── BottomNav.tsx             5 вкладок (Участок/Мир/Биржа/Рейтинг/Опции), пока статичный state
```

### Принятые решения по UI

- **Mobile-first контейнер** 420×844 на десктопе, на телефоне — fullscreen. Раунд-углы + бордер только на десктопе (имитация рамки телефона).
- **Цветовая схема:** тёмная (slate-950 фон), оранжевый акцент `oil.accent = #f59e0b` (как нефть), деньги emerald, кристаллы sky, уровень/XP amber, ДГУ-расход rose.
- **SVG-изометрия — заглушка.** Земля как ромб, постройки как простые формы, статус-точки над ними. Когда дойдём до этапа C — заменим на Pixi.js со спрайтами. SVG достаточно, чтобы оценить пропорции.
- **Никакой логики**, только моки. Кнопки/таб/«Сменить» — без обработчиков (только локальный setState в BottomNav).

`pnpm --filter @oil-tycoon/web typecheck` — зелёный. Vite пересобрал HMR, страница на `http://147.45.220.59/game/` обновилась.

Коммит: `feat(B.2): main plot screen scaffold (...)`.

---

## 2026-05-17 — B.3 / B.4 / B.5 ✅ (Фаза B по сути закрыта)

Прошёл сразу три тикета одним проходом — они связаны логически (стор → действия → сохранение).

### B.3 — Zustand стор + tick каждую секунду

- Установил `zustand@5`.
- `src/store/gameStore.ts` — `useGameStore` с `player` + `plot` + `lastTickAt`.
- `src/store/useGameTick.ts` — хук, который через `setInterval(1000)` дёргает `tick(deltaSec)`. Δ считается по `Date.now()`, а не по фиксированной 1с — устойчиво к фоновым тикам (когда вкладка неактивна, браузер пропускает интервалы).
- **Константа `OIL_USD_PER_BARREL = 60`** — грубая цена нефти Brent. Используется чтобы пересчитать поток дохода ($/час) в расход баррелей (бар/час). Заменится биржевой логикой на этапе 2.
- Тик: `money += incomePerSec * Δ`, `reservesRemaining -= barrelsPerSec * Δ`, `daysRemaining` пересчитывается из остатков. Если запас иссяк → `incomePerHour = 0`.
- TopBar теперь показывает **полное число с разделителями** (`$1 234 567`) через `formatMoneyFull`, чтобы было видно тиканье. `formatMoney` (краткий `$1.2M`) остаётся для тесных мест.

### B.4 — Модалка постройки + апгрейд

- В `CenterStage` добавил прозрачные SVG hit-зоны (`<circle fill="transparent">`) над каждой постройкой → `onSelect(id)`.
- `BuildingModal.tsx` — нижний sheet (на десктопе — центральная карточка). Показывает иконку/тип/уровень/статус/процент заполнения + кнопку «Улучшить до ур. N» с ценой.
- `upgradeBuilding(id)` в сторе: списывает деньги, повышает level, **бустит `incomePerHour` на +20%**.
- Формула цены: `UPGRADE_BASE[type] * 1.5^level`. База: вышка 50k, скважина 30k, резервуар 20k, генератор 15k. Цена растёт по экспоненте → классический softcap.
- Если денег не хватает → кнопка disabled + подпись «Не хватает $X».

### B.5 — Сохранение прогресса в localStorage

- Через `zustand/middleware/persist` + `createJSONStorage(() => localStorage)`.
- Ключ хранилища: `oil-tycoon-save`. **Версия схемы: 1** — при будущей миграции будет писать `version` и применять migrate-функцию.
- `partialize` сохраняет только данные (player/plot/lastTickAt), не функции.
- `onRehydrateStorage`: при загрузке считаем сколько прошло секунд от `lastTickAt`, и **тикаем оффлайн-прибыль один раз**. Капнуто на 8 часов — иначе игрок оставит вкладку на неделю и получит миллион «офлайн-добычи». 8ч — стандарт для idle-игр.
- Перезагрузи страницу — состояние сохранилось, плюс начислится прибыль за время отсутствия.

### Что теперь может игрок

1. Открыл страницу → видит начальный баланс $1 200 000.
2. Каждую секунду баланс растёт примерно на $4 (мок-доход $14 800/час).
3. Каждую секунду остатки нефти уменьшаются на ~0.07 бар.
4. Тапнул на любую постройку → модалка → кнопка «Улучшить за $50k» (или сколько).
5. Нажал → деньги списались, уровень вырос, доход вырос на 20%, модалка закрылась.
6. Закрыл вкладку, вернулся через час → бонус оффлайн-прибыли на старте.

Это уже **минимальный играбельный цикл** — заработай → улучши → зарабатывай больше.

Коммит: `feat(B.3-B.5): zustand store, 1s tick, building upgrades, localStorage persistence (offline catch-up capped at 8h)`.

### Карта файлов `apps/web/src/` после фазы B

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
│   ├── TopBar.tsx           (+ formatMoneyFull, tabular-nums)
│   ├── PlotHeader.tsx
│   ├── CenterStage.tsx      (SVG + hit-зоны для тапа по постройкам)
│   ├── BuildingModal.tsx    (новый)
│   ├── StatusStrip.tsx
│   ├── QuickActions.tsx
│   └── BottomNav.tsx
├── data/
│   └── mockData.ts          (стартовое состояние; стор инициализируется из него)
├── lib/
│   └── format.ts            (formatMoney + formatMoneyFull + formatBarrels)
├── screens/
│   └── PlotScreen.tsx       (использует useGameTick + стор + модалку)
└── store/
    ├── gameStore.ts         (zustand + persist + tick/upgradeBuilding/reset)
    └── useGameTick.ts       (setInterval, дёргает tick(Δ))
```

---

## 2026-05-17 — Фаза C: C.1 + C.2 + C.3 ✅

Прошёл три тикета за один заход. После B у нас был статичный каркас с тиканьем денег; теперь это **настоящий core loop**: добыча → резервуар → продажа на бирже с дрейфующей ценой + живая сцена.

### C.1 — Продажа нефти через резервуар

**Изменение модели данных.** Раньше доход капал прямо в `money`. Теперь:
- Поле `plot.incomePerHour` (доход) **удалено**.
- Появились `plot.extractionRatePerHour` (баррели/час), `plot.tankCapacity`, `plot.tankFill`.
- Тик кладёт нефть в резервуар: `tankFill += rate*Δ` (с лимитом по `tankCapacity` и `reservesRemaining`).
- **Если резервуар полон — добыча останавливается** (status=full, появляется красная надпись «продай нефть»).
- Кнопка «Продать» в QuickActions активна только при `tankFill > 0`, показывает текущую стоимость содержимого.
- Action `sellOil()` в сторе: `money += tankFill * oilPrice`, `tankFill = 0`. Возвращает сумму.
- `SaleToast.tsx` — баннер «Продано на $46k» всплывает на 2 сек после продажи.

**Что меняет апгрейд (теперь не везде +20%):**
| Постройка | Эффект апгрейда |
|-----------|-----------------|
| Вышка (derrick) | +15% к темпу добычи |
| Скважина (well) | +15% к темпу добычи |
| Резервуар (tank) | ×1.25 к ёмкости бака |
| ДГУ (generator) | −10% к потреблению энергии |

Цена апгрейда: `BASE[type] * 1.5^level`.

### C.2 — Дрейфующая биржевая цена

- Новый раздел стора `market: { oilPrice, priceHistory[] }`. История на 30 точек (= 30 секунд).
- Цена дрейфует **геометрическим броуновским движением с реверсией к среднему**: `dP/P = -κ*ln(P/base)*dt + σ*dW`. Параметры: κ=0.02, σ=0.004, база $60, коридор $50–$70.
- `PriceTicker.tsx` — маленький бейдж в StatusStrip: «Brent $60.34 ▲» + SVG-sparkline. Цвет линии зелёный/розовый по знаку изменения.
- `sellOil()` теперь использует `market.oilPrice` вместо константы. Игрок может **подождать пика цены** перед продажей.

### C.3 — Анимация сцены

- **Балансир скважины качается** (CSS keyframe `pumpjack`, ±12°, 1.5с цикл). Анимация активна только когда `extractionRatePerHour > 0 && tankFill < tankCapacity` — если бак полон, балансир замирает.
- **Жидкость в резервуаре растёт по высоте** (SVG `rect` с `transition: y/height 0.6s linear`). Когда заполнен на 100% — становится розовой (warning).
- **Индикатор сверху вышки пульсирует** (SVG `<animate>`), пока идёт добыча.
- **Лампочки ДГУ мигают** попеременно.

### Миграция persist: v1 → v3

В сторе версия persistence бамп до 3. `migrate(state, version)` обрабатывает:
- `v < 2`: старая схема с `incomePerHour` → конвертирует в `extractionRatePerHour = income / $60` + дефолтный резервуар.
- `v < 3`: добавляет `market` из дефолта.

Так старые сейвы пользователя не побьются при обновлении страницы.

### Файлы добавлены/изменены

```
src/
├── components/
│   ├── CenterStage.tsx     ⟳ анимация балансира, заполнение бака, индикаторы
│   ├── PriceTicker.tsx     ✚ бейдж цены + sparkline
│   ├── StatusStrip.tsx     ⟳ резервуар, цена, цена×бак
│   ├── QuickActions.tsx    ⟳ кнопка «Продать» с динамической ценой
│   └── SaleToast.tsx       ✚ всплывающий баннер «Продано на $X»
├── data/mockData.ts        ⟳ PlotState: tankCapacity/tankFill/extractionRatePerHour
├── index.css               ⟳ @keyframes pumpjack
├── screens/PlotScreen.tsx  ⟳ интеграция SaleToast
└── store/gameStore.ts      ⟳ market + sellOil + новая логика тика + migrate v1→v3
```

Коммит: `feat(C.1-C.3): oil tank+sell loop, drifting Brent price w/ sparkline, animated scene (pumpjack rocks, tank fills)`.

### Что теперь чувствует игрок

1. Открыл страницу — видит бейдж «Brent $60.04 ▲», балансир качается, нефть медленно течёт в бак.
2. На главном балансе **деньги больше не растут сами по себе** — нужно жать «Продать».
3. Через ~5–10 минут бак заполняется, балансир замирает, появляется надпись «Резервуар полон. Добыча остановлена».
4. Игрок смотрит на бейдж цены: пик ($63) или дно ($57)? Жмёт «Продать» в нужный момент.
5. Тост «Продано на $48k», деньги в верхнем баре прыгают вверх, балансир снова качается.
6. Уровень апгрейда теперь имеет **значение**: вышка → быстрее качаем, бак → реже бегаем продавать, ДГУ → меньше тратим (когда введём расход энергии).

Это уже **играбельный 30-минутный сеанс**. Не цель этапа 1 (D.O.D.: 1 час без скуки), но половина пути пройдена.

---

## 2026-05-17 — Фаза D: D.1 + D.2 + D.3 ✅

Три тикета фазы D одним пакетом — крупнейшее архитектурное изменение с начала проекта (модель → derived state).

### D.1 — Множественные постройки + слоты

**Архитектура.** Раньше темп добычи / ёмкость бака / мощность хранились в `PlotState`. Теперь — **derived state**: все вычисляется из `buildings` через формулы в `lib/gameFormulas.ts`. Добавление второй вышки → автоматически вырастает добыча.

`lib/gameFormulas.ts` — **единственное место с балансом**:
```
buildingExtractionRate(b)   → 50 / 30 * 1.15^(level-1)    (derrick / well)
buildingTankCapacity(b)     → 500 * 1.25^(level-1)         (tank)
buildingPowerProduction(b)  → 30 * 1.20^(level-1)          (generator)
buildingPowerDraw(b)        → 12 / 8 * (1+0.05*(level-1))  (derrick / well)
plotExtractionRate/...      → Σ по buildings
upgradeCost(b)              → BASE[type] * 1.5^level
buildCost(type, existing)   → BASE[type] * 2^existing      (новая постройка)
```

Из `PlotState` **удалены** поля `extractionRatePerHour/tankCapacity/powerDraw`. Добавлено `maxSlots: 8`.

**Стор:** action `buildBuilding(type)` — списывает деньги, добавляет здание ур.1, проверяет лимит слотов. Уникальный ID = счётчик + хвост timestamp.

**UI:**
- `BuildSheet.tsx` — нижний sheet с 4 типами построек, ценой, текущим количеством.
- В QuickActions кнопка «Построить» заменила «Магазин», hint = `slotsUsed/maxSlots`.
- На сцене над типом построек рисуется **бейджик `×N`** если больше одной.

**Persist v3 → v4:** миграция вырезает старые поля, переносит `tankFill` и `buildings`, добавляет `maxSlots`.

### D.2 — Энергобаланс

`powerRatio(plot) = clamp(produced/draw, 0, 1)`. Если ДГУ слабее, чем нужно вышкам/скважинам — добыча идёт с понижающим коэффициентом.

В тике: `effectiveRate = plotExtractionRate(plot) * powerRatio(plot)`. Также `recomputeDays` использует effective rate (если энергии не хватает — нефть тянется дольше).

В StatusStrip: строка `⚡ 30/42 кВт`, при дефиците — красная подпись «Не хватает энергии — добыча 71%».

**Геймплей:** игрок не может бесконтрольно ставить вышки без ДГУ — все 4 типа построек связаны.

### D.3 — XP за продажу + level up

- `sellOil()` даёт `revenue / 100` XP. Продажа на $50k → +500 XP.
- `xpToNextLevel *= 1.5` на каждый уровень.
- Цикл обрабатывает множественный level up за одну продажу.
- Новое поле в сторе `pendingLevelUp: number | null` + action `acknowledgeLevelUp()`.
- `LevelUpBanner.tsx` — полноэкранная плашка с искрами и номером уровня, 1.8с.
- XP-полоса в TopBar теперь анимируется.

### Файлы

```
src/
├── components/
│   ├── BuildSheet.tsx       ✚ выбор типа постройки + цены
│   ├── CenterStage.tsx      ⟳ группировка по типу + бейджик ×N
│   ├── LevelUpBanner.tsx    ✚ плашка level up
│   ├── QuickActions.tsx     ⟳ «Построить» вместо «Магазин»
│   └── StatusStrip.tsx      ⟳ ⚡ кВт + effective rate
├── data/mockData.ts         ⟳ без производных полей, + maxSlots
├── lib/
│   └── gameFormulas.ts      ✚ единственное место с балансом
├── screens/PlotScreen.tsx   ⟳ + BuildSheet + LevelUpBanner
└── store/gameStore.ts       ⟳ buildBuilding + powerRatio + XP + persist v4
```

Коммит: `feat(D.1-D.3): multi-buildings + slot limit, energy balance affects extraction, XP rewards and level-up banner`.

### Геймплейный цикл после D

1. Игрок начинает с 4 постройками, 4 свободных слота.
2. Накопил $100k → жмёт «Построить» → ставит вторую вышку.
3. **Сразу видит:** добыча подскочила, но появилось «не хватает 12 кВт».
4. Покупает ДГУ за $30k → ratio = 1, добыча на полной мощности.
5. Бак заполнился вдвое быстрее → продаёт → XP-полоса наполнилась → «Уровень 9!».

**Это уже полный core loop как в GDD.**

### Соответствие D.O.D. этапа 1

- ✅ Один игрок может: посмотреть → построить → добывать → продавать → апгрейдить
- ✅ Минимум 5 уровней вышки (есть до бесконечности через апгрейды)
- ✅ Прогресс сохраняется (localStorage)
- ⏳ Минимум 3 технологии — отложил, не критично для прототипа
- ⏳ Базовая графика — пока SVG, нужно Pixi или хотя бы лучше нарисованные SVG-спрайты
- ⏳ Тест на себе 1 час подряд
- ⏳ Telegram Mini App обёртка (фаза E)

---

## Следующий шаг

→ **E.1 — Telegram Mini App обёртка.** Подключить `@twa-dev/sdk`, прочитать тему/initData, заменить QuickActions на нативную `MainButton` где это уместно. Нужен бот через @BotFather (пользователь обещал создать).

Перед E.1 разумно закрыть **хвост: pm2/systemd для Vite**. Если сейчас сервер перезагрузится, игра ляжет, а в Telegram мы будем тестировать прод-сборку, которую тем более надо как-то автоматически держать поднятой.

### 2026-05-17 — GitHub remote подключён ✅

- Создан ed25519 SSH-ключ `/root/.ssh/oil_tycoon_github` (без пароля) под именем `oil-tycoon@server`. Публичная часть загружена пользователем на GitHub через временную HTTP-раздачу `http://147.45.220.59/oil-tycoon.pub` (этот location в nginx **удалён** сразу после загрузки, /var/www/oil-tycoon-static тоже снесена).
- `~/.ssh/config` маппит `Host github.com` на этот ключ — `IdentitiesOnly yes`, чтобы случайно не пробовался другой ключ.
- Remote `origin` → `git@github.com:AndreiKozlov/oil-tycoon-game.git`.
- `git push -u origin main` запушил все 7 коммитов (от `chore: initial commit` до `feat(D.1-D.3): ...`). Локальный HEAD = удалённый HEAD = `2b770e4`.
- Аккаунт пользователя на GitHub: **AndreiKozlov** (public репо).
- Дальше работаем как обычно: `git push` после новых коммитов.

### 2026-05-17 — GitHub remote подключён ✅

- Создан ed25519 SSH-ключ `/root/.ssh/oil_tycoon_github` (без пароля) под именем `oil-tycoon@server`. Публичная часть загружена пользователем на GitHub через временную HTTP-раздачу `http://147.45.220.59/oil-tycoon.pub` (этот location в nginx **удалён** сразу после загрузки, /var/www/oil-tycoon-static тоже снесена).
- `~/.ssh/config` маппит `Host github.com` на этот ключ — `IdentitiesOnly yes`, чтобы случайно не пробовался другой ключ.
- Remote `origin` → `git@github.com:AndreiKozlov/oil-tycoon-game.git`.
- `git push -u origin main` запушил все 7 коммитов (от `chore: initial commit` до `feat(D.1-D.3): ...`). Локальный HEAD = удалённый HEAD = `2b770e4`.
- Аккаунт пользователя на GitHub: **AndreiKozlov** (public репо).
- Дальше работаем как обычно: `git push` после новых коммитов.

### 2026-05-17 — E.0 pm2 для Vite ✅

- На сервере уже работают **17 pm2-приложений** для tradearena (collectors, signal-engine, ws-bridge, frontend и пр.). **Их не трогаем.**
- Добавили **18-е** приложение под именем `oil-tycoon-web` (id=17 в `pm2 list`):
  ```
  cwd:    /root/oil_tycoon_project/oil-tycoon-game
  cmd:    pnpm --filter @oil-tycoon/web dev
  logs:   /var/log/oil-tycoon/web-{out,err}.log
  autorestart: true (max 10 restart, delay 3s)
  ```
- Конфиг — `ecosystem.config.cjs` в корне репо. Запуск: `pm2 start ecosystem.config.cjs`.
- Старый Vite, который ассистент запускал в фоне (B.1), убит (`kill 4019112`). Теперь Vite живёт под pm2.
- `pm2 save` → snapshot записан в `/root/.pm2/dump.pm2`.
- `pm2-root.service` уже **enabled** в systemd (был включён для tradearena) → после ребута сервера pm2 поднимется автоматически и поднимет все 18 приложений (включая наш Vite).
- Проверено: `/game/` отдаёт 200, порт 5173 слушается процессом pm2 (а не фоновым `claude` Bash).

Коммит: `chore(E.0): pm2 ecosystem config for vite auto-restart`. Запушен на GitHub.

### 2026-05-17 — E.1 Telegram WebApp SDK ✅

Установлен `@twa-dev/sdk`. Все Telegram-фичи живут в двух модулях, **безопасны в обычном браузере** (за пределами Telegram — no-op):
- `src/lib/telegram.ts` — обёртка: `isTelegramEnvironment()`, `initTelegram()` (ready/expand/closingConfirmation), `getTelegramUserFirstName()`, `updateMainButton()`, `hideMainButton()`, `haptic()`.
- `src/lib/useTelegramMainButton.ts` — декларативный React-хук для нативной кнопки.

В сторе появился `setPlayerName(name)` action — `PlotScreen` при монтировании читает `first_name` из Telegram и подставляет вместо «Олег».

**Поведение в Telegram:**
- При открытии Mini App вызываются `WebApp.ready()` + `expand()` + `enableClosingConfirmation()`.
- Когда `tankFill > 0` — снизу появляется нативная Telegram MainButton с текстом **«Продать $X»**, тап вызывает `sellOil()` и хаптик `success`.
- При level up — хаптик `success` (короткая вибрация).

**Поведение в браузере (тест на http://147.45.220.59/game/):**
- `WebApp.platform === 'unknown'` → все Telegram-функции тихо ничего не делают.
- Кнопки «Продать» в QuickActions и BuildingModal-апгрейды продолжают работать как обычно.

### ⚠ Что НЕ работает пока — HTTPS

Telegram **требует HTTPS** для Mini App. Сейчас у нас только `http://147.45.220.59/game/`. Реальный тест в Telegram **не запустится**, пока не подключим TLS-сертификат. Это **E.2**:
- Вариант 1: купить/подключить домен → Let's Encrypt → TLS на nginx.
- Вариант 2: использовать сабдомен от `tradearena.tech` (у тебя уже есть сертификат на основной домен).
- Вариант 3: ngrok / cloudflare tunnel — на время теста.

Коммит: `feat(E.1): Telegram WebApp SDK wired (...)`. Запушен.

### 2026-05-17 — E.2 Cloudflare Tunnel (HTTPS) ✅

- Установлен `cloudflared` 2026.5.0 в `/usr/local/bin/cloudflared` (бинарь с GitHub).
- В `ecosystem.config.cjs` добавлено второе pm2-приложение `oil-tycoon-tunnel` (id=18) — `cloudflared tunnel --url http://127.0.0.1:5173 --no-autoupdate`.
- В `vite.config.ts` в `allowedHosts` добавлен `.trycloudflare.com` — без этого Vite режет запросы со 403.
- **Quick Tunnel** даёт URL вида `https://*.trycloudflare.com` без авторизации в Cloudflare. **URL меняется** при каждом перезапуске процесса. На прод заменим на named tunnel с фиксированным subdomain (требует Cloudflare-аккаунта).
- Текущий URL виден в `pm2 logs oil-tycoon-tunnel --lines 30` или в `/var/log/oil-tycoon/cloudflared-err.log` (cloudflared пишет info в stderr).
- На текущий момент: **https://prepaid-prophet-carey-performer.trycloudflare.com/game/** → HTTP 200, отдаёт игру.

Коммит: `feat(E.2): Cloudflare Quick Tunnel via pm2 for HTTPS access (Telegram-compatible)`.

### Что сейчас можно сделать

Игра доступна по HTTPS — **готова для Telegram Mini App**. Следующий тикет — **E.3: создание бота через @BotFather и привязка URL**.

### 2026-05-18 — F.2 Карта мира + покупка участков ✅

Самое крупное архитектурное изменение после D.1. Стейт перешёл с одного `plot` на **массив `plots[] + activePlotId`**.

**Стор:**
- `plots: PlotState[]` (раньше `plot: PlotState`).
- `activePlotId: string` — какой участок сейчас открыт в UI.
- `buyPlot(worldId)` — проверяет наличие, цену, уровень игрока, создаёт PlotState из шаблона, переключает на новый. При покупке стартовые запасы умножаются на `aggregateTechEffects.reserveMult` (наука даёт эффект).
- `switchPlot(id)` — просто меняет `activePlotId`.
- **`tick()` тикает каждый участок параллельно.** Это idle-фишка: уходишь на работу — все 3 твоих участка добывают независимо, и когда возвращаешься, на каждом есть нефть для продажи.
- `sellOil(plotId?)` — теперь принимает плот-id (по умолчанию активный). Цена считается через `plotSellPrice(plot, marketPrice)` с учётом oilGrade.
- Селекторы `selectActivePlot`, `selectTotalTankValue` экспортируются.

**`data/worldPlots.ts`:**
| ID | Название | Регион | Сорт | Запасы | Цена | Уровень |
|---|---|---|---|---|---|---|
| tyumen-3 | Тюменская-3 | Зап.Сибирь | Urals ×0.92 | 500k | бесплатно | 0 |
| samotlor | Самотлор-7 | ХМАО | Urals ×0.92 | 800k | $250k | 9 |
| urengoy | Уренгой-VIP | Ямал | Urals ×0.92 | 1.4M | $750k | 11 |
| caspian-shelf | Каспий-Шельф | Каспий | **Brent ×1.0** | 1.2M | $1.5M | 13 |
| sakhalin | Сахалин-Восток | Дальний Восток | Dubai ×0.95 | 900k | $900k | 12 |
| orenburg-deep | Оренбург-Глубокий | Урал | Heavy ×0.7 | **2.5M** | $2M | 15 |

**OilGrade** — типы нефти из GDD (Urals/Brent/WTI/Dubai/Heavy). Каждый имеет `priceMult` к рыночной цене Brent. Лёгкая Brent продаётся дороже, тяжёлая Heavy дешевле, но запасы у Heavy больше.

**UI:**
- `screens/WorldMapScreen.tsx` — новый экран. Сверху твои участки (с подсветкой активного, бейджем «Активен», статистикой добычи/бака), снизу доступные к покупке. Заблокированные по уровню показаны grayscale с замочком.
- `components/PlotHeader.tsx` — теперь читает плот из стора сам, показывает эмодзи + регион + сорт нефти + кнопка «🌍 Мир (N)» открывает WorldMapScreen.
- `components/StatusStrip.tsx` — добавлен цветной бейдж сорта нефти (Urals — серый, Brent — оранжевый, Heavy — тёмно-красный) + цена дохода считается с учётом priceMult.
- `GameShell` — таб `world` теперь рендерит `WorldMapScreen` (раньше была заглушка «Скоро»).

**Persist v5 → v6:** мигратор превращает старый одиночный `plot` в массив с одним элементом. Старым участкам выставляется `oilGrade: 'urals'` и эмодзи/регион из mockPlot.

**Все UI-компоненты переведены на `selectActivePlot(state)` селектор** вместо `state.plot`.

Коммит: `feat(F.2): world map screen, 6 buyable plots, parallel idle extraction across plots, oil grade affects sell price (Brent/WTI/Urals/Dubai/Heavy)`. Запушен.

### 2026-05-17 — F.1 Дерево технологий ✅

Реализовал 5 стартовых технологий, постоянные множители, прогресс-бар исследования, новую вкладку в BottomNav.

**Каталог в `src/data/technologies.ts`:**
| Технология | Цена | Длительность | Эффект |
|---|---|---|---|
| Углублённая разведка | $100k | 2 мин | +20% запасов (для будущих участков) |
| Эффективные насосы | $150k | 3 мин | +10% добычи (×на все вышки/скважины) |
| Большие цистерны | $80k | 1.5 мин | +50% ёмкости резервуаров |
| Энергосбережение | $120k | 2.5 мин | −20% потребления энергии |
| Глубокое бурение | $500k | 10 мин | +25% добыча +50% запасы (требует 2 первых) |

**Архитектура.** Эффекты применяются как **глобальные множители** в тике через `aggregateTechEffects(completed)`. Они умножают `extraction` / `tankCapacity` / `powerDraw` поверх вычислений из gameFormulas. Это значит **одна функция-формула живёт, но её результат корректируется наукой**.

`store/gameStore.ts`:
- `research: { inProgress: {techId, startedAt} | null, completed: TechId[] }`.
- `startResearch(id)` — проверяет: нет другого исследования + не завершено + есть пререквизиты + хватает денег.
- В `tick()`: каждую секунду проверяется не пора ли завершить — если да, кладёт ID в `completed`, выставляет `pendingResearchDone`.
- В `tick`, `recomputeDays`, `powerRatio` теперь все принимают `effects` параметром.

**UI:**
- `ResearchScreen.tsx` — список карточек, прогресс-бар у активной, кнопка «Начать» / «Заблокировано» / «Не хватает $X».
- `ResearchDoneToast.tsx` — баннер «Технология готова» 2.4с.
- `BottomNav` — вкладка `settings` заменена на `research` (иконка `FlaskConical`, лейбл «Наука»).
- `PlotScreen` упразднён, контент переехал в `GameShell.tsx` — общая оболочка, переключает экран по табу.
- Telegram MainButton теперь видна **только на вкладке «Участок»** (на «Науке» не мешает).

**Persist v4 → v5:** `research` добавляется со значением `{inProgress: null, completed: []}` для старых сейвов.

Коммит: `feat(F.1): research tree (5 techs, multiplier effects, in-progress tracking, new Lab tab + done toast)`. Запушен.

### 2026-05-17 — Mini App открыт и проверен пользователем ✅

Пользователь создал бота `@OilTycoonDevBot`, привязал Web App URL = HTTPS-ссылку от Cloudflare Tunnel, открыл `https://t.me/OilTycoonDevBot/play` через прокси (без прокси Cloudflare режется РКН — см. DECISIONS).

Подтверждено на ПК-клиенте Telegram:
- ✅ TopBar показывает имя из Telegram-аккаунта (не «Олег»).
- ✅ Нативная MainButton «Продать $X» появляется снизу при `tankFill > 0`.
- ✅ MainButton реально продаёт, баланс растёт.
- ✅ `enableClosingConfirmation()` работает — Telegram спрашивает подтверждение при закрытии.
- ✅ Анимации (балансир, заполнение бака) рендерятся внутри Telegram WebApp.
- ⏳ Вибрацию не проверили — нужен мобильный клиент. Проверим когда тестировщики откроют с телефонов.

### Висящие хвосты

- ⏳ **named Cloudflare Tunnel** для стабильного URL (нужно перед бетой, не сейчас).
- ⏳ **`BroadcastChannel`** против двойной вкладки — перед бетой.
- ⚠ Root-пароль пользователя всё ещё ждёт смены через `passwd root`.

(pm2-хвост закрыт.)

---

## 2026-05-18 — БОЛЬШОЙ ПОВОРОТ: концепция v2

Пользователь сменил концепцию: вместо нефтяного симулятора одной шахты — **стратегия с глобальной картой 30k тайлов, новыми ресурсами, landscape-ориентацией**. Подробности в `docs/DECISIONS.md` (запись от 2026-05-18) и `docs/GDD_v2.md`.

**Старый прототип законсервирован** в ветке `legacy-oil-only` на GitHub. Если v2 не сойдётся — есть рабочий fallback.

План разработки v2: 8 этапов G.1–G.8 по 1-2 дня каждый, с пользовательским go/stop после каждого.

### 2026-05-18 — G.1 GDD v2 ✅

Написал `docs/GDD_v2.md` — 15 разделов, ~400 строк. Главное:
- **30 000 тайлов**, **идентичны Земле** (real-world geography). Вода не покупается.
- 12 биомов: лес, степь, горы, тундра, пустыня, шельф, болото, холмы, равнина, прибрежье, берег реки.
- Ресурсы: лес/камень/железо/еда/нефть/газ → переработка → город-потребитель.
- Монетизация: игровые деньги + кристаллы ускоряют (не P2W).
- Заброшенные участки: 14 дней без активности → доступны другим.
- Архитектура: Postgres + Redis + Fastify + Telegram auth + WebSocket. Шардирование на регионы.
- Рассчитываем на 10k+ DAU с первого дня.

Пользователь одобрил GDD «OK, идём в G.2». Коммит: `docs(G.1): GDD v2`.

### 2026-05-18 — G.2 Landscape layout ✅

Полностью переработал каркас под landscape.

- `App.tsx` — больше нет «телефонной рамки» 420×844. Игра растягивается на весь экран. На portrait + узком экране показывается приглашение «📱➡️ Поверни телефон».
- `GameShell.tsx` — новый каркас: TopBar / [LeftRail | Center | RightPanel] / ResourceBar.
- Удалён `BottomNav.tsx` (заменён на `LeftRail.tsx`).
- `LeftRail.tsx` — новый, 56-64px, вертикальные иконки Hammer/Globe2/BarChart3/FlaskConical/Trophy.
- `RightPanel.tsx` — новый, 288px. Пока пустая с подсказкой. Наполним в G.3.
- `ResourceBar.tsx` — новый, chip'ы ресурсов. Пока только нефть/энергия (v1).

Старые экраны (PlotScreen/WorldMapScreen/ResearchScreen) работают как и раньше, монтируются в центральную main-зону.

Коммит: `feat(G.2): landscape layout`.

### 2026-05-18 — G.2.1 Аудит тайлов ✅

Пользователь залил **802 PNG-тайла** в `apps/web/public/tiles/raw/`. Скрипт Python+PIL прошёлся:
- Все **32×32 пикселя square grid** (не diamond isometric).
- **Без альфа-канала** — непрозрачные, встык.
- Распознан **Civilization II MGE / Test of Time** style набор.
- Покрывает 9 из 12 GDD-биомов. Городов/зданий — нет (нужны отдельно).
- Лицензия CC0/MIT/CC-BY со слов пользователя.

Полный отчёт в `docs/TILES_INVENTORY.md`. Тайлы в git (3 МБ). Используем в G.3.

---

### 2026-05-18 — G.3 Глобальная карта мира на Canvas ✅

Прототипная карта мира с PNG-тайлами на канвасе. Пользователь делает дизайн UI параллельно — я работаю над глобальной картой.

**Файлы:**
- `src/lib/biomeMap.ts` — словарь GDD биом → массивы конкретных путей к PNG (5 вариантов на биом). Метаданные биомов (имя, эмодзи, isLand, hexColor для fallback). Функция `pickTileForBiome(biome, x, y)` детерминированно выбирает вариант для тайла.
- `src/lib/proceduralMap.ts` — генератор карты. Value noise + fbm на 4 октавы → height map → морской уровень → биомы. Температура от широты (полюса холодные, экватор тёплый). Влажность отдельным noise. Прототипная карта 100×60 = 6000 тайлов.
- `src/components/WorldMapCanvas.tsx` — главный компонент:
  - Canvas рендер тайлов 32×32, drawImage только видимого окна (frustum culling).
  - Spritesheet-кэш `Map<path, HTMLImageElement>`. Загружает ~40 уникальных тайлов один раз при mount.
  - Pan: mouse drag + pointer events (работает и на тач).
  - Zoom: wheel + pinch (двупальцевый touch). MIN_ZOOM=0.4, MAX_ZOOM=3.0, zoom-in-to-cursor.
  - Hover-подсказка с координатой + биомом + эмодзи.
  - Жёлтая рамка подсветки тайла под курсором.
  - Кнопки + / − в углу для accessibility.
  - Fallback: если PNG не загрузился — заливка `hexColor` биома.
- `src/screens/WorldMapScreen.tsx` — переписан. Старый список купленных участков убран (нужен серверный state — G.5). Теперь: WorldMapCanvas + временный sheet «Тайл (X, Y) — биом» при клике. UI sheet'а с действиями (Разведать/Купить) — после дизайна пользователя.

**Решения по тайлам:**
- Тайлы 32×32 RGB без альфы. **Магический cyan `(0, 255, 255)`** в Civ-II наборе = прозрачность для оверлеев. Пока используем только базовые (без cyan), wang-переходы — позже.
- Маппинг биомов:
  | GDD биом | PNG-группа |
  |---|---|
  | forest | tswb000-011 (тёмная зелень) |
  | grassland | tgrs000-010 (коричнево-жёлтая) |
  | mountain | trom000-011 |
  | tundra | tsnb000-004 (снег) |
  | desert | tsab000-004 (песок) |
  | swamp | tswd / tsws |
  | shore | trob / tros |
  | water | watrtl01-04 |
  | plain | tsus / tsud |
  | volcanic | tvlb / tvld |

**Что работает:** открой http://147.45.220.59/game/ → ☰ → «Карта мира» → 100×60 тайлов с континентами, морями, тундрой на полюсах, пустынями на экваторе. Drag — pan, wheel/pinch — zoom, клик — sheet с инфой о тайле.

**Производительность:** 6000 тайлов на канвасе при frustum culling рисуются ~1 ms. На прод 30000+ нужен tile-cache в Redis (G.4).

**Отложено:**
- Wang-переходы между биомами.
- Разведка / покупка / владение — серверная логика (G.5).
- Подсветка своих / чужих / заброшенных — нужен серверный state.
- Sheet под дизайн пользователя.

Коммит: `feat(G.3): world map canvas`.

---

## Следующий шаг

Жду пользователя:
1. Открыть карту мира, проверить (pan/zoom/клик).
2. Прислать макеты UI (sheet тайла, локация, уведомления).
3. После дизайна — G.3.x вписать в существующие компоненты.

Параллельно могу начать **G.4** (Postgres-схема + Fastify auth) — серверная работа, дизайн UI не нужен.

---

## 2026-05-18 — БОЛЬШОЙ ПОВОРОТ: концепция v2

Пользователь сменил концепцию: вместо нефтяного симулятора одной шахты — **стратегия с глобальной картой 30k тайлов, новыми ресурсами, landscape-ориентацией**. Подробности в `docs/DECISIONS.md` (запись от 2026-05-18) и `docs/GDD_v2.md`.

**Старый прототип законсервирован** в ветке `legacy-oil-only` на GitHub. Если v2 не сойдётся — есть рабочий fallback.

План разработки v2: 8 этапов G.1–G.8 по 1-2 дня каждый, с пользовательским go/stop после каждого.

### 2026-05-18 — G.1 GDD v2 ✅

Написал `docs/GDD_v2.md` — 15 разделов, ~400 строк. Главное:
- **30 000 тайлов**, **идентичны Земле** (real-world geography). Вода не покупается.
- 12 биомов: лес, степь, горы, тундра, пустыня, шельф, болото, холмы, равнина, прибрежье, берег реки.
- Ресурсы: лес/камень/железо/еда/нефть/газ → переработка → город-потребитель.
- Монетизация: игровые деньги + кристаллы ускоряют (не P2W).
- Заброшенные участки: 14 дней без активности → доступны другим.
- Архитектура: Postgres + Redis + Fastify + Telegram auth + WebSocket. Шардирование на регионы.
- Рассчитываем на 10k+ DAU с первого дня.

Пользователь одобрил GDD «OK, идём в G.2». Коммит: `docs(G.1): GDD v2`.

### 2026-05-18 — G.2 Landscape layout ✅

Полностью переработал каркас под landscape.

- `App.tsx` — больше нет «телефонной рамки» 420×844. Игра растягивается на весь экран. На portrait + узком экране показывается приглашение «📱➡️ Поверни телефон».
- `GameShell.tsx` — новый каркас: TopBar / [LeftRail | Center | RightPanel] / ResourceBar.
- Удалён `BottomNav.tsx` (заменён на `LeftRail.tsx`).
- `LeftRail.tsx` — новый, 56-64px, вертикальные иконки Hammer/Globe2/BarChart3/FlaskConical/Trophy.
- `RightPanel.tsx` — новый, 288px. Пока пустая с подсказкой. Наполним в G.3.
- `ResourceBar.tsx` — новый, chip'ы ресурсов. Пока только нефть/энергия (v1).

Старые экраны (PlotScreen/WorldMapScreen/ResearchScreen) работают как и раньше, монтируются в центральную main-зону.

Коммит: `feat(G.2): landscape layout`.

### 2026-05-18 — G.2.1 Аудит тайлов ✅

Пользователь залил **802 PNG-тайла** в `apps/web/public/tiles/raw/`. Скрипт Python+PIL прошёлся:
- Все **32×32 пикселя square grid** (не diamond isometric).
- **Без альфа-канала** — непрозрачные, встык.
- Распознан **Civilization II MGE / Test of Time** style набор.
- Покрывает 9 из 12 GDD-биомов. Городов/зданий — нет (нужны отдельно).
- Лицензия CC0/MIT/CC-BY со слов пользователя.

Полный отчёт в `docs/TILES_INVENTORY.md`. Тайлы в git (3 МБ). Используем в G.3.

---

### 2026-05-18 — G.3 Глобальная карта мира на Canvas ✅

Прототипная карта мира с PNG-тайлами на канвасе. Пользователь делает дизайн UI параллельно — я работаю над глобальной картой.

**Файлы:**
- `src/lib/biomeMap.ts` — словарь GDD биом → массивы конкретных путей к PNG (5 вариантов на биом). Метаданные биомов (имя, эмодзи, isLand, hexColor для fallback). Функция `pickTileForBiome(biome, x, y)` детерминированно выбирает вариант для тайла.
- `src/lib/proceduralMap.ts` — генератор карты. Value noise + fbm на 4 октавы → height map → морской уровень → биомы. Температура от широты (полюса холодные, экватор тёплый). Влажность отдельным noise. Прототипная карта 100×60 = 6000 тайлов.
- `src/components/WorldMapCanvas.tsx` — главный компонент:
  - Canvas рендер тайлов 32×32, drawImage только видимого окна (frustum culling).
  - Spritesheet-кэш `Map<path, HTMLImageElement>`. Загружает ~40 уникальных тайлов один раз при mount.
  - Pan: mouse drag + pointer events (работает и на тач).
  - Zoom: wheel + pinch (двупальцевый touch). MIN_ZOOM=0.4, MAX_ZOOM=3.0, zoom-in-to-cursor.
  - Hover-подсказка с координатой + биомом + эмодзи.
  - Жёлтая рамка подсветки тайла под курсором.
  - Кнопки + / − в углу для accessibility.
  - Fallback: если PNG не загрузился — заливка `hexColor` биома.
- `src/screens/WorldMapScreen.tsx` — переписан. Старый список купленных участков убран (нужен серверный state — G.5). Теперь: WorldMapCanvas + временный sheet «Тайл (X, Y) — биом» при клике. UI sheet'а с действиями (Разведать/Купить) — после дизайна пользователя.

**Решения по тайлам:**
- Тайлы 32×32 RGB без альфы. **Магический cyan `(0, 255, 255)`** в Civ-II наборе = прозрачность для оверлеев. Пока используем только базовые (без cyan), wang-переходы — позже.
- Маппинг биомов:
  | GDD биом | PNG-группа |
  |---|---|
  | forest | tswb000-011 (тёмная зелень) |
  | grassland | tgrs000-010 (коричнево-жёлтая) |
  | mountain | trom000-011 |
  | tundra | tsnb000-004 (снег) |
  | desert | tsab000-004 (песок) |
  | swamp | tswd / tsws |
  | shore | trob / tros |
  | water | watrtl01-04 |
  | plain | tsus / tsud |
  | volcanic | tvlb / tvld |

**Что работает:** открой http://147.45.220.59/game/ → ☰ → «Карта мира» → 100×60 тайлов с континентами, морями, тундрой на полюсах, пустынями на экваторе. Drag — pan, wheel/pinch — zoom, клик — sheet с инфой о тайле.

**Производительность:** 6000 тайлов на канвасе при frustum culling рисуются ~1 ms. На прод 30000+ нужен tile-cache в Redis (G.4).

**Отложено:**
- Wang-переходы между биомами.
- Разведка / покупка / владение — серверная логика (G.5).
- Подсветка своих / чужих / заброшенных — нужен серверный state.
- Sheet под дизайн пользователя.

Коммит: `feat(G.3): world map canvas`.

---

## Следующий шаг

Жду пользователя:
1. Открыть карту мира, проверить (pan/zoom/клик).
2. Прислать макеты UI (sheet тайла, локация, уведомления).
3. После дизайна — G.3.x вписать в существующие компоненты.

Параллельно могу начать **G.4** (Postgres-схема + Fastify auth) — серверная работа, дизайн UI не нужен.
