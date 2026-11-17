import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { AuthResponse, User } from '../types';

// --- Mock the API module ---
vi.mock('../services/api', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

import { authApi, setAccessToken, getAccessToken } from '../services/api';

const mockAuthApi = vi.mocked(authApi);
const mockSetAccessToken = vi.mocked(setAccessToken);
const mockGetAccessToken = vi.mocked(getAccessToken);

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  lichessLinked: false,
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

const createAuthResponse = (overrides: Partial<AuthResponse> = {}): AuthResponse => ({
  token: 'test-access-token',
  user: createUser(),
  ...overrides,
});

function getState() {
  return useAuthStore.getState();
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, loading: true });
    vi.clearAllMocks();
  });

  describe('logout', () => {
    it('calls API, clears token, resets state', async () => {
      // Setup: authenticated user
      useAuthStore.setState({
        user: createUser(),
        isAuthenticated: true,
        loading: false,
      });
      mockAuthApi.logout.mockResolvedValue(undefined);

      await getState().logout();

      expect(mockAuthApi.logout).toHaveBeenCalled();
      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(getState().user).toBeNull();
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().loading).toBe(false);
    });
  });


  describe('checkAuth', () => {
    it('uses existing token: calls me(), sets user', async () => {
      const user = createUser();
      mockGetAccessToken.mockReturnValue('existing-token');
      mockAuthApi.me.mockResolvedValue(user);

      await getState().checkAuth();

      expect(mockAuthApi.me).toHaveBeenCalled();
      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().loading).toBe(false);
    });

    it('falls back to refresh when me() fails with existing token', async () => {
      const user = createUser();
      mockGetAccessToken.mockReturnValue('expired-token');
      mockAuthApi.me.mockRejectedValue(new Error('401'));
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user, token: 'new-tok' }));

      await getState().checkAuth();

      expect(mockAuthApi.refresh).toHaveBeenCalled();
      expect(mockSetAccessToken).toHaveBeenCalledWith('new-tok');
      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
    });

    it('tries refresh when no existing token', async () => {
      const user = createUser();
      mockGetAccessToken.mockReturnValue(null);
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user, token: 'fresh-tok' }));

      await getState().checkAuth();

      expect(mockAuthApi.me).not.toHaveBeenCalled();
      expect(mockAuthApi.refresh).toHaveBeenCalled();
      expect(getState().isAuthenticated).toBe(true);
    });

    it('dedupes concurrent calls into a single refresh (StrictMode double-invoke)', async () => {
      // React StrictMode double-invokes the mount effect that calls checkAuth.
      // With single-use refresh-token rotation, a second racing refresh would
      // send an already-consumed token and log the user out on every reload.
      const user = createUser();
      mockGetAccessToken.mockReturnValue(null);
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user, token: 'fresh-tok' }));

      await Promise.all([getState().checkAuth(), getState().checkAuth()]);

      expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);
      expect(getState().isAuthenticated).toBe(true);
    });

    it('unauthenticates when refresh is rejected with 401', async () => {
      mockGetAccessToken.mockReturnValue(null);
      const unauthorizedError = { response: { status: 401, data: { error: 'no refresh token' } } };
      mockAuthApi.refresh.mockRejectedValue(unauthorizedError);

      await getState().checkAuth();

      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(getState().user).toBeNull();
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().loading).toBe(false);
    });

    it('unauthenticates when refresh is rejected with 403', async () => {
      mockGetAccessToken.mockReturnValue(null);
      const forbiddenError = { response: { status: 403, data: { error: 'forbidden' } } };
      mockAuthApi.refresh.mockRejectedValue(forbiddenError);

      await getState().checkAuth();

      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().loading).toBe(false);
    });

    it('keeps existing auth state on transient refresh failures (network error)', async () => {
      // Simulate a logged-in user where the refresh token is still valid in
      // the browser but the backend is briefly unreachable (e.g. mid-restart).
      const existingUser = createUser();
      useAuthStore.setState({
        user: existingUser,
        isAuthenticated: true,
        loading: true,
      });
      mockGetAccessToken.mockReturnValue(null);
      const networkError = new Error('Network Error'); // axios error with no `.response`
      mockAuthApi.refresh.mockRejectedValue(networkError);

      vi.useFakeTimers();
      try {
        const promise = getState().checkAuth();
        await vi.runAllTimersAsync();
        await promise;
      } finally {
        vi.useRealTimers();
      }

      // 4 calls: initial + 3 retries (delays 300, 800, 2000 ms)
      expect(mockAuthApi.refresh).toHaveBeenCalledTimes(4);
      // Auth state preserved — only `loading` is cleared.
      expect(mockSetAccessToken).not.toHaveBeenCalledWith(null);
      expect(getState().user).toEqual(existingUser);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().loading).toBe(false);
    });

    it('keeps existing auth state on transient refresh failures (5xx)', async () => {
      useAuthStore.setState({
        user: createUser(),
        isAuthenticated: true,
        loading: true,
      });
      mockGetAccessToken.mockReturnValue(null);
      mockAuthApi.refresh.mockRejectedValue({ response: { status: 503 } });

      vi.useFakeTimers();
      try {
        const promise = getState().checkAuth();
        await vi.runAllTimersAsync();
        await promise;
      } finally {
        vi.useRealTimers();
      }

      expect(mockAuthApi.refresh).toHaveBeenCalledTimes(4);
      expect(mockSetAccessToken).not.toHaveBeenCalledWith(null);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().loading).toBe(false);
    });

    it('recovers when refresh succeeds after a transient failure', async () => {
      const user = createUser();
      mockGetAccessToken.mockReturnValue(null);
      mockAuthApi.refresh
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(createAuthResponse({ user, token: 'recovered-tok' }));

      vi.useFakeTimers();
      try {
        const promise = getState().checkAuth();
        await vi.runAllTimersAsync();
        await promise;
      } finally {
        vi.useRealTimers();
      }

      expect(mockAuthApi.refresh).toHaveBeenCalledTimes(3);
      expect(mockSetAccessToken).toHaveBeenCalledWith('recovered-tok');
      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
    });

    it('clears loading even when doCheckAuth throws before setting state', async () => {
      // If the very first call (getAccessToken / me) throws synchronously
      // before any `set`, the app must not be wedged on the spinner.
      mockGetAccessToken.mockImplementation(() => {
        throw new Error('boom');
      });

      await getState().checkAuth();

      expect(getState().loading).toBe(false);
    });

    it('clears loading after the timeout when the auth check hangs forever', async () => {
      // Simulate /auth/refresh stalling: a promise that never settles. Without
      // the timeout escape, both route guards would render Loading forever.
      const existingUser = createUser();
      useAuthStore.setState({
        user: existingUser,
        isAuthenticated: true,
        loading: true,
      });
      mockGetAccessToken.mockReturnValue(null);
      mockAuthApi.refresh.mockReturnValue(new Promise(() => {}));

      vi.useFakeTimers();
      try {
        const promise = getState().checkAuth();
        // Advance past the 10s timeout ceiling.
        await vi.advanceTimersByTimeAsync(10000);
        await promise;
      } finally {
        vi.useRealTimers();
      }

      // Loading is cleared so guards can render; auth state is untouched
      // because the hanging refresh never resolved or rejected.
      expect(getState().loading).toBe(false);
    });
  });
});
