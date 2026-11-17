import { describe, it, expect } from 'vitest';
import { authResponseSchema, validateResponse } from './apiSchemas';
import type { AuthResponse } from '../types';

const validAuth: AuthResponse = {
  token: 'jwt-token',
  user: {
    id: 'u1',
    username: 'alice',
    lichessLinked: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
};

describe('validateResponse / schemas (direct)', () => {
  it('returns the parsed value for a valid auth payload', () => {
    expect(validateResponse(authResponseSchema, validAuth, 'auth')).toEqual(
      validAuth,
    );
  });

  it('passes through unknown extra fields (non-strict)', () => {
    const withExtra = { ...validAuth, somethingNew: true };
    const parsed = validateResponse(authResponseSchema, withExtra, 'auth');
    expect(parsed.token).toBe('jwt-token');
  });

  it('throws with the boundary name and field path on a missing field', () => {
    const broken = { user: validAuth.user }; // token missing
    expect(() => validateResponse(authResponseSchema, broken, 'auth')).toThrow(
      /auth response shape at "token"/,
    );
  });

  it('rejects a wrong-typed field', () => {
    const broken = { ...validAuth, token: 42 };
    expect(() => validateResponse(authResponseSchema, broken, 'auth')).toThrow(
      /auth/,
    );
  });
});
