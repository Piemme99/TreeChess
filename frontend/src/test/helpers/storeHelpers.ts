/**
 * Helpers for testing Zustand stores.
 */
import { useAuthStore } from '../../stores/authStore';
import { useRepertoireStore } from '../../stores/repertoireStore';

/**
 * Reset the auth store to its default state.
 * Call in `beforeEach` to ensure test isolation.
 */
export function resetAuthStore(): void {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
    needsOnboarding: false,
    syncing: false,
    lastSyncResult: null,
  });
}

/**
 * Reset the repertoire store to its default state.
 * Call in `beforeEach` to ensure test isolation.
 */
export function resetRepertoireStore(): void {
  useRepertoireStore.setState({
    repertoires: [],
    categories: [],
    expandedCategories: new Set<string>(),
    selectedRepertoireId: null,
    selectedNodeId: null,
    loading: false,
    error: null,
  });
}

/**
 * Reset all stores at once.
 */
export function resetAllStores(): void {
  resetAuthStore();
  resetRepertoireStore();
}
