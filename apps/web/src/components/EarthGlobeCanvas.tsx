// Глобальная карта Земли — viewer над готовым PNG-рендером.
//
// Карта (earth_preview_hq.png 3616×1816) — это сгенерированная Земля
// из больших изометрических тайлов. Виджет:
//   • рисует её на <canvas>;
//   • поверх держит логическую сетку 200×150 = 30 000 «участков»;
//   • pan/zoom с жёсткими границами: дальше fit-to-viewport не отдалить,
//     ближе ~4× nominal не приблизить, край карты не уезжает в пустоту;
//   • клик/тап → биом (суша/вода) определяется по цвету пикселя карты.

import { useCallback, useEffect, useRef, useState } from 'react';

// Узнаваемая Земля из earth_preview_hq.png (3616×1816). Состояние которое
// было одобрено пользователем до череды моих экспериментов с тайлами.
const MAP_URL = '/game/tiles/earth_preview_hq.png';

// Логическая сетка покупаемых участков. 200 × 150 = 30 000.
const GRID_W = 200;
const GRID_H = 150;
const TOTAL_TILES = GRID_W * GRID_H;

const MIN_ZOOM_MULT = 1.0;
const MAX_CELL_PX = 128;

// Бинарная классификация: суша / вода. earth_preview палитра — тёмно-зелёный
// (G > B) для суши, тёмно-синий (B > G) для воды.
export type EarthBiome = 'water' | 'land';

export interface EarthTileSelection {
  /** колонка в сетке 0..199 */
  gx: number;
  /** строка в сетке 0..149 */
  gy: number;
  /** глобальный id участка 0..29999 */
  id: number;
  biome: EarthBiome;
}

export const EARTH_BIOME_INFO: Record<
  EarthBiome,
  { name: string; emoji: string; isLand: boolean }
> = {
  water: { name: 'Океан', emoji: '🌊', isLand: false },
  land:  { name: 'Суша',  emoji: '🌳', isLand: true  },
};

// earth_preview палитра: суша = тёмно-зелёный (G > B), вода = тёмно-синий.
function classifyBiome(r: number, g: number, b: number, a: number): EarthBiome {
  if (a < 16) return 'water';
  return g > b - 4 ? 'land' : 'water';
}

interface Props {
  onTileClick?: (sel: EarthTileSelection) => void;
  /** Map<`${gx}_${gy}`, { owner, prospected, result }> — для подсветки моих участков. */
  ownedCells?: Record<string, {
    owner: 'me' | 'npc';
    prospected?: boolean;
    result?: 'oil' | 'gas' | 'empty';
  }>;
}

