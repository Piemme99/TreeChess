import axios from 'axios';
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
  Category,
  CategoryWithRepertoires,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '../types';

const TOKEN_STORAGE_KEY = 'treechess_token';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Options for API requests that support cancellation */
export interface RequestOptions {
  signal?: AbortSignal;
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - inject auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code !== 'ERR_CANCELED') {
      if (error.response?.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      console.error('API Error:', error.response?.data || error.message);
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

  mergeTranspositions: async (id: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/merge-transpositions`);
    return response.data;
  },

  toggleNodeCollapsed: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.post(`/repertoires/${id}/nodes/${nodeId}/toggle-collapsed`);
    return response.data;
  },

  assignCategory: async (id: string, categoryId: string | null): Promise<Repertoire> => {
    const response = await api.patch(`/repertoires/${id}/category`, { categoryId });
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

  import: async (
    studyUrl: string,
    chapters: number[],
    mergeAsOne?: boolean,
    mergeName?: string,
    createCategory?: boolean,
    categoryName?: string
  ): Promise<StudyImportResponse> => {
    const body: Record<string, unknown> = { studyUrl, chapters };
    if (mergeAsOne) {
      body.mergeAsOne = true;
      if (mergeName) body.mergeName = mergeName;
    } else if (createCategory) {
      body.createCategory = true;
      if (categoryName) body.categoryName = categoryName;
    }
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

  repertoires: async (options?: RequestOptions): Promise<string[]> => {
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
  }
};
