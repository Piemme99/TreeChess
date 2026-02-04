import { memo } from 'react';
import type { LayoutEdge, LayoutMode } from '../utils/types';
import { createBezierPath, createMergePath } from '../utils/layoutCalculator';
import { createTidyPath, createTidyMergePath } from '../utils/tidyLayoutCalculator';

interface TreeEdgeProps {
  edge: LayoutEdge;
  layoutMode: LayoutMode;
}

export const TreeEdge = memo(function TreeEdge({ edge, layoutMode }: TreeEdgeProps) {
  const isMerge = edge.type === 'merge';

  let path: string;
  if (layoutMode === 'tidy') {
    path = isMerge
      ? createTidyMergePath(edge.from, edge.to)
      : createTidyPath(edge.from, edge.to);
  } else {
    path = isMerge
      ? createMergePath(edge.from, edge.to)
      : createBezierPath(edge.from, edge.to);
  }

  // Skip rendering if path is empty (e.g., from === to)
  if (!path) return null;

  return (
    <path
      className="tree-edge"
      d={path}
      fill="none"
      stroke={isMerge ? '#a78bfa' : '#999'}
      strokeWidth="2"
      strokeDasharray={isMerge ? '5 3' : undefined}
      strokeOpacity={isMerge ? 0.7 : 1}
      markerEnd={isMerge ? undefined : 'url(#arrowhead)'}
    />
  );
});
