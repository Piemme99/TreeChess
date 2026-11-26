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
 * Return the HTTP status of an axios-style error, or undefined when the error
 * carries no response (network failure, timeout, …).
 */
export function getApiErrorStatus(err: unknown): number | undefined {
  return asApiError(err)?.response?.status;
}

/** The `error` message of an API error response, when the server sent one. */
export function getApiErrorMessage(err: unknown): string | undefined {
  return asApiError(err)?.response?.data?.error;
}
