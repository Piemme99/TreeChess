# Epic 5: Tree Visualization

**Objective:** Create a GitHub-style interactive tree visualization of the opening repertoire

**Status:** Not Started  
**Dependencies:** Epic 4b (Board Component) for integration

---

## 1. Objective

Create a tree visualization component that:
- Displays the repertoire as an interactive tree
- Uses GitHub-style layout (left to right, branches diverge)
- Supports zoom and pan
- Allows node selection (click)
- Shows move notation on nodes
- Handles deep trees efficiently
- Updates in real-time as repertoire changes

---

## 2. Definition of Done

- [ ] Tree renders correctly from repertoire data
- [ ] Layout algorithm positions nodes properly
- [ ] Nodes display move notation (SAN)
- [ ] Click on node selects it
- [ ] Tree updates when repertoire changes
- [ ] Zoom in/out works
- [ ] Pan/drag works
- [ ] Root node is clearly identified
- [ ] Branches are visually distinct
- [ ] Performance is acceptable with 100+ nodes

---

## 3. Tasks

### 3.1 Tree Data Structure

**File: `src/components/Tree/treeTypes.ts`**

```typescript
import { RepertoireNode } from '../../services/api';

export interface TreeNodeData {
  id: string;
  san: string | null;
  fen: string;
  moveNumber: number;
  colorToMove: 'w' | 'b';
  children: TreeNodeData[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  san: string | null;
  moveNumber: number;
  isRoot: boolean;
  isSelected: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  path: string;
}

export function repertoireNodeToTreeNode(node: RepertoireNode): TreeNodeData {
  return {
    id: node.id,
    san: node.move,
    fen: node.fen,
    moveNumber: node.moveNumber,
    colorToMove: node.colorToMove,
    children: node.children.map(repertoireNodeToTreeNode),
  };
}
```

### 3.2 Tree Layout Algorithm

**File: `src/components/Tree/treeLayout.ts`**

```typescript
import { TreeNodeData, TreeLayout, LayoutNode, LayoutEdge } from './treeTypes';

const NODE_RADIUS = 16;
const NODE_SPACING_X = 80;
const NODE_SPACING_Y = 50;
const ROOT_OFFSET_X = 60;

export function computeTreeLayout(root: TreeNodeData): TreeLayout {
  // First pass: compute subtree sizes and initial positions
  const nodeMap = new Map<string, LayoutNode>();
  const edgeList: LayoutEdge[] = [];

  // Compute subtree heights
  const heights = computeSubtreeHeights(root);

  // Second pass: assign positions
  let nextX = ROOT_OFFSET_X;
  
  function layoutNode(node: TreeNodeData, depth: number, yOffset: number): void {
    const nodeHeight = heights.get(node.id) || 1;
    const y = yOffset + (nodeHeight - 1) * NODE_SPACING_Y / 2;

    const layoutNode: LayoutNode = {
      id: node.id,
      x: nextX,
      y: y,
      san: node.san,
      moveNumber: node.moveNumber,
      isRoot: node.san === null,
      isSelected: false,
    };

    nodeMap.set(node.id, layoutNode);

    // Position children
    if (node.children.length > 0) {
      nextX += NODE_SPACING_X;
      
      let childYOffset = y - ((node.children.length - 1) * NODE_SPACING_Y) / 2;
      
      for (const child of node.children) {
        layoutNode(child, depth + 1, childYOffset);
        
        // Create edge
        edgeList.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          path: computeEdgePath(
            nodeMap.get(node.id)!,
            nodeMap.get(child.id)!
          ),
        });
        
        childYOffset += NODE_SPACING_Y;
      }
      nextX += NODE_SPACING_X;
    }
  }

  layoutNode(root, 0, 0);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: edgeList,
  };
}

function computeSubtreeHeights(node: TreeNodeData): Map<string, number> {
  const heights = new Map<string, number>();

  function computeHeight(n: TreeNodeData): number {
    if (n.children.length === 0) {
      heights.set(n.id, 1);
      return 1;
    }

    let maxHeight = 0;
    for (const child of n.children) {
      maxHeight = Math.max(maxHeight, computeHeight(child));
    }

    heights.set(n.id, maxHeight);
    return maxHeight;
  }

  computeHeight(node);
  return heights;
}

function computeEdgePath(source: LayoutNode, target: LayoutNode): string {
  // Cubic Bézier curve
  const control1X = source.x + NODE_SPACING_X / 2;
  const control1Y = source.y;
  const control2X = target.x - NODE_SPACING_X / 2;
  const control2Y = target.y;

  return `M ${source.x} ${source.y} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${target.x} ${target.y}`;
}
```

### 3.3 Tree Visualization Component

**File: `src/components/Tree/RepertoireTree.tsx`**

