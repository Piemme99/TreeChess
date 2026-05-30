import { describe, it, expect } from 'vitest';
import {
  reducer,
  initialState,
  getVerdict,
  updateLastMoveStats,
  type ExplorerState,
  type MoveRecord,
} from './useExplorerTraining';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function record(partial: Partial<MoveRecord>): MoveRecord {
  return { san: 'e4', isUser: true, popularity: null, winRate: null, bestWinRate: null, ...partial };
}

describe('getVerdict', () => {
  it('maps win-rate bands to verdict strings (boundary values)', () => {
    expect(getVerdict(55)).toBe('Strong opening!'); // >= 55
    expect(getVerdict(54.9)).toBe('Solid position'); // < 55, >= 48
    expect(getVerdict(48)).toBe('Solid position');
    expect(getVerdict(47.9)).toBe('Slightly passive'); // < 48, >= 40
    expect(getVerdict(40)).toBe('Slightly passive');
    expect(getVerdict(39.9)).toBe('Difficult position'); // < 40
    expect(getVerdict(0)).toBe('Difficult position');
  });
});

describe('updateLastMoveStats', () => {
  it('returns the same array reference for an empty history', () => {
    const history: MoveRecord[] = [];
    expect(updateLastMoveStats(history, { popularity: 10 })).toBe(history);
  });

  it('merges provided stats into the last move only', () => {
    const history = [record({ san: 'd4' }), record({ san: 'e4' })];
    const next = updateLastMoveStats(history, { popularity: 25, winRate: 51, bestWinRate: 60 });
    expect(next[0]).toEqual(history[0]); // untouched
    expect(next[1]).toMatchObject({ san: 'e4', popularity: 25, winRate: 51, bestWinRate: 60 });
    // Does not mutate the original.
    expect(history[1].popularity).toBeNull();
  });

  it('leaves omitted fields untouched (undefined is not applied)', () => {
    const history = [record({ san: 'e4', winRate: 99 })];
    const next = updateLastMoveStats(history, { popularity: 10 });
    expect(next[0].winRate).toBe(99); // winRate not in stats → preserved
    expect(next[0].popularity).toBe(10);
  });
});

describe('reducer', () => {
  it('START_SESSION resets to fetching_explorer with orientation derived from color (white)', () => {
    const next = reducer({ ...initialState, errorMessage: 'old' }, { type: 'START_SESSION', userColor: 'w' });
    expect(next.phase).toBe('fetching_explorer');
    expect(next.orientation).toBe('white');
    expect(next.userColor).toBe('w');
    expect(next.errorMessage).toBeNull(); // cleared from initialState
    expect(next.moveHistory).toEqual([]);
  });

  it('START_SESSION orients the board for black', () => {
    const next = reducer(initialState, { type: 'START_SESSION', userColor: 'b' });
    expect(next.orientation).toBe('black');
    expect(next.userColor).toBe('b');
  });

  it('SET_USER_TURN switches to user_turn and applies stats to the last move', () => {
    const base: ExplorerState = {
      ...initialState,
      phase: 'fetching_explorer',
      moveHistory: [record({ san: 'e4' })],
    };
    const next = reducer(base, {
      type: 'SET_USER_TURN',
      feedbackMessage: 'Played in 40% of games',
      stats: { popularity: 40, winRate: 52, bestWinRate: 55 },
    });
    expect(next.phase).toBe('user_turn');
    expect(next.feedbackMessage).toBe('Played in 40% of games');
    expect(next.moveHistory[0]).toMatchObject({ popularity: 40, winRate: 52, bestWinRate: 55 });
  });

  it('SET_USER_TURN without stats leaves history unchanged and clears feedback to null', () => {
    const history = [record({ san: 'e4' })];
    const next = reducer({ ...initialState, moveHistory: history }, { type: 'SET_USER_TURN' });
    expect(next.moveHistory).toBe(history);
    expect(next.feedbackMessage).toBeNull();
  });

  it('OPPONENT_MOVE_DONE appends an opponent move, advances the board, and bumps moveCount', () => {
    const next = reducer(initialState, {
      type: 'OPPONENT_MOVE_DONE',
      san: 'e5',
      from: 'e7',
      to: 'e5',
      resultFen: 'after-e5',
      popularity: 33,
      winRate: 49,
      bestWinRate: 51,
    });
    expect(next.phase).toBe('user_turn');
    expect(next.fen).toBe('after-e5');
    expect(next.lastMove).toEqual({ from: 'e7', to: 'e5' });
    expect(next.moveCount).toBe(1);
    expect(next.moveHistory).toHaveLength(1);
    expect(next.moveHistory[0]).toMatchObject({ san: 'e5', isUser: false, popularity: 33, winRate: 49, bestWinRate: 51 });
  });

  it('USER_MOVE appends a user move (stats null), advances board to fetching_explorer, bumps moveCount', () => {
    const next = reducer(initialState, {
      type: 'USER_MOVE',
      san: 'e4',
      from: 'e2',
      to: 'e4',
      resultFen: 'after-e4',
    });
    expect(next.phase).toBe('fetching_explorer');
    expect(next.fen).toBe('after-e4');
    expect(next.lastMove).toEqual({ from: 'e2', to: 'e4' });
    expect(next.moveCount).toBe(1);
    expect(next.moveHistory[0]).toMatchObject({ san: 'e4', isUser: true, popularity: null, winRate: null, bestWinRate: null });
  });

  it('OUT_OF_BOOK completes the session, records final win rate/verdict, and applies last-move stats', () => {
    const base: ExplorerState = { ...initialState, moveHistory: [record({ san: 'e4' })] };
    const next = reducer(base, {
      type: 'OUT_OF_BOOK',
      winRate: 57,
      verdict: 'Strong opening!',
      feedbackMessage: 'Novelty!',
      stats: { popularity: null, winRate: 57 },
    });
    expect(next.phase).toBe('session_complete');
    expect(next.finalWinRate).toBe(57);
    expect(next.finalVerdict).toBe('Strong opening!');
    expect(next.feedbackMessage).toBe('Novelty!');
    expect(next.moveHistory[0]).toMatchObject({ popularity: null, winRate: 57 });
  });

  it('ERROR completes the session with an error message and clears final results', () => {
    const base: ExplorerState = { ...initialState, finalWinRate: 50, finalVerdict: 'Solid position' };
    const next = reducer(base, { type: 'ERROR', message: 'Failed to load opening data.' });
    expect(next.phase).toBe('session_complete');
    expect(next.errorMessage).toBe('Failed to load opening data.');
    expect(next.finalWinRate).toBeNull();
    expect(next.finalVerdict).toBeNull();
  });

  it('RESET returns the initial state', () => {
    const dirty: ExplorerState = { ...initialState, phase: 'user_turn', moveCount: 5, fen: 'x' };
    expect(reducer(dirty, { type: 'RESET' })).toEqual(initialState);
  });

  it('keeps the starting FEN in the initial state', () => {
    expect(initialState.fen).toBe(STARTING_FEN);
    expect(initialState.phase).toBe('idle');
  });
});
