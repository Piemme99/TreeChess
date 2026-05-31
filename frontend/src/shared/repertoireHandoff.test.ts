import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  repertoireApi: {
    get: vi.fn(),
    addNode: vi.fn(),
  },
}));

import { repertoireApi } from '../services/api';
import {
  PENDING_ADD_NODE_KEY,
  PENDING_NAVIGATE_KEY,
  buildAddNodeRequest,
  buildLineFromDivergence,
  findFirstDivergenceIndex,
  graftLine,
  isDivergence,
  readPendingAddNode,
  readPendingNavigate,
  stashPendingAddSequence,
  stashPendingNavigate,
  type PendingMoveEntry,
} from './repertoireHandoff';
import { makeMove, getShortFEN } from './utils/chess';
import type { Repertoire, RepertoireNode, AddNodeRequest, MoveStatus } from '../types';

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

const E4_E5_LINE: PendingMoveEntry[] = [
  { parentFEN: START_FEN, moveSAN: 'e4', resultFEN: FEN_E4 },
  { parentFEN: FEN_E4, moveSAN: 'e5', resultFEN: FEN_E4_E5 },
];

// --- divergence -----------------------------------------------------------

describe('isDivergence', () => {
  it('is true only for opponent-new and out-of-repertoire', () => {
    expect(isDivergence('opponent-new')).toBe(true);
    expect(isDivergence('out-of-repertoire')).toBe(true);
    expect(isDivergence('in-repertoire')).toBe(false);
    expect(isDivergence('out-of-book')).toBe(false);
    expect(isDivergence(undefined)).toBe(false);
  });
});

describe('findFirstDivergenceIndex', () => {
  const m = (status: MoveStatus) => ({ status });

  it('returns the index of the first divergence', () => {
    expect(
      findFirstDivergenceIndex([m('in-repertoire'), m('opponent-new'), m('out-of-repertoire')])
    ).toBe(1);
  });

  it('returns -1 when the line never leaves the repertoire', () => {
    expect(findFirstDivergenceIndex([m('in-repertoire'), m('out-of-book')])).toBe(-1);
  });
});

// --- line building --------------------------------------------------------

describe('buildLineFromDivergence', () => {
  it('builds parent/result FENs for each move using fenAt(index)', () => {
    const moves = [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }];
    const fenAt = (i: number) => (i < 0 ? START_FEN : `FEN_${i}`);

    const line = buildLineFromDivergence(moves, 1, 2, fenAt);

    expect(line).toEqual([
      { parentFEN: 'FEN_0', moveSAN: 'e5', resultFEN: 'FEN_1' },
      { parentFEN: 'FEN_1', moveSAN: 'Nf3', resultFEN: 'FEN_2' },
    ]);
  });

  it('uses fenAt(-1) for a line starting at move 0', () => {
    const moves = [{ san: 'e4' }];
    const fenAt = (i: number) => (i < 0 ? START_FEN : FEN_E4);

    const line = buildLineFromDivergence(moves, 0, 0, fenAt);

    expect(line).toEqual([{ parentFEN: START_FEN, moveSAN: 'e4', resultFEN: FEN_E4 }]);
  });
});

// --- AddNode request ------------------------------------------------------

describe('buildAddNodeRequest', () => {
  it('derives move number, flips color, and shortens the FEN', () => {
    const parent = makeNode({ id: 'root', moveNumber: 0, colorToMove: 'w' });

    const request = buildAddNodeRequest(parent, 'e4', makeMove(START_FEN, 'e4')!);

    expect(request).toEqual({
      parentId: 'root',
      move: 'e4',
      fen: FEN_E4,
      moveNumber: 1,
      colorToMove: 'b',
    } satisfies AddNodeRequest);
  });

  it('keeps the move number and flips back to white for a black-to-move parent', () => {
    const parent = makeNode({ id: 'e4', fen: FEN_E4, move: 'e4', moveNumber: 1, colorToMove: 'b' });

    const request = buildAddNodeRequest(parent, 'e5', makeMove(FEN_E4, 'e5')!);

    expect(request).toEqual({
      parentId: 'e4',
      move: 'e5',
      fen: FEN_E4_E5,
      moveNumber: 1,
      colorToMove: 'w',
    } satisfies AddNodeRequest);
  });
});

