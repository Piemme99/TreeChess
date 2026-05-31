import { describe, it, expect } from 'vitest';
import { findNode, findPathToNode, findNodeByFEN } from './nodeUtils';
import type { RepertoireNode } from '../../../../types';

function makeNode(partial: Partial<RepertoireNode>): RepertoireNode {
  return {
    id: 'n',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move: null,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children: [],
    ...partial,
  } as RepertoireNode;
}

describe('findNode', () => {
  it('finds a node by id anywhere in the tree', () => {
    const tree = makeNode({
      id: 'root',
      children: [makeNode({ id: 'a', children: [makeNode({ id: 'b' })] })],
    });
    expect(findNode(tree, 'b')?.id).toBe('b');
    expect(findNode(tree, 'missing')).toBeNull();
  });
});

describe('findPathToNode', () => {
  it('returns the chain of nodes from root to the target', () => {
    const tree = makeNode({
      id: 'root',
      children: [makeNode({ id: 'a', children: [makeNode({ id: 'b' })] })],
    });
    expect(findPathToNode(tree, 'b')?.map((n) => n.id)).toEqual(['root', 'a', 'b']);
    expect(findPathToNode(tree, 'missing')).toBeNull();
  });
});

describe('findNodeByFEN', () => {
  it('matches on board placement plus side-to-move', () => {
    const tree = makeNode({
      id: 'root',
      children: [
        makeNode({
          id: 'after-e4',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        }),
      ],
    });
    const found = findNodeByFEN(
      tree,
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(found?.id).toBe('after-e4');
  });

  it('ignores castling and en-passant fields when matching', () => {
    const tree = makeNode({
      id: 'root',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    });
    const found = findNodeByFEN(
      tree,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 5 3',
    );
    expect(found?.id).toBe('root');
  });

  it('does NOT collide two positions with the same placement but different side-to-move', () => {
    // Same board arrangement, but it is White to move in the node and Black to
    // move in the target — these are distinct positions and must not match.
    const tree = makeNode({
      id: 'root',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    });
    const found = findNodeByFEN(
      tree,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(found).toBeNull();
  });

  it('returns null when no node matches', () => {
    const tree = makeNode({ id: 'root' });
    expect(findNodeByFEN(tree, '8/8/8/8/8/8/8/8 w - - 0 1')).toBeNull();
  });
});
