import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

const MIN = 0.3;
const MAX = 2.5;

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
        return { k, x: px - (px - current.x) * f, y: py - (py - current.y) * f };
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
    setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  /** Centre un point de la carte sur un point de l'écran, sans changer l'échelle (sauf si trop petite pour lire). */
  const centreOn = useCallback((point: { x: number; y: number }, at: { x: number; y: number }) => {
    setTransform((current) => {
      const k = Math.max(current.k, 0.8);
      return { k, x: at.x - point.x * k, y: at.y - point.y * k };
    });
  }, []);

  const fit = useCallback((bounds: { x: number; y: number; width: number; height: number }, size: Size) => {
    if (!size.width || !size.height) return;
    const k = Math.min(1, size.width / bounds.width, size.height / bounds.height);
    setTransform({ k, x: -bounds.x * k + 8, y: (size.height - bounds.height * k) / 2 - bounds.y * k });
  }, []);

  return { transform, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }, dragged, centreOn, fit, setTransform };
}
