import { z } from 'zod';

import type {
  AuthResponse,
  AnalysisDetail,
  DashboardStatsResponse,
} from '../types';

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

const colorSchema = z.enum(['white', 'black']);

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

// --- Analysis detail boundary (per-import game analysis) ---

const pgnHeadersSchema = z.object({
  Event: z.string().optional(),
  Site: z.string().optional(),
  Date: z.string().optional(),
  Round: z.string().optional(),
  White: z.string().optional(),
  Black: z.string().optional(),
  Result: z.string().optional(),
  ECO: z.string().optional(),
  Opening: z.string().optional(),
  ECOUrl: z.string().optional(),
});

const moveStatusSchema = z.enum([
  'in-repertoire',
  'out-of-repertoire',
  'opponent-new',
  'out-of-book',
]);

const moveAnalysisSchema = z.object({
  plyNumber: z.number(),
  san: z.string(),
  fen: z.string(),
  status: moveStatusSchema,
  expectedMove: z.string().optional(),
  isUserMove: z.boolean(),
});

const repertoireRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const gameAnalysisSchema = z.object({
  gameIndex: z.number(),
  headers: pgnHeadersSchema,
  moves: z.array(moveAnalysisSchema),
  userColor: colorSchema,
  matchedRepertoire: repertoireRefSchema.nullable().optional(),
  matchScore: z.number().optional(),
});

export const analysisDetailSchema = z.object({
  id: z.string(),
  username: z.string(),
  filename: z.string(),
  gameCount: z.number(),
  uploadedAt: z.string(),
  results: z.array(gameAnalysisSchema),
});

// --- Dashboard stats boundary ---

const repertoireStatsSchema = z.object({
  repertoireId: z.string(),
  repertoireName: z.string(),
  color: colorSchema,
  gameCount: z.number(),
  coveragePercent: z.number(),
  winRate: z.number(),
  winRateInRep: z.number(),
  winRateOutRep: z.number(),
  inRepCount: z.number(),
  outRepCount: z.number(),
});

const opponentGapSchema = z.object({
  fen: z.string(),
  opponentMove: z.string(),
  frequency: z.number(),
  winRate: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  repertoireId: z.string(),
  repertoireName: z.string(),
  color: colorSchema,
  moveNumber: z.number(),
  contextMove: z.string(),
});

const branchStatsSchema = z.object({
  branchName: z.string(),
  repertoireId: z.string(),
  repertoireName: z.string(),
  color: colorSchema,
  gameCount: z.number(),
  winRate: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  errorRate: z.number(),
  errorCount: z.number(),
});

export const dashboardStatsResponseSchema = z.object({
  totalGames: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  overallWinRate: z.number(),
  overallCoverage: z.number(),
  winRateInRep: z.number(),
  winRateOutRep: z.number(),
  inRepCount: z.number(),
  outRepCount: z.number(),
  repertoires: z.array(repertoireStatsSchema),
  openingErrorRate: z.number(),
  openingErrorCount: z.number(),
  matchedGamesCount: z.number(),
  opponentGaps: z.array(opponentGapSchema),
  branchStats: z.array(branchStatsSchema),
});

// Compile-time guards: keep each schema's inferred output structurally aligned
// with the hand-written interface it mirrors. `Exact<A, B>` is `true` only when
// A and B are mutually assignable, otherwise `never`. Passing the literal value
// `true` for each pair forces `tsc` to check it: if a `types/index.ts` field
// changes without a matching schema edit, the pair becomes `never`, `true` is
// no longer assignable to it, and the build fails — so the schemas can never
// silently drift from the types the rest of the app relies on.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
function assertExact<A, B>(_check: Exact<A, B>): void {
  void _check;
}

assertExact<z.infer<typeof authResponseSchema>, AuthResponse>(true);
assertExact<z.infer<typeof analysisDetailSchema>, AnalysisDetail>(true);
assertExact<
  z.infer<typeof dashboardStatsResponseSchema>,
  DashboardStatsResponse
>(true);

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
