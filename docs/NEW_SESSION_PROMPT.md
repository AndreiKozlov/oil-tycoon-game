# Шаблон сообщения для нового ассистента после `/clear`

> Этот файл создан 2026-05-18. Если ты пользователь и начинаешь новый чат — **скопируй блок ниже** и пришли первым сообщением ассистенту. Тогда он сразу разберётся в проекте и не задаст уже отвеченных вопросов.

---

## Скопировать как первое сообщение в новый чат

```
Привет. Мы делаем Telegram Mini App — стратегию с глобальной картой Земли
«Oil Tycoon → новая концепция v2».

Код в /root/oil_tycoon_project/oil-tycoon-game/ на этом же сервере
(147.45.220.59 — Hetzner VPS).

Прочитай в таком порядке (это обязательно):
1. /root/oil_tycoon_project/oil-tycoon-game/docs/START_HERE.md — навигатор
2. /root/oil_tycoon_project/oil-tycoon-game/docs/PROGRESS_LOG.md — что сделано
3. /root/oil_tycoon_project/oil-tycoon-game/docs/DECISIONS.md — решения
4. /root/oil_tycoon_project/oil-tycoon-game/docs/GDD_v2.md — концепция
5. /root/oil_tycoon_project/oil-tycoon-game/docs/CHANGE_REQUESTS.md — правки

Игра запущена под pm2 (oil-tycoon-web + oil-tycoon-tunnel). Доступна по
http://147.45.220.59/game/ и через Telegram-бот @OilTycoonDevBot.
URL Cloudflare-туннеля меняется при рестарте — смотри его так:
  pm2 logs oil-tycoon-tunnel --lines 30 --nostream | grep trycloudflare

На каком этапе остановились — смотри последнюю запись в PROGRESS_LOG.md.
Продолжи с того места, не задавай вопросов, которые уже решены.
```

---

## Проверочный вопрос

После того как ассистент сказал «прочитал», спроси:

> **«Что мы делали в последнем тикете и какой следующий шаг?»**

Правильный ответ должен включать:
- Последний этап (например, на 2026-05-18 это G.3.7 — процедурный рендер тайлов в Canvas без PNG)
- Следующий шаг (G.4 — бэкенд: Postgres + Fastify + Telegram auth + Natural Earth raster)

Если ассистент путается, говорит про нефтяную игру или vite-установку — он не прочитал PROGRESS_LOG. Попроси перечитать.

---

## Что НЕ делать в новой сессии

- ❌ Не вводи root-пароль в чат (старый раскрыт, новый никому)
- ❌ Не проси «давай переделаем X с нуля» — почитай DECISIONS.md, скорее всего уже обсуждали
- ❌ Не торопись — пусть ассистент действительно прочитает 5 файлов, это 5-10 минут чтения, иначе будет городить чушь

---

## Срочные команды если что-то сломалось

```bash
# Проверить что игра отдаётся
curl -s -o /dev/null -w '%{http_code}\n' http://147.45.220.59/game/

# Узнать текущий Cloudflare URL для Telegram
pm2 logs oil-tycoon-tunnel --lines 30 --nostream | grep trycloudflare

# Перезапустить если что-то зависло
pm2 restart oil-tycoon-web
pm2 restart oil-tycoon-tunnel

# Состояние всех pm2-процессов
pm2 list
```

---

## Главные пути

| Что | Где |
|---|---|
| Корень проекта | `/root/oil_tycoon_project/oil-tycoon-game/` |
| Документация | `docs/` |
| Фронт | `apps/web/src/` |
| Бэк (после G.4) | `apps/api/src/` |
| Тайлы (если ещё нужны) | `apps/web/public/tiles/raw/` |
| pm2 ecosystem | `ecosystem.config.cjs` |
| nginx site | `/etc/nginx/sites-available/oil-tycoon-game` |
| SSH-ключ для GitHub | `/root/.ssh/oil_tycoon_github` |
| GitHub repo | `git@github.com:AndreiKozlov/oil-tycoon-game.git` |
