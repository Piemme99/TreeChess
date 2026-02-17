/**
 * Unified move classification system using Win% (winning chances).
 *
 * Uses Stockfish 18 NNUE for evaluations (via WebAssembly in the browser).
 * Win% is derived from the Lichess empirical sigmoid formula (75k positions,
 * 2300+ Elo rapid games, June 2022), combined with Chess.com-style 6-category
 * classification thresholds.
 *
 * Why Win% instead of raw centipawns:
 * - Losing 100cp in an equal position is devastating (~17% Win drop)
 * - Losing 300cp when already +800cp is insignificant (~2.4% Win drop)
 * - The sigmoid compresses extremes and expands the critical middle range,
 *   matching human intuition about position quality.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Lichess empirical constant for Win% sigmoid, trained on 75k positions. */
const LICHESS_CP_CONSTANT = 0.00368208;

/** Centipawns are clamped to this range before conversion. */
const CP_CLAMP = 1000;

// Classification thresholds on Win% drop (0–100 scale).
//
// Aligned with Lichess thresholds (0.10/0.20/0.30 on [-1,+1] winning chances
// = 5%/10%/15% on [0,100] Win%). With Stockfish 18 NNUE the evaluations are
// stable enough that these thresholds work reliably even at depth 12.
const THRESHOLD_EXCELLENT = 2;   // < 2% Win loss
const THRESHOLD_GOOD = 5;        // 2–5% Win loss
const THRESHOLD_INACCURACY = 8;  // 5–8% Win loss
const THRESHOLD_MISTAKE = 15;    // 8–15% Win loss
// > 15% = Blunder

/**
 * Minimum centipawn loss required to classify a move as Inaccuracy or worse.
 * This prevents minor depth-limited evaluation noise from causing false
 * classifications on normal moves.
 *
 * With Stockfish 18 NNUE, depth-12 fluctuations are typically ~10-20cp
 * (much smaller than the ~30-60cp of the old pre-NNUE engine), so a
 * threshold of 25cp is sufficient to filter out noise while catching
 * real inaccuracies.
 */
const MIN_CP_LOSS_FOR_NEGATIVE = 25;

// ─── Types ───────────────────────────────────────────────────────────────────

export type MoveCategory = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveClassification {
  /** The classification category for this move. */
  category: MoveCategory;
  /** Win% from the user's perspective BEFORE the move was played. */
  winPercentBefore: number;
  /** Win% from the user's perspective AFTER the move was played. */
  winPercentAfter: number;
  /** How much Win% was lost (always >= 0). */
  winPercentDrop: number;
}

export interface MoveQualityDisplay {
  /** CSS class for the quality dot (Tailwind bg-*). */
  dotColor: string;
  /** CSS class for the SAN text color (Tailwind text-*). */
  sanColor: string;
  /** Short loss display string (e.g. "-5.2%") or null for good moves. */
  lossDisplay: string | null;
  /** Hover tooltip text. */
  title: string;
  /** The classification category. */
  category: MoveCategory;
  /** Symbol for the category (e.g. "!!", "!", "?!", "?", "??"). */
  symbol: string;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Convert a centipawn score to Win% (0–100 scale) using the Lichess
 * empirical sigmoid formula.
 *
 * At 0cp: 50%, +100cp: ~67%, +200cp: ~81%, +500cp: ~97%, +1000cp: ~99.7%
 */
export function cpToWinPercent(cp: number): number {
  const clamped = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, cp));
  // Lichess winning chances on [-1, +1] scale
  const wc = 2 / (1 + Math.exp(-LICHESS_CP_CONSTANT * clamped)) - 1;
  // Convert to [0, 100] scale
  return 50 + 50 * wc;
}

/**
 * Convert a mate-in-N score to an equivalent centipawn value.
 * Uses a graduated scale: closer mates = higher cp (capped at CP_CLAMP).
 */
export function mateToCp(mate: number): number {
  const sign = mate > 0 ? 1 : -1;
  const distance = Math.min(10, Math.abs(mate));
  return sign * (21 - distance) * 100;
}

/**
 * Convert a Stockfish evaluation (cp or mate) to Win% (0–100 scale).
 * Scores should be from the user's perspective (positive = good for user).
 */
