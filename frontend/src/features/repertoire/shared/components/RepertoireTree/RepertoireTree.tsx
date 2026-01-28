import { useRef, useMemo } from 'react';
import type { RepertoireNode, Color } from '../../../../../types';
import { calculateLayout } from './utils/layoutCalculator';
import { usePanZoom } from './hooks/usePanZoom';
import { TreeEdge } from './components/TreeEdge';
import { TreeNode } from './components/TreeNode';
import { TreeControls } from './components/TreeControls';

interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId: string | null;
  onNodeClick: (node: RepertoireNode) => void;
  color: Color;
}

export function RepertoireTree({
  repertoire,
  selectedNodeId,
  onNodeClick
}: RepertoireTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const {
    viewBox,
    scale,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView
  } = usePanZoom(containerRef, svgRef);

  const layout = useMemo(() => calculateLayout(repertoire), [repertoire]);

  return (
    <div className="tree-container" ref={containerRef}>
      <TreeControls scale={scale} onReset={resetView} />
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
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
