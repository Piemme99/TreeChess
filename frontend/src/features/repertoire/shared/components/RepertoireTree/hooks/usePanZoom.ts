import { useState, useCallback, useEffect, useLayoutEffect, useRef, RefObject } from 'react';
import type { ViewBox, LayoutMode } from '../utils/types';
import { DEFAULT_WIDTH, DEFAULT_HEIGHT, MIN_ZOOM, MAX_ZOOM, ROOT_OFFSET_Y } from '../constants';

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
 * Calculates the initial viewBox based on layout mode and container dimensions.
 * ViewBox aspect ratio matches the container (used with preserveAspectRatio="none").
 * Radial: centered at (0,0) with root in the middle
 * Tidy: zoomed out with root near the top
 */
function getInitialViewBox(
  layoutWidth: number,
  layoutHeight: number,
  containerWidth: number,
  containerHeight: number,
  mode: LayoutMode
): ViewBox {
  const aspect =
    containerWidth > 0 && containerHeight > 0
      ? containerWidth / containerHeight
      : DEFAULT_WIDTH / DEFAULT_HEIGHT;

  if (mode === 'radial') {
    // Fit the radial layout (square, centered at 0,0) into the container aspect ratio
    const halfSize = Math.max(layoutWidth, layoutHeight) / 2;
    let vbWidth: number, vbHeight: number;
    if (aspect >= 1) {
      vbHeight = halfSize * 2;
      vbWidth = vbHeight * aspect;
    } else {
      vbWidth = halfSize * 2;
      vbHeight = vbWidth / aspect;
    }
    return {
      x: -vbWidth / 2,
      y: -vbHeight / 2,
      width: vbWidth,
      height: vbHeight
    };
  }

  // Tidy mode: zoomed out, root near top
  const ZOOM_OUT = 1.5;
  let vbWidth = layoutWidth * ZOOM_OUT;
  let vbHeight = layoutHeight * ZOOM_OUT;

  // Adjust to match container aspect ratio
  const currentAspect = vbWidth / vbHeight;
  if (currentAspect > aspect) {
    vbHeight = vbWidth / aspect;
  } else {
    vbWidth = vbHeight * aspect;
  }

  // Center horizontally on layout, root near top
  const layoutCenterX = layoutWidth / 2;
  const topPadding = 20;

  return {
    x: layoutCenterX - vbWidth / 2,
    y: ROOT_OFFSET_Y - topPadding,
    width: vbWidth,
    height: vbHeight
  };
}

/**
 * Hook for pan and zoom functionality on an SVG element.
 * Handles mouse drag for panning and wheel events for zooming.
 * ViewBox centering depends on layout mode.
 */
export function usePanZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  layoutWidth: number,
  layoutHeight: number,
  layoutMode: LayoutMode = 'tidy'
): UsePanZoomResult {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  });

  const [viewBox, setViewBox] = useState<ViewBox>(() =>
    getInitialViewBox(layoutWidth, layoutHeight, DEFAULT_WIDTH, DEFAULT_HEIGHT, layoutMode)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const baseWidthRef = useRef(viewBox.width);
  const baseHeightRef = useRef(viewBox.height);

  // Update viewBox when layout size, mode, or container dimensions change
  useEffect(() => {
    const newViewBox = getInitialViewBox(
      layoutWidth, layoutHeight, dimensions.width, dimensions.height, layoutMode
    );
    setViewBox(newViewBox);
    setScale(1);
    baseWidthRef.current = newViewBox.width;
    baseHeightRef.current = newViewBox.height;
  }, [layoutWidth, layoutHeight, layoutMode, dimensions.width, dimensions.height]);

  // Measure container size
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
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

      // Convert mouse position to SVG coordinates
      const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
      const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

      // Calculate new viewBox dimensions
      const newWidth = baseWidthRef.current / newScale;
      const newHeight = baseHeightRef.current / newScale;

      // Keep the point under the mouse stationary
      const newX = svgX - (mouseX / rect.width) * newWidth;
      const newY = svgY - (mouseY / rect.height) * newHeight;

      setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight });
      setScale(newScale);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [svgRef, scale, viewBox]);

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
    const newViewBox = getInitialViewBox(
      layoutWidth, layoutHeight, dimensions.width, dimensions.height, layoutMode
    );
    setViewBox(newViewBox);
    setScale(1);
    baseWidthRef.current = newViewBox.width;
    baseHeightRef.current = newViewBox.height;
  }, [layoutWidth, layoutHeight, layoutMode, dimensions]);

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
