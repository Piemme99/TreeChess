import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  trainingApi: {
    opening: vi.fn(),
  },
}));

import { trainingApi } from '../../../services/api';
import {
  fetchExplorerData,
  resetExplorerCacheForTests,
  ExplorerError,
  getMostPopularMove,
  getWeightedRandomMove,
  getMovePopularity,
  getMoveWinRate,
  getBestMoveWinRate,
  calcWinRate,
  isOutOfBook,
  type ExplorerMove,
  type ExplorerResponse,
} from './lichessExplorer';

function move(partial: Partial<ExplorerMove>): ExplorerMove {
  return {
    uci: 'e2e4',
    san: 'e4',
    white: 0,
    draws: 0,
    black: 0,
    averageRating: 1800,
    ...partial,
  };
}

const mockOpening = trainingApi.opening as unknown as ReturnType<typeof vi.fn>;

const sampleResponse = {
  white: 100,
  draws: 50,
  black: 30,
  moves: [
    { uci: 'e2e4', san: 'e4', white: 60, draws: 20, black: 15, averageRating: 1900 },
  ],
};

beforeEach(() => {
  resetExplorerCacheForTests();
  mockOpening.mockReset();
});

describe('fetchExplorerData', () => {
  it('calls /training/opening with the FEN and returns the parsed response', async () => {
    mockOpening.mockResolvedValueOnce(sampleResponse);

    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = await fetchExplorerData(fen);

    expect(mockOpening).toHaveBeenCalledWith(fen);
    expect(result).toEqual(sampleResponse);
  });

  it('returns the cached response without re-calling the backend on a second request', async () => {
    mockOpening.mockResolvedValueOnce(sampleResponse);

    const fen = 'cached-fen';
    await fetchExplorerData(fen);
    await fetchExplorerData(fen);

    expect(mockOpening).toHaveBeenCalledTimes(1);
  });

  it('maps a 403 lichess_not_linked response to ExplorerError("lichess_not_linked")', async () => {
    mockOpening.mockRejectedValueOnce({
      response: { status: 403, data: { error: 'connect Lichess', code: 'lichess_not_linked' } },
    });

    await expect(fetchExplorerData('fen-1')).rejects.toMatchObject({
      code: 'lichess_not_linked',
    });

    try {
      await fetchExplorerData('fen-1-again');
    } catch (e) {
      expect(e).toBeInstanceOf(ExplorerError);
    }
  });

  it('maps a 429 rate_limited response and exposes retryAfterSeconds', async () => {
    mockOpening.mockRejectedValueOnce({
      response: { status: 429, data: { code: 'rate_limited', retryAfterSeconds: 17 } },
    });

    try {
      await fetchExplorerData('fen-rl');
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ExplorerError);
      expect((e as ExplorerError).code).toBe('rate_limited');
      expect((e as ExplorerError).retryAfterSeconds).toBe(17);
    }
  });

  it('maps a 502 upstream_unavailable response', async () => {
    mockOpening.mockRejectedValueOnce({
      response: { status: 502, data: { code: 'upstream_unavailable' } },
    });

    await expect(fetchExplorerData('fen-x')).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  it('maps a transport error (no response) to ExplorerError("network_error")', async () => {
    mockOpening.mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchExplorerData('fen-net')).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it('maps a 403 lichess_token_invalid response distinctly from lichess_not_linked', async () => {
    mockOpening.mockRejectedValueOnce({
      response: { status: 403, data: { code: 'lichess_token_invalid' } },
    });

    await expect(fetchExplorerData('fen-tok')).rejects.toMatchObject({
      code: 'lichess_token_invalid',
    });
  });
});

describe('getMostPopularMove', () => {
  it('returns null for an empty move list', () => {
    expect(getMostPopularMove({ white: 0, draws: 0, black: 0, moves: [] })).toBeNull();
  });

  it('picks the move with the most total games', () => {
    const response: ExplorerResponse = {
      white: 0, draws: 0, black: 0,
      moves: [
        move({ san: 'e4', white: 10, draws: 5, black: 5 }), // 20
        move({ san: 'd4', white: 30, draws: 10, black: 10 }), // 50
        move({ san: 'c4', white: 5, draws: 5, black: 5 }), // 15
      ],
    };
    expect(getMostPopularMove(response)?.san).toBe('d4');
  });
});

describe('getWeightedRandomMove', () => {
  it('returns null for empty moves', () => {
    expect(getWeightedRandomMove({ white: 0, draws: 0, black: 0, moves: [] })).toBeNull();
  });

  it('returns the sole move when only one exists', () => {
    const response: ExplorerResponse = {
      white: 0, draws: 0, black: 0,
      moves: [move({ san: 'e4', white: 1 })],
    };
    expect(getWeightedRandomMove(response)?.san).toBe('e4');
  });

  it('returns the first move when every move has zero games (total weight 0)', () => {
    const response: ExplorerResponse = {
      white: 0, draws: 0, black: 0,
      moves: [move({ san: 'a' }), move({ san: 'b' })],
    };
    expect(getWeightedRandomMove(response)?.san).toBe('a');
  });

  it('selects deterministically given a fixed Math.random roll', () => {
    const response: ExplorerResponse = {
      white: 0, draws: 0, black: 0,
      moves: [
        move({ san: 'e4', white: 30 }), // weight 30, cumulative [0,30)
        move({ san: 'd4', white: 70 }), // weight 70, cumulative [30,100)
      ],
    };
    // roll = 0.5 * 100 = 50 → 50-30 = 20 > 0 (skip e4), 20-70 = -50 <= 0 → d4
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(getWeightedRandomMove(response)?.san).toBe('d4');
    // roll = 0.1 * 100 = 10 → 10-30 = -20 <= 0 → e4
    spy.mockReturnValue(0.1);
    expect(getWeightedRandomMove(response)?.san).toBe('e4');
    spy.mockRestore();
  });
});

describe('getMovePopularity', () => {
  const response: ExplorerResponse = {
    white: 60, draws: 20, black: 20, // position total 100
    moves: [
      move({ san: 'e4', white: 20, draws: 5, black: 5 }), // 30 games
      move({ san: 'd4', white: 5, draws: 0, black: 5 }), // 10 games
    ],
  };

  it('returns the move share as a percentage of the position total', () => {
    expect(getMovePopularity(response, 'e4')).toBeCloseTo(30, 5); // 30/100
    expect(getMovePopularity(response, 'd4')).toBeCloseTo(10, 5);
  });

  it('returns null for a move not present', () => {
    expect(getMovePopularity(response, 'Nf3')).toBeNull();
  });

  it('returns null when the position has zero games', () => {
    const empty: ExplorerResponse = { white: 0, draws: 0, black: 0, moves: [move({ san: 'e4' })] };
    expect(getMovePopularity(empty, 'e4')).toBeNull();
  });
});

describe('getMoveWinRate', () => {
  // 50 white wins, 20 draws, 30 black wins → 100 games for this move.
  const response: ExplorerResponse = {
    white: 0, draws: 0, black: 0,
    moves: [move({ san: 'e4', white: 50, draws: 20, black: 30 })],
  };

  it('computes white win rate as (wins + draws/2) / total', () => {
    // (50 + 10) / 100 * 100 = 60
    expect(getMoveWinRate(response, 'e4', 'w')).toBeCloseTo(60, 5);
  });

  it('computes black win rate from the black perspective (flip)', () => {
    // (30 + 10) / 100 * 100 = 40
    expect(getMoveWinRate(response, 'e4', 'b')).toBeCloseTo(40, 5);
  });

  it('returns null for an unknown move or a move with zero games', () => {
    expect(getMoveWinRate(response, 'd4', 'w')).toBeNull();
    const zero: ExplorerResponse = { white: 0, draws: 0, black: 0, moves: [move({ san: 'c4' })] };
    expect(getMoveWinRate(zero, 'c4', 'w')).toBeNull();
  });
});

describe('getBestMoveWinRate', () => {
  it('returns null when there are no moves', () => {
    expect(getBestMoveWinRate({ white: 0, draws: 0, black: 0, moves: [] }, 'w')).toBeNull();
  });

  it('ignores moves below the min-games threshold and returns the best qualifying win rate', () => {
    // positionTotal = 1000 → minGames = max(100, 10) = 100.
    const response: ExplorerResponse = {
      white: 500, draws: 0, black: 500,
      moves: [
        // 99 games (< 100) but a 100% white score — must be ignored.
        move({ san: 'trap', white: 99, draws: 0, black: 0 }),
        // 200 games, white wins 120, draws 40 → (120+20)/200 = 70%.
        move({ san: 'main', white: 120, draws: 40, black: 40 }),
        // 150 games, white wins 60, draws 30 → (60+15)/150 = 50%.
        move({ san: 'other', white: 60, draws: 30, black: 60 }),
      ],
    };
    expect(getBestMoveWinRate(response, 'w')).toBeCloseTo(70, 5);
  });

  it('returns null when no move meets the threshold', () => {
    const response: ExplorerResponse = {
      white: 50, draws: 0, black: 50, // positionTotal 100, minGames = max(100,1)=100
      moves: [move({ san: 'rare', white: 40, draws: 0, black: 40 })], // 80 < 100
    };
    expect(getBestMoveWinRate(response, 'w')).toBeNull();
  });

  it('uses the black perspective when userColor is b', () => {
    const response: ExplorerResponse = {
      white: 0, draws: 0, black: 0,
      moves: [move({ san: 'm', white: 40, draws: 20, black: 140 })], // 200 games
    };
    // black: (140 + 10) / 200 * 100 = 75
    expect(getBestMoveWinRate(response, 'b')).toBeCloseTo(75, 5);
  });
});

describe('calcWinRate', () => {
  it('returns 50 for a position with no games', () => {
    expect(calcWinRate({ white: 0, draws: 0, black: 0, moves: [] }, 'w')).toBe(50);
    expect(calcWinRate({ white: 0, draws: 0, black: 0, moves: [] }, 'b')).toBe(50);
  });

  it('computes the position win rate for white and black', () => {
    const response: ExplorerResponse = { white: 60, draws: 20, black: 20, moves: [] };
    expect(calcWinRate(response, 'w')).toBeCloseTo(70, 5); // (60+10)/100
    expect(calcWinRate(response, 'b')).toBeCloseTo(30, 5); // (20+10)/100
  });
});

describe('isOutOfBook', () => {
  it('is true when total games are below the 100 threshold', () => {
    expect(isOutOfBook({ white: 40, draws: 30, black: 29, moves: [] })).toBe(true); // 99
  });

  it('is false at exactly the threshold (boundary: 100 is in book)', () => {
    expect(isOutOfBook({ white: 40, draws: 30, black: 30, moves: [] })).toBe(false); // 100
  });

  it('is false well above the threshold', () => {
    expect(isOutOfBook({ white: 500, draws: 200, black: 300, moves: [] })).toBe(false);
  });
});
