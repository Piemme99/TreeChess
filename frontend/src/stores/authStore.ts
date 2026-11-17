import { create } from 'zustand';
import { authApi, setAccessToken, getAccessToken } from '../services/api';
import { getApiErrorStatus } from '../shared/utils/apiError';
import type { AuthResponse, User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  logout: async () => {
    // Clear local state first so a slow or failed revocation call can't strand
    // the user in a logging-out limbo.
    setAccessToken(null);
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
    });
    // Fire-and-forget the backend revocation (clears the httpOnly refresh cookie).
    authApi.logout().catch(() => {});
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
    checkAuthInFlight = runCheckAuthWithTimeout(set);
    try {
      await checkAuthInFlight;
    } finally {
      checkAuthInFlight = null;
    }
  },
}));

// Setter signature for the slice of state checkAuth touches.
type AuthSetState = (partial: Partial<AuthState>) => void;

// Shared across all checkAuth() callers so a double-invoked mount effect
// resolves to one auth check instead of two racing refreshes.
let checkAuthInFlight: Promise<void> | null = null;

// Hard ceiling on how long the initial auth check may keep the app on the
// full-screen spinner. If `doCheckAuth` hangs (e.g. `/auth/refresh` stalls
// with no response and never rejects), this guarantees `loading` is cleared
// so the route guards can render instead of spinning forever. The user lands
// unauthenticated; the axios interceptor will retry a refresh on their next
// action once the backend is reachable.
const CHECK_AUTH_TIMEOUT_MS = 10000;

// Wrap doCheckAuth so that `loading` is ALWAYS cleared: on success, on a
// thrown error, or after a timeout. doCheckAuth clears `loading` itself in
// every normal branch; the `finally` here is a belt-and-suspenders guard for
// the cases doCheckAuth can't cover (a synchronous throw before its first
// `set`, or a promise that never settles).
async function runCheckAuthWithTimeout(set: AuthSetState): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, CHECK_AUTH_TIMEOUT_MS);
  });
  try {
    await Promise.race([doCheckAuth(set).catch(() => {}), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    set({ loading: false });
  }
}

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

// 401/403 means the server has definitively rejected the refresh token.
// Anything else (no response at all, 5xx, timeout) is treated as transient.
function isAuthRejection(err: unknown): boolean {
  const status = getApiErrorStatus(err);
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