// --- sessionStorage contract ----------------------------------------------

describe('pending handoff stash/read', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips an add sequence through sessionStorage', () => {
    const sequence = {
      repertoireId: 'rep-1',
      repertoireName: 'My Rep',
      gameInfo: 'A vs B',
      moves: E4_E5_LINE,
    };
    stashPendingAddSequence(sequence);

    expect(sessionStorage.getItem(PENDING_ADD_NODE_KEY)).not.toBeNull();
    expect(readPendingAddNode()).toEqual(sequence);
  });

  it('round-trips a navigate request through sessionStorage', () => {
    stashPendingNavigate({ repertoireId: 'rep-1', fen: FEN_E4 });

    expect(sessionStorage.getItem(PENDING_NAVIGATE_KEY)).not.toBeNull();
    expect(readPendingNavigate()).toEqual({ repertoireId: 'rep-1', fen: FEN_E4 });
  });

  it('returns null for missing or malformed stashes', () => {
    expect(readPendingAddNode()).toBeNull();
    expect(readPendingNavigate()).toBeNull();

    sessionStorage.setItem(PENDING_ADD_NODE_KEY, 'not json');
    expect(readPendingAddNode()).toBeNull();

    // Legacy single-move shape (no moves array) is rejected, not coerced.
    sessionStorage.setItem(
      PENDING_ADD_NODE_KEY,
      JSON.stringify({ repertoireId: 'r', repertoireName: 'n', parentFEN: START_FEN, moveSAN: 'e4', gameInfo: 'g' })
    );
    expect(readPendingAddNode()).toBeNull();
  });
});

// --- grafting -------------------------------------------------------------

const mockedGet = vi.mocked(repertoireApi.get);
const mockedAddNode = vi.mocked(repertoireApi.addNode);

/**
 * addNode mock that grows a live tree: each call appends a child to the node
 * matching parentId and returns the cumulative tree, so the next iteration's
 * findNodeByFEN can locate the freshly added position.
 */
function wireGrowingTree(root: RepertoireNode) {
  mockedGet.mockResolvedValue({ id: 'rep-1', treeData: root } as Repertoire);
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
    return { id: 'rep-1', treeData: root } as Repertoire;
  });
}

describe('graftLine', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedAddNode.mockReset();
  });

  it('adds every new move in the line and returns the updated repertoire', async () => {
    const root = makeNode({ id: 'root' });
    wireGrowingTree(root);

    const result = await graftLine('rep-1', E4_E5_LINE);

    expect(result.added).toEqual(['e4', 'e5']);
    expect(result.skipped).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.repertoire?.treeData).toBe(root);
    expect(mockedAddNode).toHaveBeenCalledTimes(2);
  });

  it('builds each AddNodeRequest payload from the parent node (move number, color, parent id, short fen)', async () => {
    wireGrowingTree(makeNode({ id: 'root' }));

    await graftLine('rep-1', E4_E5_LINE);

    expect(mockedAddNode).toHaveBeenNthCalledWith(1, 'rep-1', {
      parentId: 'root',
      move: 'e4',
      fen: FEN_E4,
      moveNumber: 1,
      colorToMove: 'b',
    } satisfies AddNodeRequest);

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

    const result = await graftLine('rep-1', E4_E5_LINE);

    expect(result.skipped).toEqual(['e4']);
    expect(result.added).toEqual(['e5']);
    expect(mockedAddNode).toHaveBeenCalledTimes(1);
  });

  it('stops with an error when the parent position is not in the repertoire', async () => {
    wireGrowingTree(makeNode({ id: 'root', fen: FEN_E4 }));

    const result = await graftLine('rep-1', E4_E5_LINE);

    expect(result.error).toMatch(/could not find/i);
    expect(result.added).toEqual([]);
    expect(mockedAddNode).not.toHaveBeenCalled();
  });

  it('reports a failure to load the repertoire', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));

    const result = await graftLine('rep-1', E4_E5_LINE);

    expect(result.error).toMatch(/failed to load/i);
    expect(result.repertoire).toBeUndefined();
    expect(mockedAddNode).not.toHaveBeenCalled();
  });
});
