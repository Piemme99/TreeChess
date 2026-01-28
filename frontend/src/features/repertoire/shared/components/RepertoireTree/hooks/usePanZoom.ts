import { useState, useCallback, useEffect, useLayoutEffect, RefObject } from 'react';
import type { ViewBox } from '../utils/types';
import { DEFAULT_WIDTH, DEFAULT_HEIGHT, MIN_ZOOM, MAX_ZOOM } from '../constants';

interface Dimensions {
  width: number;
  height: number;
}

interface UsePanZoomResult {
  dimensions: Dimensions;
  viewBox: ViewBox;
  scale: number;
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  resetView: () => void;
}

/**
 * Hook for pan and zoom functionality on an SVG element.
 * Handles mouse drag for panning and wheel events for zooming.
 */
export function usePanZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>
): UsePanZoomResult {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  });
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  // Measure container size
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
        setViewBox((prev) => ({
          ...prev,
          width: prev.width === DEFAULT_WIDTH ? width : prev.width,
          height: prev.height === DEFAULT_HEIGHT ? height : prev.height
        }));
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Native wheel event listener for zooming
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * delta));

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
      const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

      const newWidth = dimensions.width / newScale;
      const newHeight = dimensions.height / newScale;

      const newX = svgX - (mouseX / rect.width) * newWidth;
      const newY = svgY - (mouseY / rect.height) * newHeight;

      setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight });
      setScale(newScale);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [svgRef, scale, viewBox, dimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = ((e.clientX - dragStart.x) / rect.width) * viewBox.width;
      const dy = ((e.clientY - dragStart.y) / rect.height) * viewBox.height;

      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [svgRef, isDragging, dragStart, viewBox]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, width: dimensions.width, height: dimensions.height });
    setScale(1);
  }, [dimensions]);

  return {
    dimensions,
    viewBox,
    scale,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView
  };
}
