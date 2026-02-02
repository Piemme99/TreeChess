import { memo, useCallback } from 'react';
import type { RepertoireNode } from '../../../../../../types';
import type { LayoutNode } from '../utils/types';
import { NODE_RADIUS } from '../constants';

interface TreeNodeProps {
  layoutNode: LayoutNode;
  isSelected: boolean;
  onClick: (node: RepertoireNode) => void;
  onMouseEnter?: (layoutNode: LayoutNode) => void;
  onMouseLeave?: () => void;
}

export const TreeNode = memo(function TreeNode({ layoutNode, isSelected, onClick, onMouseEnter, onMouseLeave }: TreeNodeProps) {
  const isRoot = layoutNode.node.move === null;
  const isTransposition = !!layoutNode.node.transpositionOf;
  // colorToMove is the color to play AFTER this move
  // So if colorToMove === 'b', the move that was just played was white's move
  const isWhiteMove = layoutNode.node.colorToMove === 'b';

  const handleClick = useCallback(() => onClick(layoutNode.node), [onClick, layoutNode.node]);
  const handleMouseEnter = useCallback(() => onMouseEnter?.(layoutNode), [onMouseEnter, layoutNode]);

  return (
    <g
      className={`tree-node ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
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
          fill={isSelected ? '#E67E22' : '#6b7280'}
          stroke={isSelected ? '#D4740A' : '#4b5563'}
          strokeWidth="2"
        />
      ) : (
        <circle
          cx={layoutNode.x}
          cy={layoutNode.y}
          r={NODE_RADIUS}
          fill={isTransposition ? 'transparent' : isSelected ? '#E67E22' : isWhiteMove ? '#ffffff' : '#1f2937'}
          stroke={isTransposition ? '#a78bfa' : isSelected ? '#D4740A' : isWhiteMove ? '#9ca3af' : '#111827'}
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
});
