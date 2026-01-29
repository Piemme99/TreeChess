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
 * Helper to check if an error is an abort error.
 * Handles both native DOMException and axios CanceledError (ERR_CANCELED).
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  // Axios wraps abort signals as AxiosError with code ERR_CANCELED
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code: string }).code === 'ERR_CANCELED';
  }
  return false;
}
