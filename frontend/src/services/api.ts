import axios from 'axios';
import type {
  Repertoire,
  AddNodeRequest,
  Color,
  AnalysisSummary,
  AnalysisDetail,
  UploadResponse,
  GamesResponse,
  LichessImportOptions,
  CreateRepertoireRequest,
  UpdateRepertoireRequest
} from '../types';

const USERNAME_STORAGE_KEY = 'treechess_username';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Repertoire API
export const repertoireApi = {
  // List all repertoires, optionally filtered by color
  list: async (color?: Color): Promise<Repertoire[]> => {
    const params = color ? { color } : {};
    const response = await api.get('/repertoires', { params });
    return response.data;
  },

  // Get a single repertoire by ID
  get: async (id: string): Promise<Repertoire> => {
    const response = await api.get(`/repertoire/${id}`);
    return response.data;
  },

  // Create a new repertoire
  create: async (data: CreateRepertoireRequest): Promise<Repertoire> => {
    const response = await api.post('/repertoires', data);
    return response.data;
  },

  // Rename a repertoire
  rename: async (id: string, name: string): Promise<Repertoire> => {
    const data: UpdateRepertoireRequest = { name };
    const response = await api.patch(`/repertoire/${id}`, data);
    return response.data;
  },

  // Delete a repertoire
  delete: async (id: string): Promise<void> => {
    await api.delete(`/repertoire/${id}`);
  },

  // Add a node to a repertoire
  addNode: async (id: string, data: AddNodeRequest): Promise<Repertoire> => {
    const response = await api.post(`/repertoire/${id}/node`, data);
    return response.data;
  },

  // Delete a node from a repertoire
  deleteNode: async (id: string, nodeId: string): Promise<Repertoire> => {
    const response = await api.delete(`/repertoire/${id}/node/${nodeId}`);
    return response.data;
  }
};

// Username storage helpers
export const usernameStorage = {
  get: (): string => localStorage.getItem(USERNAME_STORAGE_KEY) || '',
  set: (username: string): void => localStorage.setItem(USERNAME_STORAGE_KEY, username),
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

  list: async (): Promise<AnalysisSummary[]> => {
    const response = await api.get('/analyses');
    return response.data;
  },

  get: async (id: string): Promise<AnalysisDetail> => {
    const response = await api.get(`/analyses/${id}`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/analyses/${id}`);
  }
};

// Health API
export const healthApi = {
  check: async (): Promise<{ status: string }> => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Games API
export const gamesApi = {
  list: async (limit = 20, offset = 0): Promise<GamesResponse> => {
    const response = await api.get('/games', {
      params: { limit, offset }
    });
    return response.data;
  },

  delete: async (analysisId: string, gameIndex: number): Promise<void> => {
    await api.delete(`/games/${analysisId}/${gameIndex}`);
  }
};
