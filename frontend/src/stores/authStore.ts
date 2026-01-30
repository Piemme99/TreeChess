import { create } from 'zustand';
import { authApi } from '../services/api';
import type { User } from '../types';

const TOKEN_STORAGE_KEY = 'treechess_token';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  handleOAuthToken: (token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  isAuthenticated: false,
  loading: true,
  error: null,

  login: async (username: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.login(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        error: null,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Login failed');
      set({ error: message });
      throw new Error(message);
    }
  },

  register: async (username: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.register(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        error: null,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Registration failed');
      set({ error: message });
      throw new Error(message);
    }
  },

  handleOAuthToken: async (token: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    set({ token, error: null });
    try {
      const user = await authApi.me();
      set({
        user,
        token,
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: 'Failed to verify OAuth token',
      });
      throw new Error('Failed to verify OAuth token');
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      set({ loading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await authApi.me();
      set({
        user,
        token,
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    if (axiosErr.response?.data?.error) {
      return axiosErr.response.data.error;
    }
  }
  return fallback;
}
