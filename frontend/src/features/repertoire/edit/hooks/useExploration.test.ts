import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../../services/api', () => ({
  repertoireApi: {
    addNode: vi.fn(),
  },
}));

vi.mock('../../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { repertoireApi } from '../../../../services/api';
import { useExploration } from './useExploration';
import type { RepertoireNode, Repertoire } from '../../../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function makeRoot(children: RepertoireNode[] = []): RepertoireNode {
  return {
    id: 'root',
    fen: START_FEN,
    move: null,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children,
  } as unknown as RepertoireNode;
}

const mockedAddNode = vi.mocked(repertoireApi.addNode);

describe('useExploration', () => {
  beforeEach(() => {
    mockedAddNode.mockReset();
  });

  function setup(root = makeRoot()) {
    const repertoire = { treeData: root } as unknown as Repertoire;
    const setRepertoire = vi.fn();
    const selectNode = vi.fn();
    const { result } = renderHook(() =>
      useExploration(root, repertoire, 'rep-1', setRepertoire, selectNode)
    );
    return { result, setRepertoire, selectNode };
  }

  it('starts exploration from the selected node', () => {
    const { result } = setup();
    expect(result.current.exploring).toBe(false);
    act(() => result.current.startExplore());
    expect(result.current.exploring).toBe(true);
    expect(result.current.hasExploredMoves).toBe(false);
    expect(result.current.exploreFEN).toBe(START_FEN);
  });

  it('plays moves locally without touching the API', () => {
    const { result } = setup();
    act(() => result.current.startExplore());
    act(() => result.current.playExploreMove('e4'));
    expect(result.current.hasExploredMoves).toBe(true);
    expect(result.current.exploreFens).toHaveLength(1);
    // After 1.e4: pawn on e4 and black to move.
    expect(result.current.exploreFEN).toContain('4P3');
    expect(result.current.exploreFEN).toContain(' b ');
    expect(mockedAddNode).not.toHaveBeenCalled();
  });

  it('discarding leaves exploration and snaps back to the anchor node', () => {
    const { result, selectNode } = setup();
    act(() => result.current.startExplore());
    act(() => result.current.playExploreMove('e4'));
    act(() => result.current.discardExplore());
    expect(result.current.exploring).toBe(false);
    expect(selectNode).toHaveBeenCalledWith('root');
  });

  it('saving adds the explored moves and selects the last new node', async () => {
    const addedChild = {
      id: 'n1',
      move: 'e4',
      moveNumber: 1,
      colorToMove: 'b',
      parentId: 'root',
      children: [],
    } as unknown as RepertoireNode;
    const updated = { treeData: makeRoot([addedChild]) } as unknown as Repertoire;
    mockedAddNode.mockResolvedValueOnce(updated);

    const { result, selectNode, setRepertoire } = setup();
    act(() => result.current.startExplore());
    act(() => result.current.playExploreMove('e4'));
    await act(async () => {
      await result.current.saveExplore();
    });

    expect(mockedAddNode).toHaveBeenCalledTimes(1);
    expect(mockedAddNode).toHaveBeenCalledWith('rep-1', expect.objectContaining({ parentId: 'root', move: 'e4' }));
    expect(setRepertoire).toHaveBeenCalledWith(updated);
    expect(selectNode).toHaveBeenCalledWith('n1');
    expect(result.current.exploring).toBe(false);
  });

  it('descends into existing children instead of re-adding them', async () => {
    const existing = {
      id: 'n1',
      move: 'e4',
      moveNumber: 1,
      colorToMove: 'b',
      parentId: 'root',
      children: [],
    } as unknown as RepertoireNode;
    const root = makeRoot([existing]);
    const { result, selectNode } = setup(root);

    act(() => result.current.startExplore());
    act(() => result.current.playExploreMove('e4'));
    await act(async () => {
      await result.current.saveExplore();
    });

    expect(mockedAddNode).not.toHaveBeenCalled();
    expect(selectNode).toHaveBeenCalledWith('n1');
  });
});
