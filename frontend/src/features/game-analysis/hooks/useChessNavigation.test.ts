import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useChessNavigation } from './useChessNavigation';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

function makeMove(plyNumber: number): MoveAnalysis {
  return {
    plyNumber,
    san: `m${plyNumber}`,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'in-repertoire',
    isUserMove: plyNumber % 2 === 0,
  };
}

function makeGame(gameIndex: number, moveCount = 10): GameAnalysis {
  return {
    gameIndex,
    headers: {},
    moves: Array.from({ length: moveCount }, (_, i) => makeMove(i)),
    userColor: 'white',
  };
}

describe('useChessNavigation', () => {
  it('starts at ply 0 (index -1) for a fresh game', () => {
    const { result } = renderHook(() =>
      useChessNavigation(makeGame(0), false, undefined, 'analysisA')
    );
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('honours the initial ply only for the first game shown', () => {
    const { result } = renderHook(() =>
      useChessNavigation(makeGame(0), false, 5, 'analysisA')
    );
    expect(result.current.currentMoveIndex).toBe(5);
  });

  it('does not reset the cursor when re-rendering with the same game', () => {
    const game = makeGame(0);
    const { result, rerender } = renderHook(
      ({ g, id }) => useChessNavigation(g, false, undefined, id),
      { initialProps: { g: game, id: 'analysisA' } }
    );

    act(() => result.current.goToMove(4));
    expect(result.current.currentMoveIndex).toBe(4);

    // Re-render with the same game/analysis: cursor should be preserved.
    rerender({ g: game, id: 'analysisA' });
    expect(result.current.currentMoveIndex).toBe(4);
  });

  it('resets to ply 0 when navigating across analyses sharing the same gameIndex', () => {
    // Cross-analysis navigation: analysis A game 0 -> analysis B game 0.
    // gameIndex alone (0) is identical, so a gameIndex-only guard would keep
    // the stale ply. The composite key must force a reset.
    const { result, rerender } = renderHook(
      ({ g, id }) => useChessNavigation(g, false, undefined, id),
      { initialProps: { g: makeGame(0), id: 'analysisA' } }
    );

    act(() => result.current.goToMove(6));
    expect(result.current.currentMoveIndex).toBe(6);

    // Step to a different analysis that happens to have the same gameIndex.
    rerender({ g: makeGame(0), id: 'analysisB' });
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('resets to ply 0 when navigating to a different gameIndex in the same analysis', () => {
    const { result, rerender } = renderHook(
      ({ g, id }) => useChessNavigation(g, false, undefined, id),
      { initialProps: { g: makeGame(0), id: 'analysisA' } }
    );

    act(() => result.current.goToMove(3));
    expect(result.current.currentMoveIndex).toBe(3);

    rerender({ g: makeGame(1), id: 'analysisA' });
    expect(result.current.currentMoveIndex).toBe(-1);
  });
});
