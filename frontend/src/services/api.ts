import axios from 'axios';
import type {
  Repertoire,
  AddNodeRequest,
  Color,
  AnalysisSummary,
  AnalysisDetail,
  UploadResponse
} from '../types';

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

// Import/Analysis API
export const importApi = {
  upload: async (file: File, color: Color): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('color', color);

    const response = await api.post('/imports', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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
