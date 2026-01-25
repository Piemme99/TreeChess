import axios from 'axios';
import type {
  Repertoire,
  AddNodeRequest,
  Color,
  AnalysisSummary,
  AnalysisDetail,
  UploadResponse,
  GamesResponse,
  LichessImportOptions
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
  get: async (color: Color): Promise<Repertoire> => {
    const response = await api.get(`/repertoire/${color}`);
    return response.data;
  },

  addNode: async (color: Color, data: AddNodeRequest): Promise<Repertoire> => {
    const response = await api.post(`/repertoire/${color}/node`, data);
    return response.data;
  },

  deleteNode: async (color: Color, nodeId: string): Promise<Repertoire> => {
    const response = await api.delete(`/repertoire/${color}/node/${nodeId}`);
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
