import { create } from 'zustand';
import { authApi, syncApi, setAccessToken, getAccessToken } from '../services/api';
import { useRepertoireStore } from './repertoireStore';
import type { User, UpdateProfileRequest, SyncResult } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  needsOnboarding: boolean;
  syncing: boolean;
  lastSyncResult: SyncResult | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  handleOAuthToken: (token: string, isNew?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  clearOnboarding: () => void;
  triggerSync: () => Promise<void>;
  deleteAccount: (password?: string, username?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  needsOnboarding: false,
  syncing: false,
  lastSyncResult: null,

  login: async (email: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.login(email, password);
      // Store access token in memory only (never localStorage)
      setAccessToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        error: null,
      });
      // Fire-and-forget sync if user has platform usernames configured
      if (response.user.lichessUsername || response.user.chesscomUsername) {
        useAuthStore.getState().triggerSync();
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Login failed');
      set({ error: message });
      throw new Error(message);
    }
  },

  register: async (email: string, username: string, password: string) => {
    set({ error: null });
    try {
      const response = await authApi.register(email, username, password);
      // Store access token in memory only (never localStorage)
      setAccessToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        needsOnboarding: true,
        error: null,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Registration failed');
      set({ error: message });
      throw new Error(message);
    }
  },

  handleOAuthToken: async (token: string, isNew = false) => {
    // OAuth callback provides the access token via URL parameter
    // The refresh token was already set as an httpOnly cookie by the backend
    setAccessToken(token);
    set({ error: null });
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        needsOnboarding: isNew,
        loading: false,
      });
      // Fire-and-forget sync for returning OAuth users with platform usernames
      if (!isNew && (user.lichessUsername || user.chesscomUsername)) {
        useAuthStore.getState().triggerSync();
      }
    } catch {
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: 'Failed to verify OAuth token',
      });
      throw new Error('Failed to verify OAuth token');
    }
  },

  logout: async () => {
    // Call backend to revoke the refresh token and clear the httpOnly cookie
    await authApi.logout();
    setAccessToken(null);
    // Clear cached data from other stores to prevent data leaking between accounts
    useRepertoireStore.getState().clearAll();
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  checkAuth: async () => {
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
        if (user.lichessUsername || user.chesscomUsername) {
          useAuthStore.getState().triggerSync();
        }
        return;
      } catch {
        // Access token expired or invalid — try refreshing below
      }
    }

    // Try to get a new access token using the refresh token cookie
    try {
      const response = await authApi.refresh();
      setAccessToken(response.token);
      set({
        user: response.user,
        isAuthenticated: true,
        loading: false,
      });
      if (response.user.lichessUsername || response.user.chesscomUsername) {
        useAuthStore.getState().triggerSync();
      }
    } catch {
      // No valid refresh token — user is not authenticated
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data: UpdateProfileRequest) => {
    const user = await authApi.updateProfile(data);
    set({ user });
  },

  clearOnboarding: () => set({ needsOnboarding: false }),

  deleteAccount: async (password?: string, username?: string) => {
    await authApi.deleteAccount(password, username);
    // Clean up exactly like logout
    setAccessToken(null);
    useRepertoireStore.getState().clearAll();
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  triggerSync: async () => {
    if (useAuthStore.getState().syncing) {
      return;
    }
    set({ syncing: true, lastSyncResult: null });
    try {
      const result = await syncApi.sync();
      set({ syncing: false, lastSyncResult: result });
    } catch {
      set({ syncing: false });
    }
  },
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
