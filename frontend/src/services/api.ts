import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type {
  Repertoire,
  ArrowAnnotation,
  SquareHighlightAnnotation,
  AddNodeRequest,
  Color,
  AnalysisSummary,
  AnalysisDetail,
  UploadResponse,
  GamesResponse,
  GameAnalysis,
  LichessImportOptions,
  ChesscomImportOptions,
  CreateRepertoireRequest,
  UpdateRepertoireRequest,
  AuthResponse,
  User,
  UpdateProfileRequest,
  SyncResult,
  StudyInfo,
  StudyImportResponse,
  InsightsResponse,
  DashboardStatsResponse,
  Category,
  CategoryWithRepertoires,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  RepertoireFilterOption,
  LichessStudySearchResponse,
  LichessTopicsResponse,
  TrainingAnalyzeResponse,
  ExploreTemplate
} from '../types';
import { triggerReanalysisPolling } from '../stores/reanalysisStore';
import { getApiErrorStatus } from '../shared/utils/apiError';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Options for API requests that support cancellation */
export interface RequestOptions {
  signal?: AbortSignal;
}

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
        accessToken = response.data.token;
        return response.data;
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

// Response interceptor - handle 401 with automatic token refresh
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
  register: async (email: string, username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', { email, username, password });
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },

  hasPassword: async (): Promise<{ hasPassword: boolean }> => {
    const response = await api.get('/auth/has-password');
    return response.data;
  },

  deleteAccount: async (password?: string, username?: string): Promise<void> => {
    await api.delete('/auth/account', { data: { password, username } });
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — we clear local state regardless
    }
  },

  refresh: async (): Promise<AuthResponse> => {
    // Shares the single in-flight refresh so callers can never trigger a
    // second, racing token rotation.
    return refreshAccessToken();
  },
};

// Repertoire API
export const repertoireApi = {
  list: async (color?: Color): Promise<Repertoire[]> => {
    const params = color ? { color } : {};
    const response = await api.get('/repertoires', { params });
    return response.data;
  },

  get: async (id: string): Promise<Repertoire> => {
    const response = await api.get(`/repertoires/${id}`);
    return response.data;
  },

  create: async (data: CreateRepertoireRequest): Promise<Repertoire> => {
    const response = await api.post('/repertoires', data);
    return response.data;
  },

  rename: async (id: string, name: string): Promise<Repertoire> => {
    const data: UpdateRepertoireRequest = { name };
    const response = await api.patch(`/repertoires/${id}`, data);
    return response.data;
  },

  updateDescription: async (id: string, description: string): Promise<Repertoire> => {
    const data: UpdateRepertoireRequest = { description };
    const response = await api.patch(`/repertoires/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/repertoires/${id}`);
    triggerReanalysisPolling();
  },

  addNode: async (id: string, data: AddNodeRequest): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes`, data);
    triggerReanalysisPolling();
    return response.data;
  },

  deleteNode: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.delete(`/repertoires/${id}/nodes/${nodeId}`);
    triggerReanalysisPolling();
    return response.data;
  },

  listTemplates: async (): Promise<{ id: string; name: string; color: string; description: string }[]> => {
    const response = await api.get('/repertoires/templates');
    return response.data;
  },

  seedFromTemplates: async (templateIds: string[]): Promise<Repertoire[]> => {
    const response = await api.post('/repertoires/seed', { templateIds });
    triggerReanalysisPolling();
    return response.data;
  },

  extractSubtree: async (id: string, nodeId: string, name: string): Promise<{ original: Repertoire; extracted: Repertoire }> => {
    const response = await api.post(`/repertoires/${id}/extract`, { nodeId, name });
    triggerReanalysisPolling();
    return response.data;
  },

  mergeRepertoires: async (ids: string[], name: string): Promise<{ merged: Repertoire }> => {
    const response = await api.post('/repertoires/merge', { ids, name });
    triggerReanalysisPolling();
    return response.data;
  },

  updateNodeComment: async (id: string, nodeId: string, comment: string): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/nodes/${nodeId}/comment`, { comment });
    return response.data;
  },

  updateNodeBranchName: async (id: string, nodeId: string, branchName: string): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/nodes/${nodeId}/branch-name`, { branchName });
    return response.data;
  },

  updateNodeBranchColor: async (id: string, nodeId: string, branchColor: string): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/nodes/${nodeId}/branch-color`, { branchColor });
    return response.data;
  },

  updateNodeAnnotations: async (
    id: string,
    nodeId: string,
    arrows: ArrowAnnotation[],
    highlights: SquareHighlightAnnotation[],
  ): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/nodes/${nodeId}/annotations`, { arrows, highlights });
    return response.data;
  },

  mergeTranspositions: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/merge-transpositions`);
    triggerReanalysisPolling();
    return response.data;
  },

  toggleNodeCollapsed: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes/${nodeId}/toggle-collapsed`);
    return response.data;
  },

  expandToNode: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes/${nodeId}/expand-to`);
    return response.data;
  },

  setMainLine: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes/${nodeId}/set-main-line`);
    return response.data;
  },

  clearMainLine: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/clear-main-line`);
    return response.data;
  },

  assignCategory: async (id: string, categoryId: string | null): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/category`, { categoryId });
    return response.data;
  },

  updateVisibility: async (id: string, isPublic: boolean): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/visibility`, { isPublic });
    return response.data;
  }
};

