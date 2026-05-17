# Инвентарь тайлов (прототип v2)

> Дата: 2026-05-18
> Все тайлы — **прототипные**, на проде сгенерируем/нарисуем свои.

## Базовые факты

- **802 PNG-файла** в `apps/web/public/tiles/raw/`
- **Все 32×32 пикселя** (square grid, не diamond isometric)
- **Без альфа-канала** → тайлы непрозрачные, ставятся встык
- Папки: `tilemap/` (234 файла) и `bg/` (468 файлов)
- Лицензия: пользователь подтвердил что это свободный ассет (CC0/MIT/CC-BY), точный источник указать в `ATTRIBUTION.md`.

## Распознанный набор

По характерным именам (`Tshrc` = TerrainShoreCorner, `tgrs` = TerrainGrassSlope) — похоже на тайлсет **Civilization II MGE / Test of Time** или клон.

## Группы префиксов

### Базовые ландшафты (`bg/`)

| Префикс | Описание | Шт. |
|---|---|---|
| `tgrs` / `tgrm` / `tgrd` / `tgrb` | Grass — base/mountain/desert/border варианты | 28+7+20+24 |
| `tdtb` / `tdts` / `tdtm` | Dirt | 24+20+2 |
| `tsab` / `tsus` / `tsud` / `tsum` / `tsub` | Sand (различные переходы) | 124 |
| `tsnb` / `tsnd` / `tsnm` / `tsns` | Snow | 79 |
| `tswb` / `tswd` / `tswm` / `tsws` | Swamp / wetlands | 83 |
| `tvlb` / `tvld` / `tvlm` / `tvls` | Valley / volcanic? | 79 |
| `trom` / `rocktl` | Mountains / rocks | 15+48 |

### Берега и переходы (`bg/`)

| Префикс | Описание | Шт. |
|---|---|---|
| `tros` | Shore (terrain shoreline) | 20 |
| `trob` | Beach | 24 |
| `Tshre` / `Tshrc` | Shore edge / corner | 38 |
| `watrtl` | Water tiles | 33 |

### Дороги (`bg/` и `tilemap/`)

| Префикс | Описание | Шт. |
|---|---|---|
| `TRDC` | Road concrete | 17 |
| `trdd` | Road dirt | 17 |
| `trdg` | Road gravel | 17 |
| `trod` | Road off | 20 |

### Реки (`tilemap/`)

| Префикс | Описание | Шт. |
|---|---|---|
| `clrrvr` | Clear river | 13 |
| `icyrvr` | Icy river | 13 |
| `lavrvr` | Lava river | 13 |
| `mudrvr` | Mud river | 13 |

### Прочее

| Префикс | Описание | Шт. |
|---|---|---|
| `EDG` | Edges / transition | 36 |
| `rocktl` | Rocks | 48 |

## Маппинг GDD-биом → группа тайлов

| GDD биом | Набор |
|---|---|
| Лес 🌲 | tgr* зелёные |
| Степь 🌾 | tgr* + tdt* |
| Горы ⛰ | trom + rocktl |
| Тундра ❄️ | tsn* |
| Пустыня 🏜 | tsa* |
| Шельф 🌊 | watrtl + Tshre |
| Болото 🪵 | tsw* |
| Холмы 🟫 | tdt* + rocktl |
| Прибрежье 🏖 | trob + Tshre |
| Равнина ⬜ | tgr* бледные |
| Берег реки 💧 | clrrvr |

Покрытие: 9 из 12 GDD-биомов. Здания/города — нужны отдельно.

## Использование

Для G.3 (tilemap-сцена):
1. Базовый тайл по биому.
2. Canvas/CSS-grid рендер на сетке 32×32.
3. Переходы — через `EDG*` / `Tshre*` (wang-tile).

Конкретный маппинг файл→биом — в G.3.
