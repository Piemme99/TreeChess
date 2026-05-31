import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import {
  api,
  authApi,
  repertoireApi,
  setAccessToken,
  getAccessToken,
  __resetRepertoireVersions,
} from './api';

// We exercise the REAL request/response interceptors on the `api` instance.
// Requests through `api` are served by a custom adapter we install on
// `api.defaults.adapter`; the /auth/refresh call uses bare `axios.post`
// (so a failed refresh never re-enters the interceptor) and is stubbed via a
// spy on `axios.post`.

// The refresh path now validates its payload against the auth schema, so stubs
// must carry a complete `user`. `refreshResponse` builds a valid AuthResponse
// for the given token; these tests assert interceptor/coalescing behavior, not
// the user shape, so any valid user works.
const validUser = {
  id: 'u1',
  username: 'tester',
  lichessLinked: false,
  createdAt: '2024-01-01T00:00:00Z',
};

function refreshResponse(token: string) {
  return { data: { token, user: validUser } };
}

interface AdapterCall {
  url?: string;
  method?: string;
  headers: Record<string, unknown>;
  retry: boolean;
}

/** A scripted response/error for the next matching adapter invocation. */
type Outcome =
  | { kind: 'ok'; status: number; data: unknown; headers?: Record<string, string> }
  | { kind: 'status'; status: number; data?: unknown }
  | { kind: 'cancel' };

function ok(data: unknown, status = 200, headers?: Record<string, string>): Outcome {
  return { kind: 'ok', status, data, headers };
}

function status(code: number, data?: unknown): Outcome {
  return { kind: 'status', status: code, data };
}

/**
 * Build an adapter that pulls outcomes from a queue, recording each call.
 * The queue lets us script a 401-then-200 sequence for the retry path.
 */
function makeAdapter(queue: Outcome[], calls: AdapterCall[]): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) => {
    const headers =
      config.headers instanceof AxiosHeaders
        ? (config.headers.toJSON() as Record<string, unknown>)
        : ((config.headers ?? {}) as Record<string, unknown>);
    calls.push({
      url: config.url,
      method: config.method,
      headers,
      retry: (config as { _retry?: boolean })._retry === true,
    });

    const outcome = queue.shift();
    if (!outcome) {
      return Promise.reject(new Error(`no scripted outcome for ${config.url}`));
    }

    const buildResponse = (s: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse => ({
      data,
      status: s,
      statusText: '',
      headers,
      config,
    });

    if (outcome.kind === 'ok') {
      return Promise.resolve(buildResponse(outcome.status, outcome.data, outcome.headers ?? {}));
    }
    if (outcome.kind === 'cancel') {
      const err = new AxiosError('canceled', AxiosError.ERR_CANCELED, config);
      return Promise.reject(err);
    }
    // status error
    const err = new AxiosError(
      `request failed ${outcome.status}`,
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      buildResponse(outcome.status, outcome.data ?? {}),
    );
    return Promise.reject(err);
  };
}

let calls: AdapterCall[];
let queue: Outcome[];
let originalAdapter: typeof api.defaults.adapter;

