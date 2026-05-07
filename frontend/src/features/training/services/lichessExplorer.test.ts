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
} from './lichessExplorer';

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
