import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type { AuthResponse, User } from '../types';
import { authResponseSchema, validateResponse } from './apiSchemas';
import { getApiErrorStatus } from '../shared/utils/apiError';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// --- In-memory access token management ---
// The access token is stored ONLY in memory (never in localStorage)
// to prevent XSS-based token theft. The refresh token is stored
// in an httpOnly cookie managed by the browser automatically.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Exported so tests can install a custom axios adapter and exercise the real
// request/response interceptors (token injection, 401-refresh coalescing).
// Production code uses the named *Api objects below, not this instance directly.
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true, // Send httpOnly cookies (refresh_token) with every request
});

// --- Token refresh logic ---
// A single in-flight refresh is shared across ALL callers (the response
// interceptor below AND authStore.checkAuth). Refresh tokens are single-use:
// the backend rotates — i.e. deletes — the old token on every refresh. If two
// refreshes race (e.g. React StrictMode double-invokes the app's mount effect
// on every dev hot-reload, firing two checkAuth() calls), the second sends an
// already-consumed token, gets a 401, and logs the user out. Coalescing onto
// one promise guarantees exactly one rotation per burst.
let inflightRefresh: Promise<AuthResponse> | null = null;

function refreshAccessToken(): Promise<AuthResponse> {
  if (!inflightRefresh) {
    // Use bare axios (not the `api` instance) so a 401 here never re-enters
    // the response interceptor and triggers a recursive refresh.
    inflightRefresh = axios
      .post<AuthResponse>(`${API_BASE}/auth/refresh`, null, { withCredentials: true })
      .then((response) => {
        const data = validateResponse(authResponseSchema, response.data, 'auth');
        accessToken = data.token;
        return data;
      })
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

// 401/403 from /auth/refresh means the refresh token itself is rejected
// (expired, revoked, missing). Anything else (no response, 5xx, timeout)
// is transient — we should not log the user out for those.
function isAuthRejection(err: unknown): boolean {
  const status = getApiErrorStatus(err);
  return status === 401 || status === 403;
}

// Request interceptor - inject access token from memory
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor - handle 401 with automatic token refresh.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If we get a 401 and haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Coalesced refresh — concurrent 401s share one network request and
        // therefore one refresh-token rotation.
        const { token } = await refreshAccessToken();

        // Retry the original request with the new token
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${token}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        if (isAuthRejection(refreshError)) {
          // Definitive: refresh token rejected. Clear state and signal
          // the app so it can route to /login.
          accessToken = null;
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        // Transient (network / 5xx): don't unauthenticate — the next request
        // will trigger another refresh once the backend is reachable again.
        return Promise.reject(error);
      }
    }

    // A 401 on an already-retried request means the freshly-refreshed token
    // was itself rejected on replay. Treat this as definitive: the refresh
    // branch above is skipped (_retry is true), so without this the app would
    // sit silently 401-ing. Clear state and signal the app to route to /login.
    if (error.response?.status === 401 && originalRequest._retry) {
      accessToken = null;
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — we clear local state regardless
    }
  },

  /** Un compte Lichess reçoit l'adresse de Lichess, qui confirme la suppression ; sinon le compte est déjà supprimé. */
  startAccountDeletion: async (username: string): Promise<{ redirect?: string }> => {
    const response = await api.post<{ redirect?: string } | ''>('/auth/account/deletion', { username });
    return response.data || {};
  },

  refresh: async (): Promise<AuthResponse> => {
    // Shares the single in-flight refresh so callers can never trigger a
    // second, racing token rotation.
    return refreshAccessToken();
  },
};