export function evalToWinPercent(
  score: number | null | undefined,
  mate: number | null | undefined,
): number {
  if (mate !== null && mate !== undefined) {
    return cpToWinPercent(mateToCp(mate));
  }
  if (score !== null && score !== undefined) {
    return cpToWinPercent(score);
  }
  return 50; // No data — assume equal
}

/**
 * Normalize a Stockfish evaluation to a specific player's perspective.
 * Stockfish reports scores from the side-to-move's perspective.
 *
 * @param score Centipawn score from Stockfish (side-to-move perspective)
 * @param mate Mate-in-N from Stockfish (side-to-move perspective)
 * @param sideToMove 'w' or 'b' — who is to move in the position
 * @param userColor 'w' or 'b' — the user's color
 * @returns Object with score/mate from the user's perspective
 */
export function normalizeEvalForUser(
  score: number | null | undefined,
  mate: number | null | undefined,
  sideToMove: 'w' | 'b',
  userColor: 'w' | 'b',
): { score: number | null; mate: number | null } {
  const flip = sideToMove !== userColor;
  return {
    score: score != null ? (flip ? -score : score) : null,
    mate: mate != null ? (flip ? -mate : mate) : null,
  };
}

/**
 * Normalize a Stockfish evaluation to white's perspective.
 * Used for eval bars and consistent score display.
 */
export function normalizeEvalForWhite(
  score: number | null | undefined,
  mate: number | null | undefined,
  sideToMove: 'w' | 'b',
): { score: number | null; mate: number | null } {
  return normalizeEvalForUser(score, mate, sideToMove, 'w');
}

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Classify a move based on the Win% drop it caused.
 *
 * @param winPercentBefore Win% from the user's perspective BEFORE the move
 * @param winPercentAfter Win% from the user's perspective AFTER the move
 * @param options.isBestMove Whether this move matches the engine's best move
 * @param options.cpLoss Raw centipawn loss (used for noise floor filtering)
 * @returns A MoveClassification object
 */
export function classifyMove(
  winPercentBefore: number,
  winPercentAfter: number,
  options?: { isBestMove?: boolean; cpLoss?: number },
): MoveClassification {
  const { isBestMove, cpLoss } = options ?? {};

  // Win% drop is how much the user lost by playing this move.
  // If the position improved (opponent blundered, or user found a good move),
  // the drop is 0.
  const winPercentDrop = Math.max(0, winPercentBefore - winPercentAfter);

  // Noise floor: if the raw centipawn loss is below the minimum threshold,
  // cap the classification at "good" regardless of Win% drop. This prevents
  // depth-12 search instability from flagging normal opening moves.
  const belowNoiseFloor = cpLoss !== undefined && cpLoss < MIN_CP_LOSS_FOR_NEGATIVE;

  let category: MoveCategory;
  if (isBestMove || winPercentDrop === 0) {
    category = 'best';
  } else if (winPercentDrop < THRESHOLD_EXCELLENT) {
    category = 'excellent';
  } else if (winPercentDrop < THRESHOLD_GOOD || belowNoiseFloor) {
    category = 'good';
  } else if (winPercentDrop < THRESHOLD_INACCURACY) {
    category = 'inaccuracy';
  } else if (winPercentDrop < THRESHOLD_MISTAKE) {
    category = 'mistake';
  } else {
    category = 'blunder';
  }

  return { category, winPercentBefore, winPercentAfter, winPercentDrop };
}

/**
 * Classify a move from raw Stockfish position evaluations.
 *
 * Both evals should be from WHITE's perspective (the standard normalization).
 * The function handles the perspective conversion internally based on userColor.
 *
 * @param scoreBefore Eval before the move (cp, white's perspective)
 * @param mateBefore Mate-in-N before the move (white's perspective)
 * @param scoreAfter Eval after the move (cp, white's perspective)
 * @param mateAfter Mate-in-N after the move (white's perspective)
 * @param userColor The user's color
 * @param isBestMove Whether this move matches the engine's best move
 */
