import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface Transform {
  x: number;
  y: number;
  k: number;
  /** Un recadrage demandé glisse ; le glisser et la molette suivent le pointeur sans délai. */
  animate?: boolean;
}

const MIN = 0.3;
const MAX = 2.5;
const MARGIN = 24;
/** La bande du bas où se posent la légende et les commandes : rien d'utile ne doit y finir. */
export const BOTTOM_BAR = 44;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Glisser pour déplacer, molette pour zoomer autour du pointeur ; un clic qui a glissé n'est pas un clic. */
export function usePanZoom(ref: RefObject<HTMLElement | null>) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      setTransform((current) => {
        const k = Math.min(MAX, Math.max(MIN, current.k * Math.exp(-event.deltaY * 0.0018)));
        const f = k / current.k;
        return { k, x: px - (px - current.x) * f, y: py - (py - current.y) * f, animate: false };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [ref]);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    dragged.current = false;
  }, []);

  // La capture n'arrive qu'une fois le glissement avéré : capturée au pointerdown, elle retargète le clic vers le SVG.
  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) event.currentTarget.setPointerCapture(event.pointerId);
    start.moved = true;
    dragged.current = true;
    drag.current = { x: event.clientX, y: event.clientY, moved: true };
    setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy, animate: false }));
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  /**
   * Montre une boîte de la carte (le chemin vers un nœud) en bougeant le moins possible : on dézoome
   * jusqu'à `floor` s'il le faut, puis on décale juste assez pour la faire entrer dans le cadre.
   */
  const reveal = useCallback((box: Box, size: Size, floor = 0.55) => {
    if (!size.width || !size.height) return;
    setTransform((current) => {
      const room = { width: size.width - 2 * MARGIN, height: size.height - 2 * MARGIN - BOTTOM_BAR };
      const k = Math.max(Math.min(current.k, room.width / box.width, room.height / box.height), Math.min(floor, current.k));
      // Trop grande pour le cadre, la boîte garde sa fin : le nœud visé.
      const fitAxis = (start: number, length: number, offset: number, from: number, available: number) => {
        const low = start * k + offset;
        const high = (start + length) * k + offset;
        if (high - low > available) return offset + (from + available - high);
        if (low < from) return offset + (from - low);
        if (high > from + available) return offset - (high - from - available);
        return offset;
      };
      const f = k / current.k;
      const x = size.width / 2 - (size.width / 2 - current.x) * f;
      const y = size.height / 2 - (size.height / 2 - current.y) * f;
      return {
        k,
        x: fitAxis(box.x, box.width, x, MARGIN, room.width),
        y: fitAxis(box.y, box.height, y, MARGIN, room.height),
        animate: true,
      };
    });
  }, []);

  const zoomBy = useCallback((factor: number, size: Size) => {
    setTransform((current) => {
      const k = Math.min(MAX, Math.max(MIN, current.k * factor));
      const f = k / current.k;
      const px = size.width / 2;
      const py = size.height / 2;
      return { k, x: px - (px - current.x) * f, y: py - (py - current.y) * f, animate: true };
    });
  }, []);

  // Au-dessous de `floor`, les étiquettes ne se lisent plus : on garde l'échelle et on cale la carte à gauche, sur le départ.
  const fit = useCallback((bounds: Box, size: Size, floor = 0.8) => {
    if (!size.width || !size.height) return;
    const height = size.height - BOTTOM_BAR;
    const k = Math.min(1, Math.max(Math.min(size.width / bounds.width, height / bounds.height), floor));
    setTransform({ k, x: -bounds.x * k + 8, y: (height - bounds.height * k) / 2 - bounds.y * k, animate: true });
  }, []);

  return { transform, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }, dragged, reveal, zoomBy, fit, setTransform };
}
