# Промпты для генерации tilemap через нейросеть

> Дата: 2026-05-18
> Цель: сгенерировать spritesheet 16×16 тайлов 32×32 px для карты мира Oil Tycoon с правильными wang-стыками между биомами суши.

---

## ⚠ ВАЖНАЯ ОГОВОРКА

**Современные нейросети (Midjourney v6, DALL-E 3, SDXL) НЕ умеют надёжно генерировать tilemaps с pixel-perfect wang-стыками** — это фундаментальное ограничение. Они генерируют «красиво похожее на тайлсет», но соседние тайлы **не стыкуются точно по граничным пикселям**, что критично для нашего рендера.

**Реальный workflow** для получения рабочего тайлсета:

1. **Генерация черновика** через нейросеть (промпты ниже) — получаем визуальный концепт.
2. **Ручная нарезка и доработка** в Aseprite / Photoshop / Krita — выравнивание краёв пикселей по wang-таблице.
3. Либо — **использование специализированных инструментов**:
   - [Sprite Fusion](https://www.spritefusion.com/) — AI tilemap editor с поддержкой wang
   - [PixelLab.ai](https://www.pixellab.ai/) — заточена под пиксель-арт
   - LoRA-модели на CivitAI с тегами `tileset`, `pixelart`, `wang-tile`

Без ручной пост-обработки результат нейросети **не подойдёт** для прямого использования. Но как **первый набросок** для дизайнера — годится.

---

## Что нам нужно — техническая спецификация

- **Tile size:** 32 × 32 пикселя
- **Сетка spritesheet:** 16 × 16 тайлов = **512 × 512 px output**
- **Style:** top-down (вид сверху), не isometric
- **Биомы (9 базовых):**
  1. Лес (тёмная зелень, листва)
  2. Поле/трава (светло-зелёная)
  3. Горы (тёмно-серые скалы со снежными вершинами)
  4. Тундра (снег с тёмными пятнами)
  5. Пустыня (золотистый песок)
  6. Болото (тёмно-зелёная влажная)
  7. Равнина (земля коричневая)
  8. Вода (синяя глубокая)
  9. Прибрежная зона (светлый песок у воды)
- **Wang-edges:** между каждой парой биомов — **4 transition tile** (N, E, S, W).
- **Стиль:** **Civilization II / Forge of Empires** — top-down, читаемый, без 3D-теней.

---

## Промпт 1 — Midjourney v6

```
top-down tilemap spritesheet, 16x16 grid of 32px tiles, 512x512 total,
pixel art game terrain tileset for strategy game,
9 biomes: forest (dark green), grassland (bright green), mountain (gray rocks),
tundra (snow), desert (golden sand), swamp (dark wet green), plain (brown earth),
ocean water (blue), beach (light sand),
each biome has 4 edge variants for tiling with neighbors,
flat top-down view, no isometric, no 3D shading,
clean pixel boundaries, sharp edges aligned to pixel grid,
inspired by Civilization II terrain graphics, retro 90s strategy game style
--style raw --ar 1:1 --tile --v 6
```

**Параметры Midjourney:**
- `--tile` — обязательно, делает tile-able изображение
- `--style raw` — меньше «художественной интерпретации»
- `--ar 1:1` — квадратный формат
- `--v 6` — последняя версия (на 2026)

---

## Промпт 2 — Stable Diffusion XL

```
masterpiece, best quality, pixel art tilemap, terrain tileset,
top-down view, square tiles 32x32 pixels, 16x16 grid spritesheet,
biomes: forest, grassland, mountain, tundra, desert, swamp, plain, ocean, beach,
wang tile transitions between biomes, clean pixel boundaries,
Civilization 2 style, retro strategy game graphics,
flat colors, no anti-aliasing, no smooth edges

Negative prompt:
3d rendering, isometric, photo realistic, blurry edges,
anti-aliasing, characters, buildings, text, watermarks, signatures
```

**Параметры SDXL:**
- Resolution: **512 × 512**
- Sampler: **Euler a** или **DPM++ 2M Karras**
- Steps: **30-40**
- CFG: **7-8**
- LORA рекомендации (с CivitAI):
  - `pixel-art-xl-v1.1.safetensors` (тег `pixelart`)
  - `2.5d-tileset.safetensors` (если найти tilemap-специализированную)

---

## Промпт 3 — DALL-E 3 / ChatGPT

```
Create a 512x512 pixel art spritesheet for a top-down strategy game.
The image should be a 16x16 grid of 32x32 pixel tiles representing terrain.

Required biomes (each takes a row of 16 tiles):
1. Deep forest (dark green with tree silhouettes)
2. Light grassland (bright green)
3. Rocky mountain (dark gray with white peaks)
4. Snow tundra (white with rocks)
5. Desert sand (golden tan)
6. Wet swamp (dark olive green)
7. Brown plains (earth)
8. Deep ocean water (blue)
9. Beach sand (light tan)

For each biome, include 4 variants for edge transitions (top/right/bottom/left edges).

Visual style: retro pixel art, like Civilization 2 or early Final Fantasy.
Sharp pixel boundaries, no anti-aliasing, flat colors, no 3D shading.
Top-down view (looking straight down), not isometric.
```

DALL-E чаще игнорирует размер сетки, но даёт визуально хороший результат который потом надо нарезать.

---

## Что делать с результатом

1. **Скачать** сгенерированный 512×512 PNG.
2. **Положить в** `/root/oil_tycoon_project/oil-tycoon-game/apps/web/public/tiles/ai-gen/`.
3. **Нарезать** на 256 тайлов 32×32:
   - Открыть в Aseprite/GIMP → Image → Slice Tool → grid 32×32
   - Или скрипт Python+PIL: я могу написать
4. **Проверить wang-стыки** визуально:
   - Соседние тайлы биома должны иметь идентичные граничные пиксели на общей стороне
   - Transition tile «forest→grass» в правом столбце должен совпадать с tile «grass→forest» в левом столбце второго биома
5. **Заменить** содержимое `biomeMap.ts` на новые пути.

Если нейросеть не даст pixel-perfect стыки (скорее всего так и будет) — потребуется **дорисовать руками** в Aseprite. Это **~2-4 часа** работы для дизайнера на 9 биомов × 4 edge transitions = 36 transition tiles.

---

## Альтернатива — заказать у Fiverr / dribbble

Если не хочется тратить время на пост-обработку:
- Заказ tilemap на [Fiverr](https://www.fiverr.com/search/gigs?query=tilemap%20pixel%20art) — $20-50, 1-3 дня.
- Поиск на [itch.io free tilesets](https://itch.io/game-assets/free/tag-tilemap) — много CC0 tilemaps с готовыми wang-переходами.

Itch.io вариант **самый быстрый** для прототипа — найдёшь готовый набор за 10 минут поиска.

---

## Запасной вариант — ручная процедурная отрисовка

Если ни нейросеть, ни покупка не подходят — я могу сгенерировать **простые но чистые** wang-тайлы прямо в Canvas:
- Базовые цвета (зелёный, песок, серый, белый)
- Wang-переходы — через blur + dither pattern на границах
- Получается стилизованно «Risk» или «Polytopia», не Civ-II, но работает идеально.

Этот вариант я могу сделать **в любой момент** в текущей сессии без внешних ассетов.
