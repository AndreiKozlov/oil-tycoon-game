import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BIOME_INFO,
  getAllUniqueTilePaths,
  KNOWN_SHORE_CODES,
  pickBiomeTile,
  pickShoreTileTx,
  type Biome,
  type ShoreCode,
  type TileTransform,
} from '../lib/biomeMap';
import { DEFAULT_MAP, generateMap, biomeAtIndex, type MapConfig } from '../lib/proceduralMap';

const TILE_PX = 32;
// MIN_ZOOM достаточно мал, чтобы увидеть всю карту 452×227 на экране.
// На FullHD: 1920 / (452*32) ≈ 0.13, поэтому 0.1 даёт «вид с орбиты».
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

const CYAN_KEY = { r: 0, g: 255, b: 255 };

export interface TileSelection {
  x: number;
  y: number;
  biome: Biome;
}

interface Props {
  config?: MapConfig;
  onTileClick?: (sel: TileSelection) => void;
}

function isLand(b: Biome | null): boolean {
  if (b === null) return false;
  return b !== 'water';
}

function cornerCode(
  map: Biome[],
  cfg: MapConfig,
  x: number,
  y: number,
  corner: 'TL' | 'TR' | 'BL' | 'BR',
): 'L' | 'W' {
  const dx = corner === 'TR' || corner === 'BR' ? 1 : -1;
  const dy = corner === 'BL' || corner === 'BR' ? 1 : -1;
  const n1 = biomeAtIndex(map, cfg, x + dx, y);
  const n2 = biomeAtIndex(map, cfg, x, y + dy);
  const n3 = biomeAtIndex(map, cfg, x + dx, y + dy);
  return isLand(n1) || isLand(n2) || isLand(n3) ? 'L' : 'W';
}

// KNOWN_SHORE_CODES импортирован из biomeMap (теперь покрывает все 15).

function waterWangCode(
  map: Biome[],
  cfg: MapConfig,
  x: number,
  y: number,
): ShoreCode | null {
  const tl = cornerCode(map, cfg, x, y, 'TL');
  const tr = cornerCode(map, cfg, x, y, 'TR');
  const bl = cornerCode(map, cfg, x, y, 'BL');
  const br = cornerCode(map, cfg, x, y, 'BR');
  const code = `${tl}${tr}${bl}${br}`;
  if (code === 'WWWW') return null;
  return (KNOWN_SHORE_CODES as readonly string[]).includes(code) ? (code as ShoreCode) : null;
}

async function loadTileImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] === CYAN_KEY.r && px[i + 1] === CYAN_KEY.g && px[i + 2] === CYAN_KEY.b) {
            px[i + 3] = 0;
          }
        }
        ctx.putImageData(data, 0, 0);
        const converted = new Image();
        converted.onload = () => resolve(converted);
        converted.onerror = () => resolve(img);
        converted.src = canvas.toDataURL();
      } catch {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load ${path}`));
    img.src = path;
  });
}

export function WorldMapCanvas({ config = DEFAULT_MAP, onTileClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [spritesLoaded, setSpritesLoaded] = useState(false);

  const map = useMemo(() => generateMap(config), [config]);

  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [, forceRender] = useState(0);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Стартовый zoom — такой, чтобы вся карта влезала по высоте
    // с небольшим запасом (90%).
    const fitZoomW = wrap.clientWidth / (config.width * TILE_PX);
    const fitZoomH = wrap.clientHeight / (config.height * TILE_PX);
    const startZoom = Math.max(MIN_ZOOM, Math.min(fitZoomW, fitZoomH) * 0.95);
    camRef.current.zoom = startZoom;
    // Центруем карту.
    const tileSize = TILE_PX * startZoom;
    camRef.current.x = (wrap.clientWidth - config.width * tileSize) / 2;
    camRef.current.y = (wrap.clientHeight - config.height * tileSize) / 2;
    forceRender((n) => n + 1);
  }, [config.width, config.height]);

  useEffect(() => {
    let cancelled = false;
    const paths = getAllUniqueTilePaths();
    let loaded = 0;
    paths.forEach((path) => {
      loadTileImage(path)
        .then((img) => {
          if (cancelled) return;
          spriteCacheRef.current.set(path, img);
        })
        .catch(() => {})
        .finally(() => {
          loaded += 1;
          if (loaded === paths.length && !cancelled) setSpritesLoaded(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

    ctx.fillStyle = BIOME_INFO.water.hexColor;
    ctx.fillRect(0, 0, w, h);

    const cam = camRef.current;
    const tileSize = TILE_PX * cam.zoom;

    const startX = Math.max(0, Math.floor(-cam.x / tileSize));
    const startY = Math.max(0, Math.floor(-cam.y / tileSize));
    const endX = Math.min(config.width, Math.ceil((w - cam.x) / tileSize) + 1);
    const endY = Math.min(config.height, Math.ceil((h - cam.y) / tileSize) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const biome = biomeAtIndex(map, config, x, y);
        if (!biome) continue;
        const px = Math.floor(cam.x + x * tileSize);
        const py = Math.floor(cam.y + y * tileSize);
        const size = Math.ceil(tileSize);

        let basePath: string;
        let transform: TileTransform = 'none';
        if (biome === 'water') {
          const code = waterWangCode(map, config, x, y);
          if (code) {
            const sel = pickShoreTileTx(code, x, y);
            basePath = sel.path;
            transform = sel.transform;
          } else {
            basePath = pickBiomeTile('water', x, y);
          }
        } else {
          basePath = pickBiomeTile(biome, x, y);
        }
        const sprite = spriteCacheRef.current.get(basePath);

        // Под прозрачные части тайлов (cyan-keyed) подкладываем чистую воду.
        if (biome === 'water') {
          ctx.fillStyle = BIOME_INFO.water.hexColor;
          ctx.fillRect(px, py, size, size);
        }

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          if (transform === 'none') {
            ctx.drawImage(sprite, px, py, size, size);
          } else {
            // Применяем flip/rotate относительно центра тайла.
            ctx.save();
            ctx.translate(px + size / 2, py + size / 2);
            if (transform === 'flipH') ctx.scale(-1, 1);
            else if (transform === 'flipV') ctx.scale(1, -1);
            else if (transform === 'rotate180') ctx.scale(-1, -1);
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = BIOME_INFO[biome].hexColor;
          ctx.fillRect(px, py, size, size);
        }
      }
    }

    if (hovered) {
      const hoveredBiome = biomeAtIndex(map, config, hovered.x, hovered.y);
      const px = Math.floor(cam.x + hovered.x * tileSize);
      const py = Math.floor(cam.y + hovered.y * tileSize);
      // Жёлтая рамка для суши (кликабельно), серая полупрозрачная для воды.
      ctx.strokeStyle = hoveredBiome === 'water' ? 'rgba(148,163,184,0.5)' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    }
  }, [config, map, spritesLoaded, hovered]);

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
    const tileSize = TILE_PX * cam.zoom;
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
          // Вода не кликабельна — её нельзя купить.
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

      {!spritesLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Загрузка карты…
        </div>
      )}
    </div>
  );
}
