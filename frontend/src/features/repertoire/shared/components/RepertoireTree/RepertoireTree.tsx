import { useRef, useMemo, useState, useCallback } from 'react';
import type { RepertoireNode, Color } from '../../../../../types';
import { calculateLayout } from './utils/layoutCalculator';
import { usePanZoom } from './hooks/usePanZoom';
import { TreeEdge } from './components/TreeEdge';
import { TreeNode } from './components/TreeNode';
import { TreeControls } from './components/TreeControls';
import { ChessBoard } from '../../../../../shared/components/Board/ChessBoard';
import type { LayoutNode } from './utils/types';
import { NODE_RADIUS } from './constants';

interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId: string | null;
  onNodeClick: (node: RepertoireNode) => void;
  color: Color;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function RepertoireTree({
  repertoire,
  selectedNodeId,
  onNodeClick,
  color,
  isExpanded,
  onToggleExpand
}: RepertoireTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const {
    viewBox,
    scale,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView
  } = usePanZoom(containerRef, svgRef);

  const layout = useMemo(() => calculateLayout(repertoire), [repertoire]);

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
    <div className="tree-container" ref={containerRef}>
      <TreeControls scale={scale} onReset={resetView} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="tree-svg"
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
        </defs>

        <g className="tree-edges">
          {layout.edges.map((edge, i) => (
            <TreeEdge key={i} edge={edge} />
          ))}
        </g>

        <g className="tree-nodes">
          {layout.nodes.map((layoutNode) => (
            <TreeNode
              key={layoutNode.id}
              layoutNode={layoutNode}
              selectedNodeId={selectedNodeId}
              onClick={onNodeClick}
              onMouseEnter={handleNodeMouseEnter}
              onMouseLeave={handleNodeMouseLeave}
            />
          ))}
        </g>
      </svg>

      {hoveredNode && !isDragging && previewStyle && (
        <div
          className="tree-board-preview"
          style={{
            position: 'absolute',
            left: previewStyle.left,
            top: previewStyle.top,
            pointerEvents: 'none',
          }}
        >
          {hoveredNode.node.comment && (
            <div className="tree-board-preview-comment">
              {hoveredNode.node.comment}
            </div>
          )}
          <ChessBoard
            fen={hoveredNode.node.fen}
            width={150}
            interactive={false}
            orientation={color}
          />
        </div>
      )}
    </div>
  );
}
