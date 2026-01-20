import axios from 'axios';
import { Repertoire, PgnImport, RepertoireNode } from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const repertoireApi = {
  get: async (color: 'w' | 'b'): Promise<Repertoire> => {
    const response = await api.get(`/repertoire/${color}`);
    return response.data;
  },

  addNode: async (color: 'w' | 'b', parentId: string, fen: string, san: string): Promise<RepertoireNode> => {
    const response = await api.post(`/repertoire/${color}/node`, {
      parentId,
      fen,
      san
    });
    return response.data;
  },

  deleteNode: async (color: 'w' | 'b', nodeId: string): Promise<void> => {
    await api.delete(`/repertoire/${color}/node/${nodeId}`);
  }
};

export const importApi = {
  upload: async (pgn: string): Promise<PgnImport> => {
    const response = await api.post('/imports', { pgn });
    return response.data;
  },

  list: async (): Promise<PgnImport[]> => {
    const response = await api.get('/analyses');
    return response.data;
  },

  get: async (id: string): Promise<PgnImport> => {
    const response = await api.get(`/analyses/${id}`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/analyses/${id}`);
  }
};

export const healthApi = {
  check: async (): Promise<{ status: string }> => {
    const response = await api.get('/health');
    return response.data;
  }
};
