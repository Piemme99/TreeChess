// Shared extraction of the human-readable message from an axios-style error.
// The backend returns errors as `{ "error": "message" }` with an HTTP status,
// which axios exposes as `err.response.data.error`. Many call sites duplicated
// the same structural cast; this helper centralises it behind a type guard so
// callers don't sprinkle `as { response?... }` casts everywhere.

interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

function asApiError(err: unknown): ApiErrorResponse | null {
  if (err && typeof err === 'object' && 'response' in err) {
    return err as ApiErrorResponse;
  }
  return null;
}

/**
 * Return the backend-provided error message for an axios-style error, falling
 * back to `fallback` when the error has no `response.data.error` field.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  return asApiError(err)?.response?.data?.error ?? fallback;
}

/**
 * Return the HTTP status of an axios-style error, or undefined when the error
 * carries no response (network failure, timeout, …).
 */
export function getApiErrorStatus(err: unknown): number | undefined {
  return asApiError(err)?.response?.status;
}