// Explore API (public repertoires + starter templates)
export const exploreApi = {
  listPublic: async (): Promise<Repertoire[]> => {
    const response = await api.get('/explore/repertoires');
    return response.data;
  },

  getPublic: async (id: string): Promise<Repertoire> => {
    const response = await api.get(`/explore/repertoires/${id}`);
    return response.data;
  },

  importRepertoire: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/explore/repertoires/${id}/import`);
    triggerReanalysisPolling();
    return response.data;
  },

  listTemplates: async (): Promise<ExploreTemplate[]> => {
    const response = await api.get('/explore/templates');
    return response.data;
  },

  importTemplate: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/explore/templates/${id}/import`);
    triggerReanalysisPolling();
    return response.data;
  }
};

// Category API
export const categoryApi = {
  list: async (color?: Color): Promise<Category[]> => {
    const params = color ? { color } : {};
    const response = await api.get('/categories', { params });
    return response.data;
  },

  get: async (id: string): Promise<CategoryWithRepertoires> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  create: async (data: CreateCategoryRequest): Promise<Category> => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  rename: async (id: string, name: string): Promise<Category> => {
    const data: UpdateCategoryRequest = { name };
    const response = await api.patch(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  }
};

// Import/Analysis API
export const importApi = {
  upload: async (file: File, username: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);

    const response = await api.post('/imports', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  importFromLichess: async (username: string, options?: LichessImportOptions): Promise<UploadResponse> => {
    const response = await api.post('/imports/lichess', { username, options });
    return response.data;
  },

  importFromChesscom: async (username: string, options?: ChesscomImportOptions): Promise<UploadResponse> => {
    const response = await api.post('/imports/chesscom', { username, options });
    return response.data;
  },

  list: async (options?: RequestOptions): Promise<AnalysisSummary[]> => {
    const response = await api.get('/analyses', { signal: options?.signal });
    return response.data;
  },

  get: async (id: string, options?: RequestOptions): Promise<AnalysisDetail> => {
    const response = await api.get(`/analyses/${id}`, { signal: options?.signal });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/analyses/${id}`);
  }
};

// Sync API
export const syncApi = {
  sync: async (): Promise<SyncResult> => {
    const response = await api.post('/sync');
    return response.data;
  },
};

// Health API
export const healthApi = {
  check: async (): Promise<{ status: string }> => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Study Import API
export const studyApi = {
  preview: async (url: string): Promise<StudyInfo> => {
    const response = await api.get('/studies/preview', { params: { url }, timeout: 120000 });
    return response.data;
  },

  browse: async (params: { q?: string; topic?: string; order?: string; page?: number }): Promise<LichessStudySearchResponse> => {
    const response = await api.get('/studies/browse', { params });
    return response.data;
  },

  topics: async (): Promise<LichessTopicsResponse> => {
    const response = await api.get('/studies/topics');
    return response.data;
  },

  import: async (
    studyUrl: string,
    chapters: number[],
    mergeAsOne?: boolean,
    mergeName?: string,
    createCategory?: boolean,
    categoryName?: string,
    includeComments?: boolean,
    includeHints?: boolean,
    ownerName?: string,
    renameStrategy?: 'abort' | 'auto-suffix'
  ): Promise<StudyImportResponse> => {
    const body: Record<string, unknown> = { studyUrl, chapters };
    if (mergeAsOne) {
      body.mergeAsOne = true;
      if (mergeName) body.mergeName = mergeName;
    } else if (createCategory) {
      body.createCategory = true;
      if (categoryName) body.categoryName = categoryName;
    }
    body.includeComments = includeComments ?? false;
    body.includeHints = includeHints ?? true;
    if (ownerName) body.ownerName = ownerName;
    if (renameStrategy) body.renameStrategy = renameStrategy;
    const response = await api.post('/studies/import', body, { timeout: 120000 });
    triggerReanalysisPolling();
    return response.data;
  },
};

// Games API
export const gamesApi = {
  list: async (limit = 20, offset = 0, timeClass?: string, repertoire?: string, source?: string, options?: RequestOptions): Promise<GamesResponse> => {
    const params: Record<string, string | number> = { limit, offset };
    if (timeClass) {
      params.timeClass = timeClass;
    }
    if (repertoire) {
      params.repertoire = repertoire;
    }
    if (source) {
      params.source = source;
    }
    const response = await api.get('/games', {
      params,
      signal: options?.signal
    });
    return response.data;
  },

  repertoires: async (options?: RequestOptions): Promise<RepertoireFilterOption[]> => {
    const response = await api.get('/games/repertoires', { signal: options?.signal });
    return response.data.repertoires;
  },

  // Games tagged "New" (synced from a platform and not yet viewed) across all
  // imports — the set the analyse-session steps through.
  listNew: async (limit = 100, offset = 0, options?: RequestOptions): Promise<GamesResponse> => {
    const response = await api.get('/games', {
      params: { limit, offset, new: 'true' },
      signal: options?.signal
    });
    return response.data;
  },

  reanalyze: async (analysisId: string, gameIndex: number, repertoireId: string): Promise<GameAnalysis> => {
    const response = await api.post(`/games/${analysisId}/${gameIndex}/reanalyze`, { repertoireId });
    return response.data;
  },

  markViewed: async (analysisId: string, gameIndex: number): Promise<void> => {
    await api.post(`/games/${analysisId}/${gameIndex}/view`);
  },

  insights: async (options?: RequestOptions): Promise<InsightsResponse> => {
    const response = await api.get('/games/insights', { signal: options?.signal });
    return response.data;
  },

  dismissMistake: async (fen: string, playedMove: string): Promise<void> => {
    await api.post('/games/insights/dismiss', { fen, playedMove });
  },

  reanalyzeAll: async (): Promise<{ reanalyzed: number }> => {
    const response = await api.post('/games/reanalyze-all');
    return response.data;
  },

  reanalysisStatus: async (options?: RequestOptions): Promise<ReanalysisStatus> => {
    const response = await api.get('/games/reanalysis-status', { signal: options?.signal });
    return response.data;
  }
};

export interface ReanalysisStatus {
  inProgress: boolean;
  pending: boolean;
}

export interface OpeningExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface OpeningExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: OpeningExplorerMove[];
}

export const trainingApi = {
  analyze: async (moves: string[], userColor: 'white' | 'black'): Promise<TrainingAnalyzeResponse> => {
    const response = await api.post('/training/analyze', { moves, userColor });
    return response.data;
  },
  opening: async (fen: string): Promise<OpeningExplorerResponse> => {
    const response = await api.get('/training/opening', { params: { fen } });
    return response.data;
  },
};

export const dashboardApi = {
  stats: async (options?: RequestOptions): Promise<DashboardStatsResponse> => {
    const response = await api.get('/dashboard/stats', { signal: options?.signal });
    return response.data;
  },
  dismissGap: async (fen: string, opponentMove: string, repertoireId: string): Promise<void> => {
    await api.post('/dashboard/gaps/dismiss', { fen, opponentMove, repertoireId });
  },
};
