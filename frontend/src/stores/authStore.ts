import { create } from 'zustand';
import { authApi, syncApi, setAccessToken, getAccessToken } from '../services/api';
import { useRepertoireStore } from './repertoireStore';
import type { AuthResponse, User, UpdateProfileRequest, SyncResult } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  needsOnboarding: boolean;
  syncing: boolean;
  lastSyncResult: SyncResult | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  handleOAuthToken: (token: string, isNew?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  clearOnboarding: () => void;
  triggerSync: () => Promise<void>;
  deleteAccount: (password?: string, username?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  needsOnboarding: false,
  syncing: false,
  lastSyncResult: null,

  login: async (email: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.login(email, password);
      // Store access token in memory only (never localStorage)
      setAccessToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        error: null,
      });
      // Fire-and-forget sync if user has platform usernames configured
      if (response.user.lichessUsername || response.user.chesscomUsername) {
        useAuthStore.getState().triggerSync();
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Login failed');
      set({ error: message });
      throw new Error(message, { cause: err });
    }
  },

  register: async (email: string, username: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.register(email, username, password);
      // Store access token in memory only (never localStorage)
      setAccessToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        needsOnboarding: true,
        error: null,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Registration failed');
      set({ error: message });
      throw new Error(message, { cause: err });
    }
  },

  handleOAuthToken: async (token: string, isNew = false) => {
    // OAuth callback provides the access token via URL parameter
    // The refresh token was already set as an httpOnly cookie by the backend
    setAccessToken(token);
    set({ error: null });
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        needsOnboarding: isNew,
        loading: false,
      });
      // Fire-and-forget sync for returning OAuth users with platform usernames
      if (!isNew && (user.lichessUsername || user.chesscomUsername)) {
        useAuthStore.getState().triggerSync();
      }
    } catch {
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: 'Failed to verify OAuth token',
      });
      throw new Error('Failed to verify OAuth token');
    }
  },

  logout: async () => {
    // Call backend to revoke the refresh token and clear the httpOnly cookie
    await authApi.logout();
    setAccessToken(null);
    // Clear cached data from other stores to prevent data leaking between accounts
    useRepertoireStore.getState().clearAll();
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  checkAuth: async () => {
    // React StrictMode double-invokes the mount effect that calls checkAuth
    // (and a hot-reload remount can overlap a prior run), so dedupe onto a
    // single in-flight promise. Combined with the coalesced refresh in api.ts,
    // this guarantees one auth check — and one refresh-token rotation — per
    // burst, instead of a second racing refresh that logs the user out.
    if (checkAuthInFlight) {
      return checkAuthInFlight;
    }
    checkAuthInFlight = doCheckAuth(set);
    try {
      await checkAuthInFlight;
    } finally {
      checkAuthInFlight = null;
    }
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data: UpdateProfileRequest) => {
    const user = await authApi.updateProfile(data);
    set({ user });
  },

  clearOnboarding: () => set({ needsOnboarding: false }),

  deleteAccount: async (password?: string, username?: string) => {
    await authApi.deleteAccount(password, username);
    // Clean up exactly like logout
    setAccessToken(null);
    useRepertoireStore.getState().clearAll();
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  triggerSync: async () => {
    if (useAuthStore.getState().syncing) {
      return;
    }
    set({ syncing: true, lastSyncResult: null });
    try {
      const result = await syncApi.sync();
      set({ syncing: false, lastSyncResult: result });
    } catch {
      set({ syncing: false });
    }
  },
}));

// Setter signature for the slice of state checkAuth touches.
type AuthSetState = (partial: Partial<AuthState>) => void;

// Shared across all checkAuth() callers so a double-invoked mount effect
// resolves to one auth check instead of two racing refreshes.
let checkAuthInFlight: Promise<void> | null = null;

async function doCheckAuth(set: AuthSetState): Promise<void> {
  // First try to use an existing in-memory access token
  const existingToken = getAccessToken();
  if (existingToken) {
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        loading: false,
      });
      if (user.lichessUsername || user.chesscomUsername) {
        useAuthStore.getState().triggerSync();
      }
      return;
    } catch {
      // Access token expired or invalid — try refreshing below
    }
  }

  // Try to get a new access token using the refresh token cookie.
  // Retry transient failures (network / 5xx) so a backend that's briefly
  // unreachable (e.g. mid-restart during dev hot-reload, or a deploy in
  // prod) doesn't bounce the user to /login while the refresh cookie is
  // still valid.
  try {
    const response = await refreshWithRetry();
    setAccessToken(response.token);
    set({
      user: response.user,
      isAuthenticated: true,
      loading: false,
    });
    if (response.user.lichessUsername || response.user.chesscomUsername) {
      useAuthStore.getState().triggerSync();
    }
  } catch (err) {
    if (isAuthRejection(err)) {
      // Definitive: the refresh cookie is gone or rejected by the server.
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    } else {
      // Transient failure outlasted our retries. Don't flip auth state —
      // the next user-initiated request will trigger another refresh via
      // the axios interceptor once the backend is reachable again.
      set({ loading: false });
    }
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    if (axiosErr.response?.data?.error) {
      return axiosErr.response.data.error;
    }
  }
  return fallback;
}

// 401/403 means the server has definitively rejected the refresh token.
// Anything else (no response at all, 5xx, timeout) is treated as transient.
function isAuthRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('response' in err)) {
    return false;
  }
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 401 || status === 403;
}

const REFRESH_RETRY_DELAYS_MS = [300, 800, 2000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry transient refresh failures with backoff. Auth rejections (401/403)
// short-circuit immediately; the caller decides what to do with them.
async function refreshWithRetry(): Promise<AuthResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await authApi.refresh();
    } catch (err) {
      lastError = err;
      if (isAuthRejection(err)) {
        throw err;
      }
      const nextDelay = REFRESH_RETRY_DELAYS_MS[attempt];
      if (nextDelay === undefined) {
        break;
      }
      await delay(nextDelay);
    }
  }
  throw lastError;
}