export function EarthGlobeCanvas({ onTileClick, ownedCells }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mapCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null);
  const [selected, setSelected] = useState<EarthTileSelection | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Камера: x/y — экранные координаты левого-верхнего угла карты;
  // zoom — текущий множитель относительно naturalWidth/Height изображения.
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  // Динамически вычисляемый zoom-fit (карта целиком влезает в viewport).
  const fitZoomRef = useRef(1);
  const dragRef = useRef({ active: false, lx: 0, ly: 0, moved: 0 });

  // --- Загрузка карты + off-screen для pixel-read ---
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        mapCtxRef.current = ctx;
      }
      setReady(true);
    };
    img.src = MAP_URL;
  }, []);

  // --- Resize observer ---
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    });
    ro.observe(wrap);
    setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);

  // --- Подгоняем zoom + центрируем карту после загрузки/ресайза ---
  useEffect(() => {
    if (!ready) return;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img || wrap.clientWidth === 0) return;
    const fit = Math.min(
      wrap.clientWidth / img.naturalWidth,
      wrap.clientHeight / img.naturalHeight,
    );
    fitZoomRef.current = fit;
    const cam = camRef.current;
    const minZ = fit * MIN_ZOOM_MULT;
    // Если zoom ещё дефолтный (или меньше min) — стартуем на minZoom по центру.
    if (cam.zoom < minZ * 0.99) {
      cam.zoom = minZ;
      cam.x = (wrap.clientWidth - img.naturalWidth * cam.zoom) / 2;
      cam.y = (wrap.clientHeight - img.naturalHeight * cam.zoom) / 2;
      clampCamera();
    } else {
      // На ресайзе — оставляем zoom, но прижимаем границы.
      clampCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, size.w, size.h]);

  // --- Bounds-clamping: карта не уезжает за viewport ---
  const clampCamera = useCallback(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;
    const cam = camRef.current;
    const dw = img.naturalWidth * cam.zoom;
    const dh = img.naturalHeight * cam.zoom;
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;

    // По X: если карта шире viewport — края не пускаем дальше краёв.
    // Если карта уже viewport — центрируем (на minZoom это норма).
    if (dw <= vw) {
      cam.x = (vw - dw) / 2;
    } else {
      cam.x = Math.min(0, Math.max(vw - dw, cam.x));
    }
    if (dh <= vh) {
      cam.y = (vh - dh) / 2;
    } else {
      cam.y = Math.min(0, Math.max(vh - dh, cam.y));
    }
  }, []);

  // --- Главный рендер ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!canvas || !wrap || !img) return;
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
    // Иконки cartoon-стиля: лёгкое сглаживание делает их мягкими,
    // не ломает hit-test (он читает оригинальный PNG через mapCtxRef).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Фон страницы
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);

    const { x, y, zoom } = camRef.current;
    const dw = img.naturalWidth * zoom;
    const dh = img.naturalHeight * zoom;
    ctx.drawImage(img, x, y, dw, dh);

    // Сетка участков отображается только при достаточном зуме, иначе
    // 30000 ячеек превращаются в кашу из линий.
    const cellPx = (dw / GRID_W); // ширина клетки в экранных пикселях
    if (cellPx > 10) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID_W; i++) {
        const px = Math.round(x + (i / GRID_W) * dw) + 0.5;
        if (px < -1 || px > w + 1) continue;
        ctx.moveTo(px, Math.max(0, y));
        ctx.lineTo(px, Math.min(h, y + dh));
      }
      for (let j = 0; j <= GRID_H; j++) {
        const py = Math.round(y + (j / GRID_H) * dh) + 0.5;
        if (py < -1 || py > h + 1) continue;
        ctx.moveTo(Math.max(0, x), py);
        ctx.lineTo(Math.min(w, x + dw), py);
      }
      ctx.stroke();
    }

    // Подсветка купленных клеток (мои = зелёный, NPC = красный).
    // Внутри клетки эмодзи-маркер если разведана (нефть/газ/пусто).
    if (ownedCells) {
      const cellW = dw / GRID_W;
      const cellH = dh / GRID_H;
      for (const key of Object.keys(ownedCells)) {
        const sep = key.indexOf('_');
        const ogx = Number(key.slice(0, sep));
        const ogy = Number(key.slice(sep + 1));
        const ox = x + ogx * cellW;
        const oy = y + ogy * cellH;
        if (ox + cellW < 0 || ox > w || oy + cellH < 0 || oy > h) continue;
        const data = ownedCells[key]!;
        if (data.owner === 'me') {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
        } else {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.30)';
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.95)';
        }
        ctx.lineWidth = Math.max(1, cellW * 0.04);
        ctx.fillRect(ox, oy, cellW, cellH);
        ctx.strokeRect(ox, oy, cellW, cellH);
        // эмодзи-маркер если разведана и cellW достаточный
        if (data.prospected && data.result && cellW > 16) {
          const icon = data.result === 'oil' ? '🛢' : data.result === 'gas' ? '💨' : '·';
          ctx.font = `${Math.floor(cellW * 0.7)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(icon, ox + cellW / 2, oy + cellH / 2);
        }
      }
    }

    // Подсветка hover
    if (hover) {
      const cellW = dw / GRID_W;
      const cellH = dh / GRID_H;
      ctx.fillStyle = 'rgba(255, 220, 120, 0.18)';
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.85)';
      ctx.lineWidth = 1.5;
      const hx = x + hover.gx * cellW;
      const hy = y + hover.gy * cellH;
      ctx.fillRect(hx, hy, cellW, cellH);
      ctx.strokeRect(hx, hy, cellW, cellH);
    }
    // Подсветка selected
    if (selected) {
      const cellW = dw / GRID_W;
      const cellH = dh / GRID_H;
      ctx.fillStyle = 'rgba(96, 250, 144, 0.22)';
      ctx.strokeStyle = 'rgba(96, 250, 144, 0.95)';
      ctx.lineWidth = 2;
      const sx = x + selected.gx * cellW;
      const sy = y + selected.gy * cellH;
      ctx.fillRect(sx, sy, cellW, cellH);
      ctx.strokeRect(sx, sy, cellW, cellH);
    }
  }, [hover, selected, ownedCells]);

  // Перерисовка при изменении hover/selected/size/ownedCells
  useEffect(() => {
    if (!ready) return;
    draw();
  }, [draw, ready, size, ownedCells]);

  // --- Утилиты: экран ↔ клетка ---
  const screenToCell = useCallback((sx: number, sy: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const { x, y, zoom } = camRef.current;
    const imgX = (sx - x) / zoom;
    const imgY = (sy - y) / zoom;
    if (imgX < 0 || imgX >= img.naturalWidth || imgY < 0 || imgY >= img.naturalHeight) {
      return null;
    }
    const gx = Math.floor((imgX / img.naturalWidth) * GRID_W);
    const gy = Math.floor((imgY / img.naturalHeight) * GRID_H);
    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return null;
    return { gx, gy, imgX: Math.floor(imgX), imgY: Math.floor(imgY) };
  }, []);

  // --- Pan ---
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lx: e.clientX, ly: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (d.active) {
      const dx = e.clientX - d.lx;
      const dy = e.clientY - d.ly;
      camRef.current.x += dx;
      camRef.current.y += dy;
      d.lx = e.clientX;
      d.ly = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      clampCamera();
      draw();
    }
    // hover
    const rect = wrap.getBoundingClientRect();
    const cell = screenToCell(e.clientX - rect.left, e.clientY - rect.top);
    if (cell) setHover({ gx: cell.gx, gy: cell.gy });
    else setHover(null);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    d.active = false;
    if (d.moved < 6) {
      const wrap = wrapRef.current;
      const mctx = mapCtxRef.current;
      if (wrap && mctx) {
        const rect = wrap.getBoundingClientRect();
        const cell = screenToCell(e.clientX - rect.left, e.clientY - rect.top);
        if (cell) {
          const data = mctx.getImageData(cell.imgX, cell.imgY, 1, 1).data;
          const biome = classifyBiome(data[0]!, data[1]!, data[2]!, data[3]!);
          const sel: EarthTileSelection = {
            gx: cell.gx,
            gy: cell.gy,
            id: cell.gy * GRID_W + cell.gx,
            biome,
          };
          setSelected(sel);
          onTileClick?.(sel);
        }
      }
    }
  };

  // --- Zoom ---
  const applyZoom = useCallback((factor: number, anchorX: number, anchorY: number) => {
    const cam = camRef.current;
    const fit = fitZoomRef.current;
    const img = imgRef.current;
    const minZ = fit * MIN_ZOOM_MULT;
    // Максимальный зум выражен через размер ячейки в экранных пикселях:
    //   cell_screen_px = (img.naturalWidth * zoom) / GRID_W
    // → zoom = MAX_CELL_PX * GRID_W / img.naturalWidth
    const maxZ = img ? (MAX_CELL_PX * GRID_W) / img.naturalWidth : minZ * 10;
    const next = Math.max(minZ, Math.min(maxZ, cam.zoom * factor));
    if (next === cam.zoom) return;
    cam.x = anchorX - ((anchorX - cam.x) * (next / cam.zoom));
    cam.y = anchorY - ((anchorY - cam.y) * (next / cam.zoom));
    cam.zoom = next;
    clampCamera();
    draw();
  }, [clampCamera, draw]);

  const onWheel = (e: React.WheelEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    applyZoom(e.deltaY > 0 ? 0.88 : 1.14, e.clientX - rect.left, e.clientY - rect.top);
  };

  // --- Pinch-zoom (для тача) ---
  const pinchRef = useRef<{ d: number; cx: number; cy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      pinchRef.current = {
        d: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        cx: (t0.clientX + t1.clientX) / 2,
        cy: (t0.clientY + t1.clientY) / 2,
      };
      dragRef.current.active = false;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const nd = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const rect = wrapRef.current!.getBoundingClientRect();
      const cx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const cy = (t0.clientY + t1.clientY) / 2 - rect.top;
      applyZoom(nd / pinchRef.current.d, cx, cy);
      pinchRef.current.d = nd;
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  const hoveredBiome: EarthBiome | null = (() => {
    if (!hover || !mapCtxRef.current || !imgRef.current) return null;
    const img = imgRef.current;
    const ix = Math.floor(((hover.gx + 0.5) / GRID_W) * img.naturalWidth);
    const iy = Math.floor(((hover.gy + 0.5) / GRID_H) * img.naturalHeight);
    const d = mapCtxRef.current.getImageData(ix, iy, 1, 1).data;
    return classifyBiome(d[0]!, d[1]!, d[2]!, d[3]!);
  })();

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full select-none overflow-hidden bg-slate-950"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'none', cursor: dragRef.current.active ? 'grabbing' : 'grab' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          Загрузка карты Земли…
        </div>
      )}
      {hover && hoveredBiome && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-200 backdrop-blur">
          Участок #{hover.gy * GRID_W + hover.gx} ·{' '}
          {EARTH_BIOME_INFO[hoveredBiome].emoji}{' '}
          {EARTH_BIOME_INFO[hoveredBiome].name}
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-200 backdrop-blur">
        {TOTAL_TILES.toLocaleString('ru-RU')} участков
      </div>
    </div>
  );
}
