import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { RepertoireNode, Color } from '../../../../../types';
import { calculateLayout } from './utils/layoutCalculator';
import { usePanZoom } from './hooks/usePanZoom';
import { TreeEdge } from './components/TreeEdge';
import { TreeNode } from './components/TreeNode';
import { TreeControls } from './components/TreeControls';
import { StaticBoard } from '../../../../../shared/components/Board/StaticBoard';
import type { LayoutNode, LayoutMode } from './utils/types';
import { NODE_RADIUS, BRANCH_COLORS } from './constants';

interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId: string | null;
  onNodeClick: (node: RepertoireNode) => void;
  color: Color;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onToggleCollapsed?: (nodeId: string) => void;
  onExpandToNode?: (nodeId: string) => Promise<void>;
}

// Helper to collect collapsed node IDs from tree
function collectCollapsedNodes(node: RepertoireNode, result: Set<string>): void {
  if (node.collapsed) {
    result.add(node.id);
  }
  for (const child of node.children) {
    collectCollapsedNodes(child, result);
  }
}

export function RepertoireTree({
  repertoire,
  selectedNodeId,
  onNodeClick,
  color,
  isExpanded,
  onToggleExpand,
  onToggleCollapsed,
  onExpandToNode
}: RepertoireTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout mode state - tidy (top-to-bottom) is the default
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tidy');

  const handleToggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => (prev === 'radial' ? 'tidy' : 'radial'));
  }, []);

  // Calculate collapsed nodes from repertoire data
  const collapsedNodes = useMemo(() => {
    const result = new Set<string>();
    collectCollapsedNodes(repertoire, result);
    return result;
  }, [repertoire]);

  const layout = useMemo(
    () => calculateLayout(repertoire, collapsedNodes, layoutMode),
    [repertoire, collapsedNodes, layoutMode]
  );

  const {
    viewBox,
    scale,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView,
    focusOnNode
  } = usePanZoom(containerRef, svgRef, layout.width, layout.height, layoutMode);

  const handleNodeDoubleClick = useCallback(
    (node: RepertoireNode) => {
      if (node.children.length === 0) return;
      if (onToggleCollapsed) {
        onToggleCollapsed(node.id);
      }
    },
    [onToggleCollapsed]
  );

  const pendingFocusRef = useRef<string | null>(null);

  const handleFocusSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const selectedLayout = layout.nodes.find((n) => n.id === selectedNodeId);
    if (selectedLayout) {
      focusOnNode(selectedLayout.x, selectedLayout.y);
    } else if (onExpandToNode) {
      pendingFocusRef.current = selectedNodeId;
      onExpandToNode(selectedNodeId);
    }
  }, [selectedNodeId, layout.nodes, focusOnNode, onExpandToNode]);

  // When layout updates and a pending focus node appears, focus on it
  useEffect(() => {
    const pendingId = pendingFocusRef.current;
    if (!pendingId) return;
    const node = layout.nodes.find((n) => n.id === pendingId);
    if (node) {
      pendingFocusRef.current = null;
      focusOnNode(node.x, node.y);
    }
  }, [layout.nodes, focusOnNode]);

  // Clear pending focus if selected node changes
  useEffect(() => {
    if (pendingFocusRef.current && pendingFocusRef.current !== selectedNodeId) {
      pendingFocusRef.current = null;
    }
  }, [selectedNodeId]);

  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

  const handleNodeMouseEnter = useCallback((layoutNode: LayoutNode) => {
    setHoveredNode(layoutNode);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const previewStyle = useMemo(() => {
    if (!hoveredNode || isDragging || !svgRef.current || !containerRef.current) return null;

    const svg = svgRef.current;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Convert from SVG coordinates to screen pixels
    const pixelX = ((hoveredNode.x - viewBox.x) / viewBox.width) * svg.clientWidth;
    const pixelY = ((hoveredNode.y - viewBox.y) / viewBox.height) * svg.clientHeight;

    const previewSize = 150;
    const offset = ((NODE_RADIUS * 2) / viewBox.width) * svg.clientWidth + 8;

    let left = pixelX + offset;
    let top = pixelY - previewSize / 2;

    // Flip to left side if overflowing right
    if (left + previewSize > containerWidth) {
      left = pixelX - offset - previewSize;
    }

    // Clamp vertically
    if (top < 4) top = 4;
    if (top + previewSize > containerHeight - 4) top = containerHeight - 4 - previewSize;

    return { left, top } as const;
  }, [hoveredNode, isDragging, viewBox]);

  return (
    <div className="flex-1 relative overflow-hidden" ref={containerRef}>
      <TreeControls
        scale={scale}
        onReset={resetView}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        layoutMode={layoutMode}
        onToggleLayoutMode={handleToggleLayoutMode}
        onFocusSelected={selectedNodeId ? handleFocusSelected : undefined}
      />
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        className="tree-svg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#999" />
          </marker>
          <marker
            id="arrowhead-mainline"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#E67E22" />
          </marker>
          {BRANCH_COLORS.map((c) => (
            <marker
              key={c.id}
              id={`arrowhead-branch-${c.hex.slice(1)}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={c.hex} />
            </marker>
          ))}
        </defs>

        <g>
          {layout.edges.map((edge) => (
            <TreeEdge key={edge.id} edge={edge} layoutMode={layoutMode} />
          ))}
        </g>

        <g>
          {layout.nodes.map((layoutNode) => (
            <TreeNode
              key={layoutNode.id}
              layoutNode={layoutNode}
              isSelected={layoutNode.id === selectedNodeId}
              onClick={onNodeClick}
              onDoubleClick={handleNodeDoubleClick}
              onMouseEnter={handleNodeMouseEnter}
              onMouseLeave={handleNodeMouseLeave}
            />
          ))}
        </g>
      </svg>

      {hoveredNode && !isDragging && previewStyle && (
        <div
          className="absolute z-20 rounded-md shadow-lg border border-border overflow-hidden pointer-events-none"
          style={{
            left: previewStyle.left,
            top: previewStyle.top,
          }}
        >
          {hoveredNode.node.comment && (
            <div className="py-1 px-2 text-xs leading-snug text-text bg-bg-card max-w-[150px] break-words border-b border-border">
              {hoveredNode.node.comment}
            </div>
          )}
          <div className="w-[150px] h-[150px]">
            <StaticBoard
              fen={hoveredNode.node.fen}
              orientation={color}
            />
          </div>
        </div>
      )}
    </div>
  );
}
