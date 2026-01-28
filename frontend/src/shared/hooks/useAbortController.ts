import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook to manage AbortController for async operations.
 * Automatically aborts pending requests when component unmounts
 * or when a new request is made.
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const getSignal = useCallback(() => {
    // Abort any pending request
    abortControllerRef.current?.abort();
    // Create a new controller for this request
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { getSignal, abort };
}

/**
 * Helper to check if an error is an abort error
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
