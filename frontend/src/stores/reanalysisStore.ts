import { create } from 'zustand';
import { gamesApi, type ReanalysisStatus } from '../services/api';

const ACTIVE_POLL_MS = 1000;
const STARTUP_POLL_MS = 500;
const MAX_IDLE_POLLS = 6;

interface ReanalysisState {
  status: ReanalysisStatus;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
}

// Polling lives in module scope so multiple subscribers share one timer and
// repeated startPolling calls coalesce instead of fanning out timers.
let pollTimer: number | null = null;
let idleStreak = 0;

function clearTimer() {
  if (pollTimer !== null) {
    window.clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function tick(set: (partial: Partial<ReanalysisState>) => void) {
  let status: ReanalysisStatus | null = null;
  try {
    status = await gamesApi.reanalysisStatus();
  } catch {
    // Network/auth error: stop polling silently — a future mutation will retry.
    set({ isPolling: false });
    clearTimer();
    return;
  }

  set({ status });

  if (status.inProgress || status.pending) {
    idleStreak = 0;
    pollTimer = window.setTimeout(() => tick(set), ACTIVE_POLL_MS);
    return;
  }

  // Status idle. Poll a few more times in case the debounce window hasn't
  // fired yet on the server (mutation just happened, no run scheduled yet).
  idleStreak += 1;
  if (idleStreak >= MAX_IDLE_POLLS) {
    set({ isPolling: false });
    clearTimer();
    return;
  }
  pollTimer = window.setTimeout(() => tick(set), ACTIVE_POLL_MS);
}

export const useReanalysisStore = create<ReanalysisState>((set) => ({
  status: { inProgress: false, pending: false },
  isPolling: false,

  startPolling: () => {
    idleStreak = 0;
    set({ isPolling: true });
    clearTimer();
    pollTimer = window.setTimeout(() => tick(set), STARTUP_POLL_MS);
  },

  stopPolling: () => {
    clearTimer();
    idleStreak = 0;
    set({ isPolling: false, status: { inProgress: false, pending: false } });
  },
}));

// Module-level helper so the API layer can fire-and-forget after a mutation
// without importing React state machinery.
export function triggerReanalysisPolling() {
  useReanalysisStore.getState().startPolling();
}