beforeEach(() => {
  calls = [];
  queue = [];
  originalAdapter = api.defaults.adapter;
  api.defaults.adapter = makeAdapter(queue, calls);
  setAccessToken(null);
  __resetRepertoireVersions();
  vi.restoreAllMocks();
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('request interceptor (token injection)', () => {
  it('attaches the in-memory access token as a Bearer header', async () => {
    setAccessToken('tok-123');
    queue.push(ok({ ok: true }));

    await api.get('/anything');

    expect(getAccessToken()).toBe('tok-123');
    expect(calls[0].headers.Authorization).toBe('Bearer tok-123');
  });

  it('sends no Authorization header when there is no token', async () => {
    queue.push(ok({ ok: true }));

    await api.get('/anything');

    expect(calls[0].headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor — 401 refresh', () => {
  it('refreshes on 401, retries the original request with the new token, and succeeds', async () => {
    setAccessToken('stale');
    // Refresh succeeds via bare axios.post → new token.
    const refreshSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValue(refreshResponse('fresh') as never);

    // First call 401, retried call 200.
    queue.push(status(401));
    queue.push(ok({ value: 42 }));

    const res = await api.get('/protected');

    expect(res.data).toEqual({ value: 42 });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    // The retry carries the freshly minted token and is flagged _retry.
    expect(calls).toHaveLength(2);
    expect(calls[1].retry).toBe(true);
    expect(calls[1].headers.Authorization).toBe('Bearer fresh');
    expect(getAccessToken()).toBe('fresh');
  });

  it('coalesces concurrent 401s into a single refresh-token rotation', async () => {
    setAccessToken('stale');
    let refreshCount = 0;
    const refreshSpy = vi.spyOn(axios, 'post').mockImplementation((() => {
      refreshCount += 1;
      // Resolve on a microtask so both 401 handlers observe the same in-flight promise.
      return new Promise((resolve) =>
        setTimeout(() => resolve(refreshResponse(`fresh-${refreshCount}`)), 10),
      );
    }) as never);

    // Two independent requests both 401, then both retried OK.
    queue.push(status(401));
    queue.push(status(401));
    queue.push(ok({ id: 'a' }));
    queue.push(ok({ id: 'b' }));

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(a.data).toEqual({ id: 'a' });
    expect(b.data).toEqual({ id: 'b' });
    // Exactly ONE rotation despite two racing 401s.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    // Both retries used the single fresh token.
    const retries = calls.filter((c) => c.retry);
    expect(retries).toHaveLength(2);
    expect(retries[0].headers.Authorization).toBe('Bearer fresh-1');
    expect(retries[1].headers.Authorization).toBe('Bearer fresh-1');
  });

  it('does not retry a second time (the _retry guard) if the retried request also 401s', async () => {
    setAccessToken('stale');
    const refreshSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValue(refreshResponse('fresh') as never);

    // 401 → refresh → retried request 401 again. The guard must stop here.
    queue.push(status(401));
    queue.push(status(401));

    await expect(api.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    // Only one refresh, only one retry (two total adapter calls).
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('on a definitive refresh rejection (401), clears the token and dispatches auth:unauthorized', async () => {
    setAccessToken('stale');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    // Refresh itself rejected with a 401 → refresh token is dead.
    vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('unauth', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 401,
        data: {},
        statusText: '',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }),
    );

    queue.push(status(401));

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(getAccessToken()).toBeNull();
    const dispatched = dispatchSpy.mock.calls.map((c) => (c[0] as Event).type);
    expect(dispatched).toContain('auth:unauthorized');
  });

  it('on a TRANSIENT refresh failure (network/5xx) does NOT log the user out', async () => {
    setAccessToken('stale');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    // Refresh failed with no response (transport error) → transient.
    vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('network down', 'ERR_NETWORK'),
    );

    queue.push(status(401));

    await expect(api.get('/protected')).rejects.toBeTruthy();

    // Token preserved, no logout event.
    expect(getAccessToken()).toBe('stale');
    const dispatched = dispatchSpy.mock.calls.map((c) => (c[0] as Event).type);
    expect(dispatched).not.toContain('auth:unauthorized');
  });

  it('treats a 5xx refresh response as transient (no logout)', async () => {
    setAccessToken('stale');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('boom', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 503,
        data: {},
        statusText: '',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }),
    );

    queue.push(status(401));

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(getAccessToken()).toBe('stale');
    expect(
      dispatchSpy.mock.calls.map((c) => (c[0] as Event).type),
    ).not.toContain('auth:unauthorized');
  });
});

describe('response interceptor — non-401 / cancellation', () => {
  it('passes through a canceled request without attempting a refresh', async () => {
    setAccessToken('tok');
    const refreshSpy = vi.spyOn(axios, 'post');
    queue.push({ kind: 'cancel' });

    await expect(api.get('/x')).rejects.toMatchObject({ code: 'ERR_CANCELED' });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('does not refresh on a non-401 error (e.g. 500)', async () => {
    setAccessToken('tok');
    const refreshSpy = vi.spyOn(axios, 'post');
    queue.push(status(500));

    await expect(api.get('/x')).rejects.toMatchObject({
      response: { status: 500 },
    });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('does not refresh on a 403 (forbidden, not unauthenticated)', async () => {
    setAccessToken('tok');
    const refreshSpy = vi.spyOn(axios, 'post');
    queue.push(status(403));

    await expect(api.get('/x')).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe('repertoire optimistic concurrency (If-Match / 409)', () => {
  const REP_ID = '123e4567-e89b-12d3-a456-426614174000';
  const NODE_ID = '223e4567-e89b-12d3-a456-426614174000';

  it('caches the version from a GET response (body) and a mutation response', async () => {
    // GET seeds the cache from the JSON body's version.
    queue.push(ok({ id: REP_ID, version: 4 }));
    await repertoireApi.get(REP_ID);

    // Next mutation should carry If-Match: 4 and update the cache from the
    // response (version 5).
    queue.push(ok({ id: REP_ID, version: 5 }));
    await repertoireApi.updateNodeComment(REP_ID, NODE_ID, 'hi');

    expect(calls).toHaveLength(2);
    expect(calls[1].headers['If-Match']).toBe('4');

    // A subsequent mutation uses the bumped version from the prior response.
    queue.push(ok({ id: REP_ID, version: 6 }));
    await repertoireApi.updateNodeComment(REP_ID, NODE_ID, 'again');
    expect(calls[2].headers['If-Match']).toBe('5');
  });

  it('prefers the ETag response header when caching the version', async () => {
    queue.push(ok({ id: REP_ID }, 200, { etag: '9' }));
    await repertoireApi.get(REP_ID);

    queue.push(ok({ id: REP_ID, version: 10 }));
    await repertoireApi.toggleNodeCollapsed(REP_ID, NODE_ID);

    expect(calls[1].headers['If-Match']).toBe('9');
  });

  it('does not attach If-Match to a GET (reads need no precondition)', async () => {
    queue.push(ok({ id: REP_ID, version: 2 }));
    await repertoireApi.get(REP_ID);

    queue.push(ok({ id: REP_ID, version: 2 }));
    await repertoireApi.get(REP_ID);

    expect(calls[1].headers['If-Match']).toBeUndefined();
  });

  it('on 409, re-fetches the repertoire and retries the mutation once with the fresh version', async () => {
    // Seed cache at version 1.
    queue.push(ok({ id: REP_ID, version: 1 }));
    await repertoireApi.get(REP_ID);

    // Mutation with stale If-Match: 1 → 409; re-fetch returns version 7; retry
    // succeeds with If-Match: 7.
    queue.push(status(409, { error: 'conflict' }));
    queue.push(ok({ id: REP_ID, version: 7 })); // the re-fetch GET
    queue.push(ok({ id: REP_ID, version: 8 })); // the retried mutation

    const result = await repertoireApi.setMainLine(REP_ID, NODE_ID);

    expect(result.version).toBe(8);
    // calls: [0] initial GET, [1] mutation (409), [2] re-fetch GET, [3] retry mutation
    expect(calls).toHaveLength(4);
    expect(calls[1].headers['If-Match']).toBe('1');
    expect(calls[2].method).toBe('get');
    expect(calls[3].headers['If-Match']).toBe('7');
  });

  it('does not retry a second time if the replayed mutation also 409s', async () => {
    queue.push(ok({ id: REP_ID, version: 1 }));
    await repertoireApi.get(REP_ID);

    queue.push(status(409)); // first mutation
    queue.push(ok({ id: REP_ID, version: 2 })); // re-fetch GET
    queue.push(status(409)); // retried mutation 409s again

    await expect(repertoireApi.clearMainLine(REP_ID)).rejects.toMatchObject({
      response: { status: 409 },
    });

    // initial GET + mutation + re-fetch + single retry = 4 calls, then stop.
    expect(calls).toHaveLength(4);
  });
});

describe('authApi.refresh', () => {
  it('shares the single in-flight refresh promise across callers', async () => {
    const refreshSpy = vi.spyOn(axios, 'post').mockImplementation((() =>
      new Promise((resolve) =>
        setTimeout(() => resolve(refreshResponse('shared')), 5),
      )) as never);

    const [r1, r2] = await Promise.all([authApi.refresh(), authApi.refresh()]);

    expect(r1.token).toBe('shared');
    expect(r2.token).toBe('shared');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe('shared');
  });
});
