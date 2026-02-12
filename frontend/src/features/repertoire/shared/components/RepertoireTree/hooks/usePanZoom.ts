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
  focusOnNode: (nodeX: number, nodeY: number) => void;
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
 *
 * Performance note: viewBox, scale, isDragging, and dragStart are stored in
 * refs so that event handlers (wheel, mousemove) don't need to be recreated
 * on every frame. The viewBox state is kept in sync for React re-renders
 * (SVG viewBox attribute), while refs are used inside handlers to avoid
 * tearing down and re-attaching listeners on every zoom/pan tick.
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

  // Refs for values read inside event handlers — avoids listener re-subscription
  const viewBoxRef = useRef(viewBox);
  const scaleRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const baseWidthRef = useRef(viewBox.width);
  const baseHeightRef = useRef(viewBox.height);

  // Keep viewBoxRef in sync with state (for event handlers to read latest value)
  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  // Update viewBox when layout size, mode, or container dimensions change
  useEffect(() => {
    const newViewBox = getInitialViewBox(
      layoutWidth, layoutHeight, dimensions.width, dimensions.height, layoutMode
    );
    setViewBox(newViewBox);
    viewBoxRef.current = newViewBox;
    scaleRef.current = 1;
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

  // Native wheel event listener for zooming — attached once (deps: [svgRef] only)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentScale = scaleRef.current;
      const currentViewBox = viewBoxRef.current;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentScale * delta));

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert mouse position to SVG coordinates
      const svgX = currentViewBox.x + (mouseX / rect.width) * currentViewBox.width;
      const svgY = currentViewBox.y + (mouseY / rect.height) * currentViewBox.height;

      // Calculate new viewBox dimensions
      const newWidth = baseWidthRef.current / newScale;
      const newHeight = baseHeightRef.current / newScale;

      // Keep the point under the mouse stationary
      const newX = svgX - (mouseX / rect.width) * newWidth;
      const newY = svgY - (mouseY / rect.height) * newHeight;

      const newViewBox = { x: newX, y: newY, width: newWidth, height: newHeight };
      viewBoxRef.current = newViewBox;
      scaleRef.current = newScale;
      setViewBox(newViewBox);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [svgRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentViewBox = viewBoxRef.current;
      const currentDragStart = dragStartRef.current;

      const dx = ((e.clientX - currentDragStart.x) / rect.width) * currentViewBox.width;
      const dy = ((e.clientY - currentDragStart.y) / rect.height) * currentViewBox.height;

      const newViewBox = {
        ...currentViewBox,
        x: currentViewBox.x - dx,
        y: currentViewBox.y - dy
      };
      viewBoxRef.current = newViewBox;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setViewBox(newViewBox);
    },
    [svgRef]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const resetView = useCallback(() => {
    const newViewBox = getInitialViewBox(
      layoutWidth, layoutHeight, dimensions.width, dimensions.height, layoutMode
    );
    viewBoxRef.current = newViewBox;
    scaleRef.current = 1;
    baseWidthRef.current = newViewBox.width;
    baseHeightRef.current = newViewBox.height;
    setViewBox(newViewBox);
  }, [layoutWidth, layoutHeight, layoutMode, dimensions]);

  const focusOnNode = useCallback((nodeX: number, nodeY: number) => {
    const targetScale = 2.5;
    const newWidth = baseWidthRef.current / targetScale;
    const newHeight = baseHeightRef.current / targetScale;
    const newViewBox = {
      x: nodeX - newWidth / 2,
      y: nodeY - newHeight / 2,
      width: newWidth,
      height: newHeight
    };
    viewBoxRef.current = newViewBox;
    scaleRef.current = targetScale;
    setViewBox(newViewBox);
  }, []);

  return {
    dimensions,
    viewBox,
    scale: scaleRef.current,
    isDragging: isDraggingRef.current,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView,
    focusOnNode
  };
}
