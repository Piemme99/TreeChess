import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import { useRepertoireStore } from './repertoireStore';
import { createUser, createAuthResponse, createSyncResult } from '../test/factories';

// --- Mock the API module ---
vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
  },
  syncApi: {
    sync: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

import { authApi, syncApi, setAccessToken, getAccessToken } from '../services/api';

const mockAuthApi = vi.mocked(authApi);
const mockSyncApi = vi.mocked(syncApi);
const mockSetAccessToken = vi.mocked(setAccessToken);
const mockGetAccessToken = vi.mocked(getAccessToken);

// --- Helpers ---

function getState() {
  return useAuthStore.getState();
}

function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
    needsOnboarding: false,
    syncing: false,
    lastSyncResult: null,
    lastSyncError: null,
  });
}

// --- Tests ---

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // Default: sync resolves immediately
    mockSyncApi.sync.mockResolvedValue(createSyncResult());
  });

  // --- login ---

  describe('login', () => {
    it('sets user and isAuthenticated on success', async () => {
      const user = createUser();
      const response = createAuthResponse({ user, token: 'tok-123' });
      mockAuthApi.login.mockResolvedValue(response);

      await getState().login('test@example.com', 'password');

      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().error).toBeNull();
      expect(mockSetAccessToken).toHaveBeenCalledWith('tok-123');
    });

    it('triggers sync when user has lichessUsername', async () => {
      const user = createUser({ lichessUsername: 'lichessUser' });
      mockAuthApi.login.mockResolvedValue(createAuthResponse({ user }));

      await getState().login('test@example.com', 'password');

      // triggerSync is fire-and-forget, but we can check syncApi.sync was called
      await vi.waitFor(() => {
        expect(mockSyncApi.sync).toHaveBeenCalled();
      });
    });

    it('triggers sync when user has chesscomUsername', async () => {
      const user = createUser({ chesscomUsername: 'chesscomUser' });
      mockAuthApi.login.mockResolvedValue(createAuthResponse({ user }));

      await getState().login('test@example.com', 'password');

      await vi.waitFor(() => {
        expect(mockSyncApi.sync).toHaveBeenCalled();
      });
    });

    it('does NOT trigger sync when user has no platform usernames', async () => {
      const user = createUser({ lichessUsername: undefined, chesscomUsername: undefined });
      mockAuthApi.login.mockResolvedValue(createAuthResponse({ user }));

      await getState().login('test@example.com', 'password');

      // Give some time for potential fire-and-forget
      await new Promise((r) => setTimeout(r, 10));
      expect(mockSyncApi.sync).not.toHaveBeenCalled();
    });

    it('sets error from API response on failure', async () => {
      const axiosError = {
        response: { data: { error: 'Invalid credentials' } },
      };
      mockAuthApi.login.mockRejectedValue(axiosError);

      await expect(getState().login('test@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
      expect(getState().error).toBe('Invalid credentials');
      expect(getState().isAuthenticated).toBe(false);
    });

    it('uses fallback message when no response.data.error', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Network error'));

      await expect(getState().login('test@example.com', 'pass')).rejects.toThrow('Login failed');
      expect(getState().error).toBe('Login failed');
    });

    it('clears previous error before attempting login', async () => {
      useAuthStore.setState({ error: 'Previous error' });
      mockAuthApi.login.mockResolvedValue(createAuthResponse());

      await getState().login('test@example.com', 'password');

      expect(getState().error).toBeNull();
    });
  });

  // --- register ---

  describe('register', () => {
    it('sets user, isAuthenticated, and needsOnboarding on success', async () => {
      const user = createUser();
      mockAuthApi.register.mockResolvedValue(createAuthResponse({ user, token: 'reg-tok' }));

      await getState().register('test@example.com', 'testuser', 'password');

      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().needsOnboarding).toBe(true);
      expect(mockSetAccessToken).toHaveBeenCalledWith('reg-tok');
    });

    it('sets error and throws on failure', async () => {
      const axiosError = {
        response: { data: { error: 'Username already exists' } },
      };
      mockAuthApi.register.mockRejectedValue(axiosError);

      await expect(
        getState().register('test@example.com', 'taken', 'password'),
      ).rejects.toThrow('Username already exists');
      expect(getState().error).toBe('Username already exists');
    });
  });

  // --- completeOAuthLogin ---

  // The OAuth callback no longer ships the JWT in the URL (issue #124); the
  // frontend exchanges the httpOnly refresh cookie for an in-memory access
  // token via authApi.refresh().
  describe('completeOAuthLogin', () => {
    it('exchanges the refresh cookie for a token and sets the user', async () => {
      const user = createUser();
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user, token: 'oauth-access' }));

      await getState().completeOAuthLogin();

      expect(mockAuthApi.refresh).toHaveBeenCalled();
      expect(mockSetAccessToken).toHaveBeenCalledWith('oauth-access');
      expect(getState().user).toEqual(user);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().loading).toBe(false);
    });

    it('sets needsOnboarding when isNew is true', async () => {
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user: createUser() }));

      await getState().completeOAuthLogin(true);

      expect(getState().needsOnboarding).toBe(true);
    });

    it('triggers sync for returning OAuth user with platform usernames', async () => {
      const user = createUser({ lichessUsername: 'lichessUser' });
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user }));

      await getState().completeOAuthLogin(false);

      await vi.waitFor(() => {
        expect(mockSyncApi.sync).toHaveBeenCalled();
      });
    });

    it('does NOT trigger sync for new OAuth user', async () => {
      const user = createUser({ lichessUsername: 'lichessUser' });
      mockAuthApi.refresh.mockResolvedValue(createAuthResponse({ user }));

      await getState().completeOAuthLogin(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(mockSyncApi.sync).not.toHaveBeenCalled();
    });

    it('clears token and sets error when the refresh is rejected', async () => {
      // 401 short-circuits the retry loop so the call fails fast.
      mockAuthApi.refresh.mockRejectedValue({ response: { status: 401 } });

      await expect(getState().completeOAuthLogin()).rejects.toThrow(
        'Failed to complete OAuth sign-in',
      );
      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().error).toBe('Failed to complete OAuth sign-in');
    });
  });

  // --- logout ---

  describe('logout', () => {
    it('calls API, clears token, clears repertoireStore, resets state', async () => {
      // Setup: authenticated user
      useAuthStore.setState({
        user: createUser(),
        isAuthenticated: true,
        loading: false,
      });
      mockAuthApi.logout.mockResolvedValue(undefined);

      const clearAllSpy = vi.spyOn(useRepertoireStore.getState(), 'clearAll');

      await getState().logout();

      expect(mockAuthApi.logout).toHaveBeenCalled();
      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(clearAllSpy).toHaveBeenCalled();
      expect(getState().user).toBeNull();
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().loading).toBe(false);

      clearAllSpy.mockRestore();
    });
  });

  // --- checkAuth ---

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

    it('triggers sync after successful auth with platform usernames', async () => {
      const user = createUser({ chesscomUsername: 'chessUser' });
      mockGetAccessToken.mockReturnValue('tok');
      mockAuthApi.me.mockResolvedValue(user);

      await getState().checkAuth();

      await vi.waitFor(() => {
        expect(mockSyncApi.sync).toHaveBeenCalled();
      });
    });
  });

  // --- updateProfile ---

  describe('updateProfile', () => {
    it('updates user in state', async () => {
      const updatedUser = createUser({ lichessUsername: 'newUser' });
      mockAuthApi.updateProfile.mockResolvedValue(updatedUser);

      await getState().updateProfile({ lichessUsername: 'newUser' });

      expect(getState().user).toEqual(updatedUser);
    });
  });

  // --- deleteAccount ---

  describe('deleteAccount', () => {
    it('calls API, clears token, clears repertoireStore, resets state', async () => {
      useAuthStore.setState({
        user: createUser(),
        isAuthenticated: true,
      });
      mockAuthApi.deleteAccount.mockResolvedValue(undefined);
      const clearAllSpy = vi.spyOn(useRepertoireStore.getState(), 'clearAll');

      await getState().deleteAccount('password123');

      expect(mockAuthApi.deleteAccount).toHaveBeenCalledWith('password123', undefined);
      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(clearAllSpy).toHaveBeenCalled();
      expect(getState().user).toBeNull();
      expect(getState().isAuthenticated).toBe(false);

      clearAllSpy.mockRestore();
    });
  });

  // --- triggerSync ---

  describe('triggerSync', () => {
    it('calls syncApi.sync and sets result', async () => {
      const result = createSyncResult({ lichessGamesImported: 5 });
      mockSyncApi.sync.mockResolvedValue(result);

      await getState().triggerSync();

      expect(getState().syncing).toBe(false);
      expect(getState().lastSyncResult).toEqual(result);
      expect(getState().lastSyncError).toBeNull();
    });

    it('clears a previous lastSyncError on a successful sync', async () => {
      useAuthStore.setState({ lastSyncError: 'Previous sync error' });
      mockSyncApi.sync.mockResolvedValue(createSyncResult());

      await getState().triggerSync();

      expect(getState().lastSyncError).toBeNull();
    });

    it('returns early if already syncing', async () => {
      useAuthStore.setState({ syncing: true });

      await getState().triggerSync();

      expect(mockSyncApi.sync).not.toHaveBeenCalled();
    });

    it('sets syncing=false on failure without propagating error', async () => {
      mockSyncApi.sync.mockRejectedValue(new Error('Sync failed'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await getState().triggerSync(); // should NOT throw

      expect(getState().syncing).toBe(false);
      expect(getState().lastSyncResult).toBeNull();

      warnSpy.mockRestore();
    });

    it('sets lastSyncError from the API response on failure', async () => {
      mockSyncApi.sync.mockRejectedValue({
        response: { data: { error: 'Lichess is unavailable' } },
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await getState().triggerSync();

      expect(getState().lastSyncError).toBe('Lichess is unavailable');
      expect(getState().syncing).toBe(false);

      warnSpy.mockRestore();
    });

    it('does NOT surface a 429 throttle/cooldown as lastSyncError', async () => {
      useAuthStore.setState({ lastSyncError: null });
      mockSyncApi.sync.mockRejectedValue({
        response: { status: 429, data: { error: 'sync requested too soon, please wait 5m0s between syncs' } },
      });

      await getState().triggerSync();

      // A throttled background sync is benign (games are already current); it
      // must not show a scary error on the dashboard just for a quick reload.
      expect(getState().lastSyncError).toBeNull();
      expect(getState().syncing).toBe(false);
    });

    it('falls back to a generic lastSyncError when no response message', async () => {
      mockSyncApi.sync.mockRejectedValue(new Error('Network error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await getState().triggerSync();

      expect(getState().lastSyncError).toBe('Failed to sync games');

      warnSpy.mockRestore();
    });
  });

  // --- clearError / clearOnboarding ---

  describe('clearError', () => {
    it('clears the error', () => {
      useAuthStore.setState({ error: 'Some error' });
      getState().clearError();
      expect(getState().error).toBeNull();
    });
  });

  describe('clearOnboarding', () => {
    it('sets needsOnboarding to false', () => {
      useAuthStore.setState({ needsOnboarding: true });
      getState().clearOnboarding();
      expect(getState().needsOnboarding).toBe(false);
    });
  });
});
