import { z } from 'zod';


// Runtime validation for the highest-value network boundaries.
//
// TypeScript only checks shapes at compile time; the backend response is
// `any` at the wire, so backend drift (a renamed/removed field) would
// otherwise surface as a runtime `undefined` deep inside a component rather
// than at the fetch boundary. These zod schemas validate the payloads we lean
// on most (auth, per-import analysis detail, dashboard stats) right where they
// enter the app, turning silent corruption into a clear, attributable error.
//
// Schemas are intentionally NON-strict (zod's default): unknown extra fields
// pass through untouched, so additive backend changes never break the client —
// only missing or wrong-typed *known* fields are rejected.

// --- Auth boundary (login / register / refresh) ---

const timeFormatSchema = z.enum(['bullet', 'blitz', 'rapid']);

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().optional(),
  oauthProvider: z.string().optional(),
  lichessUsername: z.string().optional(),
  chesscomUsername: z.string().optional(),
  lichessLinked: z.boolean(),
  lastLichessSyncAt: z.string().optional(),
  lastChesscomSyncAt: z.string().optional(),
  timeFormatPrefs: z.array(timeFormatSchema).optional(),
  createdAt: z.string(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

/**
 * Validate a network payload against `schema`, attributing failures to a named
 * boundary. On a shape mismatch this throws a clear `Error` (rather than letting
 * a malformed shape propagate and explode as `undefined` deep in a component).
 */
export function validateResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  boundary: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    throw new Error(
      `Unexpected ${boundary} response shape at "${path}": ${issue?.message ?? 'validation failed'}`,
    );
  }
  return result.data;
}