```typescript
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { RepertoireNode } from '../../services/api';
import { repertoireNodeToTreeNode, TreeLayout } from './treeTypes';
import { computeTreeLayout } from './treeLayout';
import './Tree.css';

interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId?: string | null;
  onNodeClick?: (node: RepertoireNode) => void;
  width?: number;
  height?: number;
}

export function RepertoireTree({
  repertoire,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 400,
}: RepertoireTreeProps) {
  const treeNode = useMemo(() => repertoireNodeToTreeNode(repertoire), [repertoire]);
  const layout = useMemo(() => computeTreeLayout(treeNode), [treeNode]);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Update selected state in layout nodes
  const nodesWithSelection = layout.nodes.map((node) => ({
    ...node,
    isSelected: node.id === selectedNodeId,
  }));

  const edgesWithSelection = layout.edges;

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(Math.max(z * delta, 0.2), 3));
    }
  };

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    // Find the original repertoire node
    const findNode = (node: RepertoireNode, id: string): RepertoireNode | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };

    const clickedNode = findNode(repertoire, nodeId);
    if (clickedNode && onNodeClick) {
      onNodeClick(clickedNode);
    }
  };

  // Reset view
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Calculate viewBox
  const viewBoxX = -width / 2;
  const viewBoxY = -height / 2;
  const viewBoxW = width;
  const viewBoxH = height;

  return (
    <div className="repertoire-tree">
      <div className="tree-controls">
        <button onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}>+</button>
        <button onClick={() => setZoom((z) => Math.max(z * 0.8, 0.2))}>-</button>
        <button onClick={handleReset}>Reset</button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render edges */}
          {edgesWithSelection.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              className="tree-edge"
              fill="none"
              stroke="#bdbdbd"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          ))}

          {/* Render nodes */}
          {nodesWithSelection.map((node) => (
            <g
              key={node.id}
              className={`tree-node ${node.isSelected ? 'tree-node--selected' : ''} ${
                node.isRoot ? 'tree-node--root' : ''
              }`}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => handleNodeClick(node.id)}
            >
              {node.isRoot ? (
                <rect
                  x="-16"
                  y="-16"
                  width="32"
                  height="32"
                  rx="4"
                  className="tree-node-shape tree-node-shape--root"
                />
              ) : (
                <circle
                  r="14"
                  className={`tree-node-shape ${
                    node.isSelected ? 'tree-node-shape--selected' : ''
                  }`}
                />
              )}
              
              {/* Move label */}
              {node.san && (
                <text
                  y="4"
                  className="tree-node-label"
                  textAnchor="middle"
                >
                  {node.san}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* Arrowhead marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#bdbdbd" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
```

### 3.4 Tree CSS

**File: `src/components/Tree/Tree.css`**

```css
.repertoire-tree {
  width: 100%;
  height: 100%;
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tree-controls {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  z-index: 10;
}

.tree-controls button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-controls button:hover {
  background: var(--color-bg);
}

.tree-node {
  cursor: pointer;
  transition: transform 0.1s;
}

.tree-node:hover {
  transform: scale(1.1);
}

.tree-node-shape {
  fill: #e8e8e8;
  stroke: #bdbdbd;
  stroke-width: 1;
  transition: fill 0.2s, stroke 0.2s;
}

.tree-node-shape--root {
  fill: #333;
  stroke: #333;
}

.tree-node-shape--selected {
  fill: #4a90d9;
  stroke: #2a70c9;
  stroke-width: 2;
}

.tree-node-label {
  font-size: 10px;
  fill: #333;
  font-weight: 500;
  pointer-events: none;
}

.tree-node--selected .tree-node-label {
  fill: #fff;
  font-weight: 700;
}

.tree-edge {
  transition: stroke 0.2s;
}

.tree-edge:hover {
  stroke: #4a90d9;
}

/* Hide arrowheads on selected edges if needed */
.tree-node--selected ~ .tree-edge {
  /* Styles for edges connected to selected node */
}

/* Loading state */
.repertoire-tree--loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 4. Usage Example

```typescript
import { RepertoireTree } from './components/Tree/RepertoireTree';

function RepertoireEditPage() {
  const { whiteRepertoire } = useRepertoireStore();
  const { selectedNode, setSelectedNode } = useRepertoireStore();

  if (!whiteRepertoire) return null;

  return (
    <div className="repertoire-edit">
      <RepertoireTree
        repertoire={whiteRepertoire.treeData}
        selectedNodeId={selectedNode?.id}
        onNodeClick={(node) => setSelectedNode(node)}
        width={800}
        height={500}
      />
    </div>
  );
}
```

---

## 5. Performance Considerations

### 5.1 Lazy Rendering

For very large trees (>500 nodes), consider:
- Virtualization (render only visible nodes)
- Level-based expansion (collapse deep levels)
- Web Workers for layout computation

### 5.2 Memoization

The layout computation is memoized with `useMemo` to avoid recalculating on every render.

### 5.3 SVG vs Canvas

For MVP, using SVG for easier interaction handling. For very large trees, consider Canvas rendering.

---

## 6. Dependencies to Other Epics

- Board Component (Epic 4b) displays position when node is selected
- Repertoire CRUD (Epic 6) provides repertoire data
- Frontend Core (Epic 4) provides component structure

---

## 7. Notes

### 7.1 Layout Algorithm

The current algorithm uses a simple approach:
- Root at left
- Children spread vertically
- Branches spread horizontally

This works well for typical opening trees (10-50 nodes). For larger trees, consider:
- Walker's algorithm for uniform subtrees
- D3.js hierarchy layout
- React Flow for more complex layouts

### 7.2 Node Labels

SAN notation is displayed on nodes. For very long moves (like `exd5=Q`), consider truncation or tooltip.

### 7.3 Zoom/Pan

Basic zoom/pan is implemented. For production, consider:
- D3-zoom for smoother interactions
- Min/max zoom constraints
- Touch support for mobile
