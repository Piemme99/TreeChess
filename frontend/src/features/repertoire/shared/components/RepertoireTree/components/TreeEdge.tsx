import { memo } from 'react';
import type { LayoutEdge } from '../utils/types';
import { createBezierPath, createMergePath } from '../utils/layoutCalculator';

interface TreeEdgeProps {
  edge: LayoutEdge;
}

export const TreeEdge = memo(function TreeEdge({ edge }: TreeEdgeProps) {
  const isMerge = edge.type === 'merge';

  return (
    <path
      d={isMerge ? createMergePath(edge.from, edge.to) : createBezierPath(edge.from, edge.to)}
      fill="none"
      stroke={isMerge ? '#a78bfa' : '#999'}
      strokeWidth="2"
      strokeDasharray={isMerge ? '5 3' : undefined}
      strokeOpacity={isMerge ? 0.7 : 1}
      markerEnd={isMerge ? undefined : 'url(#arrowhead)'}
    />
  );
});
