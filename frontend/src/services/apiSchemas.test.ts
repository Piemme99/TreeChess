import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import { api, importApi, dashboardApi, authApi, setAccessToken } from './api';
import {
  authResponseSchema,
  analysisDetailSchema,
  dashboardStatsResponseSchema,
  validateResponse,
} from './apiSchemas';
import type {
  AuthResponse,
  AnalysisDetail,
  DashboardStatsResponse,
} from '../types';

// --- Valid fixtures mirroring the backend wire shapes ---

const validAuth: AuthResponse = {
  token: 'jwt-token',
  user: {
    id: 'u1',
    username: 'alice',
    lichessLinked: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
};

const validAnalysisDetail: AnalysisDetail = {
  id: 'a1',
  username: 'alice',
  filename: 'games.pgn',
  gameCount: 1,
  uploadedAt: '2024-01-01T00:00:00Z',
  results: [
    {
      gameIndex: 0,
      headers: { White: 'alice', Black: 'bob', Result: '1-0' },
      moves: [
        {
          plyNumber: 1,
          san: 'e4',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          status: 'in-repertoire',
          isUserMove: true,
        },
      ],
      userColor: 'white',
      matchedRepertoire: { id: 'r1', name: 'My Rep' },
      matchScore: 1,
    },
  ],
};

const validDashboardStats: DashboardStatsResponse = {
  totalGames: 10,
  wins: 5,
  losses: 3,
  draws: 2,
  overallWinRate: 0.5,
  overallCoverage: 0.8,
  winRateInRep: 0.6,
  winRateOutRep: 0.4,
  inRepCount: 6,
  outRepCount: 4,
  repertoires: [],
  openingErrorRate: 0.1,
  openingErrorCount: 1,
  matchedGamesCount: 8,
  opponentGaps: [],
  branchStats: [],
};

describe('validateResponse / schemas (direct)', () => {
  it('returns the parsed value for a valid auth payload', () => {
    expect(validateResponse(authResponseSchema, validAuth, 'auth')).toEqual(
      validAuth,
    );
  });

  it('passes through unknown extra fields (non-strict)', () => {
    const withExtra = { ...validAuth, somethingNew: true };
    const parsed = validateResponse(authResponseSchema, withExtra, 'auth');
    expect(parsed.token).toBe('jwt-token');
  });

  it('throws with the boundary name and field path on a missing field', () => {
    const broken = { user: validAuth.user }; // token missing
    expect(() => validateResponse(authResponseSchema, broken, 'auth')).toThrow(
      /auth response shape at "token"/,
    );
  });

  it('rejects a wrong-typed field', () => {
    const broken = { ...validAuth, token: 42 };
    expect(() => validateResponse(authResponseSchema, broken, 'auth')).toThrow(
      /auth/,
    );
  });

  it('rejects a malformed analysis detail (results not an array)', () => {
    const broken = { ...validAnalysisDetail, results: 'nope' };
    expect(() =>
      validateResponse(analysisDetailSchema, broken, 'analysis detail'),
    ).toThrow(/analysis detail response shape at "results"/);
  });

  it('rejects malformed dashboard stats (missing numeric field)', () => {
    const broken: Record<string, unknown> = { ...validDashboardStats };
    delete broken.totalGames;
    expect(() =>
      validateResponse(dashboardStatsResponseSchema, broken, 'dashboard stats'),
    ).toThrow(/dashboard stats response shape at "totalGames"/);
  });
});

// --- Integration: malformed payloads are rejected at the *Api boundary ---
//
// Mirrors the adapter harness in api.test.ts: a custom adapter on
// `api.defaults.adapter` serves a scripted response so we exercise the real
// service functions (and their validateResponse calls) end to end.

function makeAdapter(data: unknown): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) => {
    const response: AxiosResponse = {
      data,
      status: 200,
      statusText: '',
      headers: {},
      config,
    };
    return Promise.resolve(response);
  };
}

let originalAdapter: typeof api.defaults.adapter;

beforeEach(() => {
  originalAdapter = api.defaults.adapter;
  setAccessToken('tok');
  vi.restoreAllMocks();
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('API boundary runtime validation (integration)', () => {
  it('importApi.get resolves a valid analysis detail', async () => {
    api.defaults.adapter = makeAdapter(validAnalysisDetail);
    const detail = await importApi.get('a1');
    expect(detail.id).toBe('a1');
    expect(detail.results).toHaveLength(1);
  });

  it('importApi.get rejects a malformed analysis detail', async () => {
    api.defaults.adapter = makeAdapter({ id: 'a1', results: 'nope' });
    await expect(importApi.get('a1')).rejects.toThrow(
      /analysis detail response shape/,
    );
  });

  it('dashboardApi.stats rejects a malformed payload', async () => {
    api.defaults.adapter = makeAdapter({ totalGames: 'lots' });
    await expect(dashboardApi.stats()).rejects.toThrow(
      /dashboard stats response shape/,
    );
  });

  it('authApi.login rejects a malformed auth payload', async () => {
    api.defaults.adapter = makeAdapter({ user: { id: 'u1' } }); // token missing, user incomplete
    await expect(authApi.login('a@b.c', 'pw')).rejects.toThrow(
      /auth response shape/,
    );
  });

  it('authApi.login resolves a valid auth payload', async () => {
    api.defaults.adapter = makeAdapter(validAuth);
    const res = await authApi.login('a@b.c', 'pw');
    expect(res.token).toBe('jwt-token');
  });

  it('authApi.refresh (bare axios) validates the refresh payload', async () => {
    // refresh uses bare axios.post, not the `api` instance, so stub axios.post.
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'fresh', user: { notAUser: true } },
    } as never);
    await expect(authApi.refresh()).rejects.toThrow(/auth response shape/);
  });
});
