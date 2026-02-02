import type { RepertoireNode } from '../../../../../../types';
import type { LayoutNode } from '../utils/types';
import { NODE_RADIUS } from '../constants';

interface TreeNodeProps {
  layoutNode: LayoutNode;
  selectedNodeId: string | null;
  onClick: (node: RepertoireNode) => void;
  onMouseEnter?: (layoutNode: LayoutNode) => void;
  onMouseLeave?: () => void;
}

export function TreeNode({ layoutNode, selectedNodeId, onClick, onMouseEnter, onMouseLeave }: TreeNodeProps) {
  const isRoot = layoutNode.node.move === null;
  const isSelected = layoutNode.id === selectedNodeId;
  const isTransposition = !!layoutNode.node.transpositionOf;
  // colorToMove is the color to play AFTER this move
  // So if colorToMove === 'b', the move that was just played was white's move
  const isWhiteMove = layoutNode.node.colorToMove === 'b';

  return (
    <g
      className={`tree-node ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(layoutNode.node)}
      onMouseEnter={() => onMouseEnter?.(layoutNode)}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      {isRoot ? (
        <rect
          x={layoutNode.x - NODE_RADIUS}
          y={layoutNode.y - NODE_RADIUS}
          width={NODE_RADIUS * 2}
          height={NODE_RADIUS * 2}
          rx="4"
          fill={isSelected ? '#4a90d9' : '#6b7280'}
          stroke={isSelected ? '#2563eb' : '#4b5563'}
          strokeWidth="2"
        />
      ) : (
        <circle
          cx={layoutNode.x}
          cy={layoutNode.y}
          r={NODE_RADIUS}
          fill={isTransposition ? 'transparent' : isSelected ? '#4a90d9' : isWhiteMove ? '#ffffff' : '#1f2937'}
          stroke={isTransposition ? '#a78bfa' : isSelected ? '#2563eb' : isWhiteMove ? '#9ca3af' : '#111827'}
          strokeWidth="2"
          strokeDasharray={isTransposition ? '4 2' : undefined}
        />
      )}
      <text
        x={layoutNode.x}
        y={layoutNode.y + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill={isRoot || isSelected ? '#fff' : isTransposition ? '#a78bfa' : isWhiteMove ? '#333' : '#fff'}
      >
        {isRoot ? 'Start' : layoutNode.node.move}
      </text>
    </g>
  );
}
