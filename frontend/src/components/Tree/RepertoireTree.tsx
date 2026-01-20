import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { RepertoireNode, Color } from '../../types';

// Layout constants
const NODE_RADIUS = 16;
const NODE_SPACING_X = 100;
const NODE_SPACING_Y = 50;
const ROOT_OFFSET_X = 60;
const ROOT_OFFSET_Y = 40;

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  node: RepertoireNode;
  depth: number;
}

interface LayoutEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function calculateLayout(root: RepertoireNode): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let maxX = 0;
  let maxY = 0;

  function layoutNode(
    node: RepertoireNode,
    depth: number,
    startY: number
  ): { height: number; centerY: number } {
    const x = ROOT_OFFSET_X + depth * NODE_SPACING_X;

    if (node.children.length === 0) {
      const y = startY + NODE_SPACING_Y / 2;
      nodes.push({ id: node.id, x, y, node, depth });
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return { height: NODE_SPACING_Y, centerY: y };
    }

    let currentY = startY;
    const childCenters: number[] = [];

    for (const child of node.children) {
      const result = layoutNode(child, depth + 1, currentY);
      childCenters.push(result.centerY);
      currentY += result.height;
    }

    const totalHeight = currentY - startY;
    const centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;

    nodes.push({ id: node.id, x, y: centerY, node, depth });
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, centerY);

    // Create edges
    for (let i = 0; i < node.children.length; i++) {
      const childNode = nodes.find((n) => n.id === node.children[i].id);
      if (childNode) {
        edges.push({
          from: { x, y: centerY },
          to: { x: childNode.x, y: childNode.y }
        });
      }
    }

    return { height: totalHeight, centerY };
  }

  layoutNode(root, 0, ROOT_OFFSET_Y);

  return {
    nodes,
    edges,
    width: maxX + NODE_RADIUS + 50,
    height: maxY + NODE_RADIUS + 50
  };
}

function createBezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x + NODE_RADIUS} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - NODE_RADIUS} ${to.y}`;
}

interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId: string | null;
  onNodeClick: (node: RepertoireNode) => void;
  color: Color;
  width?: number;
  height?: number;
}

export function RepertoireTree({
  repertoire,
  selectedNodeId,
  onNodeClick,
  color,
  width = 600,
  height = 400
}: RepertoireTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const layout = useMemo(() => calculateLayout(repertoire), [repertoire]);

  // Reset view when repertoire changes
  useEffect(() => {
    setViewBox({ x: 0, y: 0, width, height });
    setScale(1);
  }, [repertoire, width, height]);

  // Native wheel event listener
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.2, Math.min(3, scale * delta));

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
      const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

      const newWidth = width / newScale;
      const newHeight = height / newScale;

      const newX = svgX - (mouseX / rect.width) * newWidth;
      const newY = svgY - (mouseY / rect.height) * newHeight;

      setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight });
      setScale(newScale);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [scale, viewBox, width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
  }, [isDragging, dragStart, viewBox]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, width, height });
    setScale(1);
  }, [width, height]);

  const isUserMove = (node: RepertoireNode) => {
    const colorToMove = node.colorToMove;
    return (color === 'white' && colorToMove === 'w') ||
           (color === 'black' && colorToMove === 'b');
  };

  return (
    <div className="tree-container">
      <div className="tree-controls">
        <button className="tree-control-btn" onClick={resetView} title="Reset view">
          Reset
        </button>
        <span className="tree-zoom-level">{Math.round(scale * 100)}%</span>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
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

        {/* Edges */}
        <g className="tree-edges">
          {layout.edges.map((edge, i) => (
            <path
              key={i}
              d={createBezierPath(edge.from, edge.to)}
              fill="none"
              stroke="#999"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          ))}
        </g>

        {/* Nodes */}
        <g className="tree-nodes">
          {layout.nodes.map((layoutNode) => {
            const isRoot = layoutNode.node.move === null;
            const isSelected = layoutNode.id === selectedNodeId;
            const userMove = isUserMove(layoutNode.node);

            return (
              <g
                key={layoutNode.id}
                className={`tree-node ${isSelected ? 'selected' : ''} ${userMove ? 'user-move' : 'opponent-move'}`}
                onClick={() => onNodeClick(layoutNode.node)}
                style={{ cursor: 'pointer' }}
              >
                {isRoot ? (
                  <rect
                    x={layoutNode.x - NODE_RADIUS}
                    y={layoutNode.y - NODE_RADIUS}
                    width={NODE_RADIUS * 2}
                    height={NODE_RADIUS * 2}
                    rx="4"
                    fill={isSelected ? '#4a90d9' : '#666'}
                    stroke={isSelected ? '#2563eb' : '#333'}
                    strokeWidth="2"
                  />
                ) : (
                  <circle
                    cx={layoutNode.x}
                    cy={layoutNode.y}
                    r={NODE_RADIUS}
                    fill={isSelected ? '#4a90d9' : userMove ? '#dcfce7' : '#fee2e2'}
                    stroke={isSelected ? '#2563eb' : userMove ? '#22c55e' : '#ef4444'}
                    strokeWidth="2"
                  />
                )}
                <text
                  x={layoutNode.x}
                  y={layoutNode.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill={isRoot || isSelected ? '#fff' : '#333'}
                >
                  {isRoot ? 'Start' : layoutNode.node.move}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
