import { useEffect, useRef } from 'react';
import { useReanalysisStore } from '../../stores/reanalysisStore';

/**
 * Calls `onComplete` once each time the re-analysis queue transitions from
 * active (inProgress or pending) back to idle. Use it on pages whose data
 * depends on re-analysed games (Games list, Dashboard stats) to refetch when
 * the background run finishes.
 */
export function useReanalysisCompletion(onComplete: () => void) {
  const wasActiveRef = useRef(false);
  const status = useReanalysisStore((s) => s.status);
  const isPolling = useReanalysisStore((s) => s.isPolling);

  useEffect(() => {
    const active = isPolling && (status.inProgress || status.pending);
    if (active) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      onComplete();
    }
  }, [isPolling, status.inProgress, status.pending, onComplete]);
}
