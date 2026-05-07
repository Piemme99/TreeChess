import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type {
  Repertoire,
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

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true, // Send httpOnly cookies (refresh_token) with every request
});

// --- Token refresh logic ---
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
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
      // Don't try to refresh if the failing request IS the refresh endpoint
      if (originalRequest.url === '/auth/refresh') {
        accessToken = null;
        window.dispatchEvent(new Event('auth:unauthorized'));
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          // Call refresh endpoint — the browser sends the httpOnly cookie automatically
          const response = await axios.post(`${API_BASE}/auth/refresh`, null, {
            withCredentials: true,
          });

          const newAccessToken = response.data.token;
          accessToken = newAccessToken;
          isRefreshing = false;
          onRefreshed(newAccessToken);

          // Retry the original request with the new token
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          return api(originalRequest);
        } catch {
          isRefreshing = false;
          accessToken = null;
          refreshSubscribers = [];
          window.dispatchEvent(new Event('auth:unauthorized'));
          return Promise.reject(error);
        }
      } else {
        // Another request is already refreshing — queue this one
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${newToken}`,
            };
            resolve(api(originalRequest));
          });
        });
      }
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
    const response = await api.post('/auth/refresh');
    return response.data;
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
  },

  addNode: async (id: string, data: AddNodeRequest): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes`, data);
    return response.data;
  },

  deleteNode: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.delete(`/repertoires/${id}/nodes/${nodeId}`);
    return response.data;
  },

  listTemplates: async (): Promise<{ id: string; name: string; color: string; description: string }[]> => {
    const response = await api.get('/repertoires/templates');
    return response.data;
  },

  seedFromTemplates: async (templateIds: string[]): Promise<Repertoire[]> => {
    const response = await api.post('/repertoires/seed', { templateIds });
    return response.data;
  },

  extractSubtree: async (id: string, nodeId: string, name: string): Promise<{ original: Repertoire; extracted: Repertoire }> => {
    const response = await api.post(`/repertoires/${id}/extract`, { nodeId, name });
    return response.data;
  },

  mergeRepertoires: async (ids: string[], name: string): Promise<{ merged: Repertoire }> => {
    const response = await api.post('/repertoires/merge', { ids, name });
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

  mergeTranspositions: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/merge-transpositions`);
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
    return response.data;
  },

  listTemplates: async (): Promise<ExploreTemplate[]> => {
    const response = await api.get('/explore/templates');
    return response.data;
  },

  importTemplate: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/explore/templates/${id}/import`);
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
    ownerName?: string
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
    const response = await api.post('/studies/import', body, { timeout: 120000 });
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

  delete: async (analysisId: string, gameIndex: number): Promise<void> => {
    await api.delete(`/games/${analysisId}/${gameIndex}`);
  },

  bulkDelete: async (games: { analysisId: string; gameIndex: number }[]): Promise<{ deleted: number }> => {
    const response = await api.post('/games/bulk-delete', { games });
    return response.data;
  },

  repertoires: async (options?: RequestOptions): Promise<RepertoireFilterOption[]> => {
    const response = await api.get('/games/repertoires', { signal: options?.signal });
    return response.data.repertoires;
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
  }
};

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
