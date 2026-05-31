import type { ErrorInfo } from 'react';

/**
 * Centralised error reporting for React error boundaries.
 *
 * There is no telemetry/Sentry infrastructure yet, so this currently logs to
 * `console.error` with the component stack. The single seam below is where a
 * Sentry/telemetry hook can be dropped in later without touching the
 * boundaries themselves.
 */

/** Generates a short, human-quotable reference id for a captured error. */
export function generateErrorReference(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Reports an error captured by an error boundary. The `reference` is surfaced
 * in the fallback UI so users can quote it when reporting a problem.
 */
export function reportBoundaryError(
  error: Error,
  errorInfo: ErrorInfo,
  reference: string
): void {
  // TODO: forward to a telemetry/Sentry hook once one exists.
  console.error(
    `[ErrorBoundary] (ref ${reference})`,
    error,
    errorInfo.componentStack
  );
}

/**
 * Detects failures to load a dynamically imported (code-split) chunk. These
 * happen when a hashed chunk referenced by a stale page no longer exists after
 * a redeploy. Such errors are recoverable with a hard reload.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'ChunkLoadError') {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed')
  );
}