export function classifyMoveFromEvals(
  scoreBefore: number | null,
  mateBefore: number | null,
  scoreAfter: number | null,
  mateAfter: number | null,
  userColor: 'w' | 'b',
  isBestMove?: boolean,
): MoveClassification {
  // Convert to Win% from the user's perspective
  const wpBefore = userColor === 'w'
    ? evalToWinPercent(scoreBefore, mateBefore)
    : 100 - evalToWinPercent(scoreBefore, mateBefore);
  const wpAfter = userColor === 'w'
    ? evalToWinPercent(scoreAfter, mateAfter)
    : 100 - evalToWinPercent(scoreAfter, mateAfter);

  // Compute raw cpLoss for noise floor filtering.
  // Handle mate scores as large cp values.
  const cpBefore = mateBefore !== null && mateBefore !== undefined
    ? mateToCp(mateBefore) : (scoreBefore ?? 0);
  const cpAfter = mateAfter !== null && mateAfter !== undefined
    ? mateToCp(mateAfter) : (scoreAfter ?? 0);
  const rawCpLoss = userColor === 'w'
    ? cpBefore - cpAfter
    : cpAfter - cpBefore;
  const cpLoss = Math.max(0, rawCpLoss);

  return classifyMove(wpBefore, wpAfter, { isBestMove, cpLoss });
}

// ─── Display Helpers ─────────────────────────────────────────────────────────

/** Get display properties for a move classification category. */
export function getMoveQualityDisplay(classification: MoveClassification): MoveQualityDisplay {
  const { category, winPercentDrop, winPercentAfter } = classification;

  switch (category) {
    case 'best':
      return {
        dotColor: 'bg-cyan-500',
        sanColor: 'text-cyan-600',
        lossDisplay: null,
        title: `Best move (${winPercentAfter.toFixed(0)}% Win)`,
        category,
        symbol: '!!',
      };
    case 'excellent':
      return {
        dotColor: 'bg-success',
        sanColor: 'text-success',
        lossDisplay: null,
        title: `Excellent move (${winPercentAfter.toFixed(0)}% Win)`,
        category,
        symbol: '!',
      };
    case 'good':
      return {
        dotColor: 'bg-success/60',
        sanColor: 'text-success',
        lossDisplay: null,
        title: `Good move (${winPercentAfter.toFixed(0)}% Win, -${winPercentDrop.toFixed(1)}%)`,
        category,
        symbol: '',
      };
    case 'inaccuracy':
      return {
        dotColor: 'bg-warning',
        sanColor: 'text-warning',
        lossDisplay: `-${winPercentDrop.toFixed(1)}%`,
        title: `Inaccuracy: lost ${winPercentDrop.toFixed(1)}% winning chances (${winPercentAfter.toFixed(0)}% Win)`,
        category,
        symbol: '?!',
      };
    case 'mistake':
      return {
        dotColor: 'bg-orange-500',
        sanColor: 'text-orange-500',
        lossDisplay: `-${winPercentDrop.toFixed(1)}%`,
        title: `Mistake: lost ${winPercentDrop.toFixed(1)}% winning chances (${winPercentAfter.toFixed(0)}% Win)`,
        category,
        symbol: '?',
      };
    case 'blunder':
      return {
        dotColor: 'bg-danger',
        sanColor: 'text-danger',
        lossDisplay: `-${winPercentDrop.toFixed(1)}%`,
        title: `Blunder: lost ${winPercentDrop.toFixed(1)}% winning chances (${winPercentAfter.toFixed(0)}% Win)`,
        category,
        symbol: '??',
      };
  }
}

/**
 * Format a centipawn score as a readable string like "+0.3" or "-1.2".
 */
export function formatCpScore(cp: number | null | undefined): string {
  if (cp === null || cp === undefined) return '0.0';
  if (cp === 0) return '0.0';
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/**
 * Format an evaluation (cp or mate) as a human-readable string.
 */
export function formatEval(
  score: number | null | undefined,
  mate: number | null | undefined,
): string {
  if (mate !== null && mate !== undefined) {
    return `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`;
  }
  return formatCpScore(score);
}

/**
 * Format Win% as a display string.
 */
export function formatWinPercent(winPercent: number): string {
  return `${winPercent.toFixed(0)}%`;
}
