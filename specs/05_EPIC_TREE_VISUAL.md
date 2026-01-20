# Epic 5: Tree Visualization

**Objective:** Create a GitHub-style interactive tree visualization of the opening repertoire using SVG.

---

## Definition of Done

- [ ] Tree renders correctly from repertoire data
- [ ] Layout algorithm positions nodes properly without overlap
- [ ] Nodes display move notation (SAN)
- [ ] Click on node selects it
- [ ] Tree updates when repertoire changes
- [ ] Zoom in/out works with mouse wheel
- [ ] Pan/drag works with mouse drag
- [ ] Root node is visually distinct
- [ ] Branches are visually distinct with Bézier curves
- [ ] Performance acceptable with 100+ nodes

---

## Tickets

### TREE-001: Design tree data structures
**Description:** Define TypeScript interfaces for tree layout computation.
**Acceptance:**
- [ ] TreeNodeData interface
- [ ] TreeLayout interface
- [ ] LayoutNode interface
- [ ] LayoutEdge interface
- [ ] Helper function to convert RepertoireNode to TreeNodeData
**Dependencies:** None

### TREE-002: Implement layout algorithm
**Description:** Calculate positions for tree nodes using subtree heights.
**Acceptance:**
- [ ] Root positioned at left edge
- [ ] Children spread vertically
- [ ] Subtree heights calculated recursively
- [ ] No overlapping nodes
- [ ] Consistent spacing between levels
- [ ] Bézier curves for edges
**Dependencies:** TREE-001

### TREE-003: Render SVG tree
**Description:** Display tree using SVG with nodes and edges.
**Acceptance:**
- [ ] All nodes rendered as circles/rects
- [ ] SAN notation displayed on nodes
- [ ] Edges rendered as SVG paths
- [ ] Arrowheads on edges
- [ ] Root node visually distinct (square)
- [ ] Selected node highlighted
**Dependencies:** TREE-002

### TREE-004: Implement zoom and pan
**Description:** Add interactive controls for navigating large trees.
**Acceptance:**
- [ ] Mouse wheel zooms in/out
- [ ] Ctrl+wheel prevents page scroll
- [ ] Click and drag pans view
- [ ] Zoom limits (0.2x to 3x)
- [ ] Reset button restores default view
- [ ] Controls visible in corner
**Dependencies:** TREE-003

---

## Tree Interface

```typescript
interface RepertoireTreeProps {
  repertoire: RepertoireNode;
  selectedNodeId?: string | null;
  onNodeClick?: (node: RepertoireNode) => void;
  width?: number;
  height?: number;
}
```

---

## Layout Constants

| Constant | Value | Description |
|----------|-------|-------------|
| NODE_RADIUS | 16 | Node radius in pixels |
| NODE_SPACING_X | 80 | Horizontal spacing between levels |
| NODE_SPACING_Y | 50 | Vertical spacing between siblings |
| ROOT_OFFSET_X | 60 | Left margin for root node |

---

## Dependencies to Other Epics

- Board Component (Epic 4b) displays position when node is selected
- Repertoire CRUD (Epic 6) provides repertoire data
- Frontend Core (Epic 4) provides component structure
