import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BIOME_INFO, type Biome } from '../lib/biomeMap';
import { DEFAULT_MAP, generateMap, biomeAtIndex, type MapConfig } from '../lib/proceduralMap';
import { TILE_SIZE } from '../lib/proceduralTiles';
import {
  BIOME_TO_HBIOME,
  loadAtlas,
  isAtlasReady,
  getAtlasImage,
  getAtlasMeta,
  pickTileForMask,
  computeCornerMask,
  type HBiome,
} from '../lib/wangAtlas';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;

export interface TileSelection {
  x: number;
  y: number;
  biome: Biome;
}

interface Props {
  config?: MapConfig;
  onTileClick?: (sel: TileSelection) => void;
}

// Процедурный Canvas-рендер (G.3.7). Без PNG-тайлов: каждый тайл рисуется
// программно через ImageData с Bayer-dither для плавных wang-переходов.
export function WorldMapCanvas({ config = DEFAULT_MAP, onTileClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tileCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const map = useMemo(() => generateMap(config), [config]);

  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [, forceRender] = useState(0);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fitZoomW = wrap.clientWidth / (config.width * TILE_SIZE);
    const fitZoomH = wrap.clientHeight / (config.height * TILE_SIZE);
    const startZoom = Math.max(MIN_ZOOM, Math.min(fitZoomW, fitZoomH) * 0.95);
    camRef.current.zoom = startZoom;
    const tileSize = TILE_SIZE * startZoom;
    camRef.current.x = (wrap.clientWidth - config.width * tileSize) / 2;
    camRef.current.y = (wrap.clientHeight - config.height * tileSize) / 2;
    forceRender((n) => n + 1);
  }, [config.width, config.height]);

  useEffect(() => {
    if (!tileCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = TILE_SIZE;
      c.height = TILE_SIZE;
      tileCanvasRef.current = c;
    }
  }, []);

  // Загрузка wang-атласа (PNG + JSON). После загрузки форсим перерисовку.
  useEffect(() => {
    let cancelled = false;
    loadAtlas()
      .then(() => {
        if (!cancelled) forceRender((n) => n + 1);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[WorldMap] atlas load failed, falling back to procedural', e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const tileCanvas = tileCanvasRef.current;
    if (!canvas || !wrap || !tileCanvas) return;
    const ctx = canvas.getContext('2d');
    const tileCtx = tileCanvas.getContext('2d');
    if (!ctx || !tileCtx) return;

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

    // Полная очистка кадра — без неё PNG-тайлы с RGBA-границами наслаиваются
    // на предыдущий кадр при пане/зуме, и старая Bayer-карта (или просто
    // прошлый кадр) просвечивает через прозрачные кромки атласа.
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BIOME_INFO.water.hexColor;
    ctx.fillRect(0, 0, w, h);

    const cam = camRef.current;
    const tileSize = TILE_SIZE * cam.zoom;

    const startX = Math.max(0, Math.floor(-cam.x / tileSize));
    const startY = Math.max(0, Math.floor(-cam.y / tileSize));
    const endX = Math.min(config.width, Math.ceil((w - cam.x) / tileSize) + 1);
    const endY = Math.min(config.height, Math.ceil((h - cam.y) / tileSize) + 1);

    const atlasReady = isAtlasReady();
    const atlasImg = atlasReady ? getAtlasImage() : null;
    const atlasMeta = atlasReady ? getAtlasMeta() : null;

    // sample: возвращает Heroes 3 biome для клетки (или null для воды/вне карты).
    const sampleHBiome = (sx: number, sy: number): HBiome | null => {
      const b = biomeAtIndex(map, config, sx, sy);
      if (!b) return null;
      return BIOME_TO_HBIOME[b];
    };

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const biome = biomeAtIndex(map, config, x, y);
        if (!biome) continue;
        // Тайлы стыкуются ПИКСЕЛЬ-В-ПИКСЕЛЬ: каждый тайл занимает место
        // от floor(cam + x*size) до floor(cam + (x+1)*size). Это убирает
        // 1px-зазоры/перекрытия, которые при zoom<1 создают визуальный
        // «второй слой».
        const px = Math.floor(cam.x + x * tileSize);
        const py = Math.floor(cam.y + y * tileSize);
        const pxNext = Math.floor(cam.x + (x + 1) * tileSize);
        const pyNext = Math.floor(cam.y + (y + 1) * tileSize);
        const size = pxNext - px;
        const sizeY = pyNext - py;

        // Атлас ещё не готов — пока заглушка цветом биома (не Bayer-dither,
        // он даёт 8-пиксельный кант который потом не перекрывается PNG-тайлами
        // и создаёт визуальный «второй слой»).
        const hbiome = BIOME_TO_HBIOME[biome];
        if (!atlasImg || !atlasMeta) {
          ctx.fillStyle = BIOME_INFO[biome].hexColor;
          ctx.fillRect(px, py, size, sizeY);
          continue;
        }
        // Вода — рисуется чистым цветом (без dither), стыковка берег↔вода
        // делается через PNG-тайл наземного биома, у которого свой край.
        if (!hbiome) {
          ctx.fillStyle = BIOME_INFO.water.hexColor;
          ctx.fillRect(px, py, size, sizeY);
          continue;
        }

        // Wang: считаем 4-угловую маску для собственного hbiome.
        const mask = computeCornerMask(x, y, hbiome, sampleHBiome);
        const srcCoords = pickTileForMask(hbiome, mask, x, y);
        if (!srcCoords) {
          // Атлас не содержит бакета даже после fallback'ов — рисуем плоским
          // цветом биома, не Bayer-dither, чтобы не создавать «второй слой».
          ctx.fillStyle = BIOME_INFO[biome].hexColor;
          ctx.fillRect(px, py, size, sizeY);
          continue;
        }
        ctx.drawImage(
          atlasImg,
          srcCoords.sx,
          srcCoords.sy,
          atlasMeta.tile_size,
          atlasMeta.tile_size,
          px,
          py,
          size,
          sizeY,
        );
      }
    }

    if (hovered) {
      const hoveredBiome = biomeAtIndex(map, config, hovered.x, hovered.y);
      const px = Math.floor(cam.x + hovered.x * tileSize);
      const py = Math.floor(cam.y + hovered.y * tileSize);
      ctx.strokeStyle = hoveredBiome === 'water' ? 'rgba(148,163,184,0.5)' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    }
  }, [config, map, hovered]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const screenToTile = useCallback((sx: number, sy: number) => {
    const cam = camRef.current;
    const tileSize = TILE_SIZE * cam.zoom;
    return {
      x: Math.floor((sx - cam.x) / tileSize),
      y: Math.floor((sy - cam.y) / tileSize),
    };
  }, []);

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

    if (wasDrag) {
      const dx = e.clientX - wasDrag.x;
      const dy = e.clientY - wasDrag.y;
      if (Math.hypot(dx, dy) < 4) {
        const t = screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        if (t.x >= 0 && t.x < config.width && t.y >= 0 && t.y < config.height) {
          const biome = biomeAtIndex(map, config, t.x, t.y);
          if (biome && biome !== 'water' && onTileClick) {
            onTileClick({ x: t.x, y: t.y, biome });
          }
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
    cam.x = cx - ((cx - cam.x) / oldZoom) * newZoom;
    cam.y = cy - ((cy - cam.y) / oldZoom) * newZoom;
    cam.zoom = newZoom;
    draw();
    forceRender((n) => n + 1);
  };

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
      cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * ratio));
      draw();
    }
  };
  const onTouchEnd = () => {
    pinchRef.current = null;
  };

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
      className="relative h-full w-full overflow-hidden bg-[#3a5060] touch-none"
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

      {hovered && (
        <div className="pointer-events-none absolute left-3 top-16 z-10 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur">
          {(() => {
            const biome = biomeAtIndex(map, config, hovered.x, hovered.y);
            const info = biome ? BIOME_INFO[biome] : null;
            return (
              <>
                <span className="font-mono">
                  ({hovered.x}, {hovered.y})
                </span>
                {info && (
                  <>
                    {' · '}
                    <span>
                      {info.emoji} {info.name}
                    </span>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
