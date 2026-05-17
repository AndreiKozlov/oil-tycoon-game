import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BIOME_INFO,
  getAllUniqueTilePaths,
  pickTileForBiome,
  type Biome,
} from '../lib/biomeMap';
import { DEFAULT_MAP, generateMap, biomeAtIndex, type MapConfig } from '../lib/proceduralMap';

// Базовый размер тайла на карте (пиксели на экране в 1× zoom).
// Реальные PNG 32×32, но при zoom можем растягивать.
const TILE_PX = 32;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;

export interface TileSelection {
  x: number;
  y: number;
  biome: Biome;
}

interface Props {
  config?: MapConfig;
  onTileClick?: (sel: TileSelection) => void;
}

export function WorldMapCanvas({ config = DEFAULT_MAP, onTileClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Кэш картинок тайлов.
  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [spritesLoaded, setSpritesLoaded] = useState(false);

  // Карта биомов (Memo, чтобы не пересчитывать на каждом рендере).
  const map = useMemo(() => generateMap(config), [config]);

  // Состояние камеры: смещение в пикселях + zoom.
  const camRef = useRef({ x: -50, y: -20, zoom: 1 });
  const [, forceRender] = useState(0); // тригер перерисовки

  // Выбранный тайл (для подсветки).
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  // ===== Загрузка спрайтов =====

  useEffect(() => {
    let cancelled = false;
    const paths = getAllUniqueTilePaths();
    let loaded = 0;
    paths.forEach((path) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        spriteCacheRef.current.set(path, img);
        loaded += 1;
        if (loaded === paths.length) setSpritesLoaded(true);
      };
      img.onerror = () => {
        loaded += 1;
        // Даже если не загрузилось — продолжим. Не блокируем картину.
        if (loaded === paths.length) setSpritesLoaded(true);
      };
      img.src = path;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== Рендер =====

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Фон — глубокий синий (океан под потерянными плитками).
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, w, h);

    const cam = camRef.current;
    const tileSize = TILE_PX * cam.zoom;

    // Какой диапазон тайлов виден?
    const startX = Math.max(0, Math.floor(-cam.x / tileSize));
    const startY = Math.max(0, Math.floor(-cam.y / tileSize));
    const endX = Math.min(config.width, Math.ceil((w - cam.x) / tileSize) + 1);
    const endY = Math.min(config.height, Math.ceil((h - cam.y) / tileSize) + 1);

    // Рендер тайлов.
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const biome = biomeAtIndex(map, config, x, y);
        if (!biome) continue;
        const px = Math.floor(cam.x + x * tileSize);
        const py = Math.floor(cam.y + y * tileSize);

        const sprite = spritesLoaded
          ? spriteCacheRef.current.get(pickTileForBiome(biome, x, y))
          : null;

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          ctx.drawImage(sprite, px, py, Math.ceil(tileSize), Math.ceil(tileSize));
        } else {
          // fallback — заливка hexColor биома.
          ctx.fillStyle = BIOME_INFO[biome].hexColor;
          ctx.fillRect(px, py, Math.ceil(tileSize), Math.ceil(tileSize));
        }
      }
    }

    // Подсветка под курсором.
    if (hovered) {
      const px = Math.floor(cam.x + hovered.x * tileSize);
      const py = Math.floor(cam.y + hovered.y * tileSize);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    }
  }, [config, map, spritesLoaded, hovered]);

  // Перерисовка при изменениях.
  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ===== Взаимодействие =====

  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const screenToTile = useCallback(
    (sx: number, sy: number) => {
      const cam = camRef.current;
      const tileSize = TILE_PX * cam.zoom;
      const tx = Math.floor((sx - cam.x) / tileSize);
      const ty = Math.floor((sy - cam.y) / tileSize);
      return { x: tx, y: ty };
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, cx: camRef.current.x, cy: camRef.current.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      camRef.current.x = dragRef.current.cx + dx;
      camRef.current.y = dragRef.current.cy + dy;
      draw();
    } else {
      const t = screenToTile(e.clientX - rect.left, e.clientY - rect.top);
      if (t.x < 0 || t.y < 0 || t.x >= config.width || t.y >= config.height) {
        if (hovered) setHovered(null);
      } else if (!hovered || hovered.x !== t.x || hovered.y !== t.y) {
        setHovered(t);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const wasDrag = dragRef.current;
    dragRef.current = null;

    // Если палец почти не двигался — считаем кликом.
    if (wasDrag) {
      const dx = e.clientX - wasDrag.x;
      const dy = e.clientY - wasDrag.y;
      if (Math.hypot(dx, dy) < 4) {
        const t = screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        if (t.x >= 0 && t.x < config.width && t.y >= 0 && t.y < config.height) {
          const biome = biomeAtIndex(map, config, t.x, t.y);
          if (biome && onTileClick) onTileClick({ x: t.x, y: t.y, biome });
        }
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cam = camRef.current;
    const oldZoom = cam.zoom;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if (newZoom === oldZoom) return;
    // Zoom в точку курсора.
    cam.x = cx - ((cx - cam.x) / oldZoom) * newZoom;
    cam.y = cy - ((cy - cam.y) / oldZoom) * newZoom;
    cam.zoom = newZoom;
    draw();
    forceRender((n) => n + 1);
  };

  // Двупальцевый pinch на тач-экранах.
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      pinchRef.current = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        zoom: camRef.current.zoom,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = newDist / pinchRef.current.dist;
      const cam = camRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * ratio));
      cam.zoom = newZoom;
      draw();
    }
  };
  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  // Кнопки зума (для accessibility).
  const zoomBy = (factor: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cam = camRef.current;
    const oldZoom = cam.zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    const cx = wrap.clientWidth / 2;
    const cy = wrap.clientHeight / 2;
    cam.x = cx - ((cx - cam.x) / oldZoom) * newZoom;
    cam.y = cy - ((cy - cam.y) / oldZoom) * newZoom;
    cam.zoom = newZoom;
    draw();
    forceRender((n) => n + 1);
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[#0a1018] touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <canvas ref={canvasRef} className="block" />

      {/* Кнопки зума снизу справа карты */}
      <div className="absolute bottom-20 right-3 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/85 text-lg text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/85 text-lg text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800"
        >
          −
        </button>
      </div>

      {/* Подсказка с координатой и биомом hovered тайла */}
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-16 z-10 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur">
          {(() => {
            const biome = biomeAtIndex(map, config, hovered.x, hovered.y);
            const info = biome ? BIOME_INFO[biome] : null;
            return (
              <>
                <span className="font-mono">({hovered.x}, {hovered.y})</span>
                {info && (
                  <>
                    {' · '}
                    <span>{info.emoji} {info.name}</span>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {!spritesLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Загрузка карты…
        </div>
      )}
    </div>
  );
}
