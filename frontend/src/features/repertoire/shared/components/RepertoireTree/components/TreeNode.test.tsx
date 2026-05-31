import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeNode } from './TreeNode';
import type { LayoutNode } from '../utils/types';
import type { RepertoireNode } from '../../../../../../types';

function makeNode(overrides: Partial<RepertoireNode> = {}): RepertoireNode {
  return {
    id: 'n1',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move: 'e4',
    moveNumber: 1,
    colorToMove: 'b',
    parentId: 'root',
    children: [],
    ...overrides,
  };
}

function makeLayoutNode(node: RepertoireNode): LayoutNode {
  return { id: node.id, x: 0, y: 0, node, depth: 1 };
}

function renderNode(node: RepertoireNode, props: Partial<React.ComponentProps<typeof TreeNode>> = {}) {
  return render(
    <svg>
      <TreeNode
        layoutNode={makeLayoutNode(node)}
        isSelected={false}
        onClick={vi.fn()}
        {...props}
      />
    </svg>
  );
}

describe('TreeNode accessibility', () => {
  it('exposes a labelled button describing the move', () => {
    renderNode(makeNode());
    expect(screen.getByRole('button', { name: 'Move e4' })).toBeInTheDocument();
  });

  it('labels the root node as the start position', () => {
    renderNode(makeNode({ move: null }));
    expect(screen.getByRole('button', { name: 'Start position' })).toBeInTheDocument();
  });

  it('marks the selected node with aria-current', () => {
    renderNode(makeNode(), { isSelected: true });
    expect(screen.getByRole('button', { name: 'Move e4' })).toHaveAttribute('aria-current', 'true');
  });

  it('activates via Enter and Space', () => {
    const onClick = vi.fn();
    const node = makeNode();
    renderNode(node, { onClick });
    const el = screen.getByRole('button', { name: 'Move e4' });

    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledWith(node);
  });
});
