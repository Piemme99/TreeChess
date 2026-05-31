import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ErrorInfo } from 'react';
import {
  generateErrorReference,
  isChunkLoadError,
  reportBoundaryError,
} from './errorReporting';

describe('generateErrorReference', () => {
  it('returns a short uppercase alphanumeric reference', () => {
    const ref = generateErrorReference();
    expect(ref).toMatch(/^[A-Z0-9]+$/);
    expect(ref.length).toBeGreaterThan(0);
  });
});

describe('isChunkLoadError', () => {
  it('detects ChunkLoadError by name', () => {
    const err = new Error('boom');
    err.name = 'ChunkLoadError';
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('detects Vite dynamic-import failure messages', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/x.js'))
    ).toBe(true);
    expect(
      isChunkLoadError(new Error('error loading dynamically imported module'))
    ).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isChunkLoadError('a string')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reportBoundaryError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the error, component stack and reference', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('kaboom');
    const errorInfo = { componentStack: '\n  at Broken\n  at App' } as ErrorInfo;

    reportBoundaryError(error, errorInfo, 'ABC123');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('ABC123'),
      error,
      errorInfo.componentStack
    );
  });
});
