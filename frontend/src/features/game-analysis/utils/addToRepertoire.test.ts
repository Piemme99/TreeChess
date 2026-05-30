import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/api', () => ({
  repertoireApi: {
    get: vi.fn(),
    addNode: vi.fn(),
  },
}));

import { repertoireApi } from '../../../services/api';
import { addLineToRepertoire, type LineMove } from './addToRepertoire';
import { makeMove, getShortFEN } from '../../../shared/utils/chess';
import type { Repertoire, RepertoireNode, AddNodeRequest } from '../../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FEN_E4 = getShortFEN(makeMove(START_FEN, 'e4')!);
const FEN_E4_E5 = getShortFEN(makeMove(FEN_E4, 'e5')!);

function makeNode(partial: Partial<RepertoireNode>): RepertoireNode {
  return {
    id: 'n',
    fen: START_FEN,
    move: null,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children: [],
    ...partial,
  } as RepertoireNode;
}

const E4_E5_LINE: LineMove[] = [
  { parentFEN: START_FEN, moveSAN: 'e4', resultFEN: FEN_E4 },
  { parentFEN: FEN_E4, moveSAN: 'e5', resultFEN: FEN_E4_E5 },
];

const mockedGet = vi.mocked(repertoireApi.get);
const mockedAddNode = vi.mocked(repertoireApi.addNode);

/**
 * addNode mock that grows a live tree: each call appends a child to the node
 * matching parentId and returns the cumulative tree, so the next iteration's
 * findNodeByFEN can locate the freshly added position.
 */
function wireGrowingTree(root: RepertoireNode) {
  mockedGet.mockResolvedValue({ treeData: root } as Repertoire);
  let counter = 0;
  mockedAddNode.mockImplementation(async (_id: string, req: AddNodeRequest) => {
    const attach = (node: RepertoireNode): boolean => {
      if (node.id === req.parentId) {
        node.children.push(makeNode({
          id: `added-${counter++}`,
          fen: req.fen,
          move: req.move,
          parentId: node.id,
          colorToMove: req.colorToMove,
          moveNumber: req.moveNumber,
        }));
        return true;
      }
      return node.children.some(attach);
    };
    attach(root);
    return { treeData: root } as Repertoire;
  });
}

describe('addLineToRepertoire', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedAddNode.mockReset();
  });

  it('adds every new move in the line', async () => {
    wireGrowingTree(makeNode({ id: 'root' }));

    const result = await addLineToRepertoire('rep-1', E4_E5_LINE);

    expect(result.added).toEqual(['e4', 'e5']);
    expect(result.skipped).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(mockedAddNode).toHaveBeenCalledTimes(2);
  });

  it('builds each AddNodeRequest payload from the parent node (move number, color, parent id, short fen)', async () => {
    // root: moveNumber 0, white to move.
    wireGrowingTree(makeNode({ id: 'root' }));

    await addLineToRepertoire('rep-1', E4_E5_LINE);

    // First POST grafts e4 onto the root.
    //   parent root: moveNumber 0, colorToMove 'w'
    //   → deriveChildMoveNumber(0, 'w') = 1; colorToMove flips to 'b'.
    expect(mockedAddNode).toHaveBeenNthCalledWith(1, 'rep-1', {
      parentId: 'root',
      move: 'e4',
      fen: FEN_E4,
      moveNumber: 1,
      colorToMove: 'b',
    } satisfies AddNodeRequest);

    // Second POST grafts e5 onto the freshly added e4 node.
    //   parent e4 (from the previous request): moveNumber 1, colorToMove 'b'
    //   → deriveChildMoveNumber(1, 'b') = 1; colorToMove flips to 'w'.
    expect(mockedAddNode).toHaveBeenNthCalledWith(2, 'rep-1', {
      parentId: 'added-0',
      move: 'e5',
      fen: FEN_E4_E5,
      moveNumber: 1,
      colorToMove: 'w',
    } satisfies AddNodeRequest);
  });

  it('skips moves already present and only adds the missing tail', async () => {
    const e4Node = makeNode({ id: 'e4', fen: FEN_E4, move: 'e4', parentId: 'root', colorToMove: 'b', moveNumber: 1 });
    wireGrowingTree(makeNode({ id: 'root', children: [e4Node] }));

    const result = await addLineToRepertoire('rep-1', E4_E5_LINE);

    expect(result.skipped).toEqual(['e4']);
    expect(result.added).toEqual(['e5']);
    expect(mockedAddNode).toHaveBeenCalledTimes(1);
  });

  it('stops with an error when the parent position is not in the repertoire', async () => {
    // Repertoire is empty (root only); the line starts from a position the tree lacks.
    wireGrowingTree(makeNode({ id: 'root', fen: FEN_E4 }));

    const result = await addLineToRepertoire('rep-1', E4_E5_LINE);

    expect(result.error).toMatch(/could not find/i);
    expect(result.added).toEqual([]);
    expect(mockedAddNode).not.toHaveBeenCalled();
  });

  it('reports a failure to load the repertoire', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));

    const result = await addLineToRepertoire('rep-1', E4_E5_LINE);

    expect(result.error).toMatch(/failed to load/i);
    expect(mockedAddNode).not.toHaveBeenCalled();
  });
});
