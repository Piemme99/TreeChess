import type { LayoutEdge } from '../utils/types';
import { createBezierPath } from '../utils/layoutCalculator';

interface TreeEdgeProps {
  edge: LayoutEdge;
}

export function TreeEdge({ edge }: TreeEdgeProps) {
  return (
    <path
      d={createBezierPath(edge.from, edge.to)}
      fill="none"
      stroke="#999"
      strokeWidth="2"
      markerEnd="url(#arrowhead)"
    />
  );
}
