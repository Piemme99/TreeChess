/**
 * Pre-built repertoire trees with real FENs for training tests.
 *
 * All FENs are validated chess positions produced by chess.js.
 * Trees are designed to exercise training edge cases:
 *   - User moves vs opponent moves
 *   - Branching (multiple children)
 *   - Short and long lines
 */
import type { RepertoireNode, ShortColor } from '../../types';
import { STARTING_FEN } from '../../shared/utils/chess';

// ---- FEN constants (verified with chess.js) ----

/** After 1. e4 */
export const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
/** After 1. e4 e5 */
export const FEN_AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
/** After 1. e4 e5 2. Nf3 */
export const FEN_AFTER_E4_E5_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
/** After 1. e4 e5 2. Nf3 Nc6 */
export const FEN_AFTER_E4_E5_NF3_NC6 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
/** After 1. e4 c5 (Sicilian) */
export const FEN_AFTER_E4_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
/** After 1. d4 */
export const FEN_AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';
/** After 1. d4 d5 */
export const FEN_AFTER_D4_D5 = 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';

// ---- Node builder helper ----

let fixtureIdCounter = 0;

function node(
  id: string,
  move: string | null,
  fen: string,
  colorToMove: ShortColor,
  children: RepertoireNode[] = [],
  extra: Partial<RepertoireNode> = {},
): RepertoireNode {
  fixtureIdCounter++;
  const n: RepertoireNode = {
    id,
    fen,
    move,
    moveNumber: Math.ceil(fixtureIdCounter / 2),
    colorToMove,
    parentId: null,
    children,
    ...extra,
  };
  // Wire parentId on children
  for (const child of children) {
    child.parentId = id;
  }
  return n;
}

/**
 * Reset fixture counter (call in beforeEach).
 */
export function resetFixtureIds(): void {
  fixtureIdCounter = 0;
}

// ---- Fixtures: White repertoire (user plays white) ----

/**
 * Simple 3-move Italian Game line (white repertoire):
 *
 *   root (starting pos, w to move)
 *     └─ e4 (b to move)
 *         └─ e5 (w to move)
 *             └─ Nf3 (b to move)
 *                 └─ Nc6 (w to move) ← leaf
 *
 * Training as white: user plays e4, Nf3.
 * Opponent auto-plays: e5, Nc6.
 */
export function createItalianTreeWhite(): RepertoireNode {
  fixtureIdCounter = 0;
  return node('root', null, STARTING_FEN, 'w', [
    node('n-e4', 'e4', FEN_AFTER_E4, 'b', [
      node('n-e5', 'e5', FEN_AFTER_E4_E5, 'w', [
        node('n-nf3', 'Nf3', FEN_AFTER_E4_E5_NF3, 'b', [
          node('n-nc6', 'Nc6', FEN_AFTER_E4_E5_NF3_NC6, 'w'),
        ]),
      ]),
    ]),
  ]);
}

/**
 * Branching white repertoire:
 *
 *   root
 *     ├─ e4 (b to move)
 *     │   ├─ e5 (w to move)
 *     │   │   └─ Nf3 (b to move) ← leaf
 *     │   └─ c5 (w to move) ← leaf (Sicilian)
 *     └─ d4 (b to move) ← alternative first move
 *         └─ d5 (w to move) ← leaf
 *
 * 3 lines total: [e4,e5,Nf3], [e4,c5], [d4,d5]
 */
export function createBranchingTreeWhite(): RepertoireNode {
  fixtureIdCounter = 0;
  return node('root', null, STARTING_FEN, 'w', [
    node('n-e4', 'e4', FEN_AFTER_E4, 'b', [
      node('n-e5', 'e5', FEN_AFTER_E4_E5, 'w', [
        node('n-nf3', 'Nf3', FEN_AFTER_E4_E5_NF3, 'b'),
      ]),
      node('n-c5', 'c5', FEN_AFTER_E4_C5, 'w'),
    ]),
    node('n-d4', 'd4', FEN_AFTER_D4, 'b', [
      node('n-d5', 'd5', FEN_AFTER_D4_D5, 'w'),
    ]),
  ]);
}

/**
 * Simple black repertoire — user plays black:
 *
 *   root (starting pos, w to move)
 *     └─ e4 (b to move)
 *         └─ e5 (w to move)
 *             └─ Nf3 (b to move)
 *                 └─ Nc6 (w to move) ← leaf
 *
 * Training as black: opponent plays e4, Nf3.
 * User plays: e5, Nc6.
 */
export function createItalianTreeBlack(): RepertoireNode {
  fixtureIdCounter = 0;
  return node('root', null, STARTING_FEN, 'w', [
    node('n-e4', 'e4', FEN_AFTER_E4, 'b', [
      node('n-e5', 'e5', FEN_AFTER_E4_E5, 'w', [
        node('n-nf3', 'Nf3', FEN_AFTER_E4_E5_NF3, 'b', [
          node('n-nc6', 'Nc6', FEN_AFTER_E4_E5_NF3_NC6, 'w'),
        ]),
      ]),
    ]),
  ]);
}

/**
 * Minimal tree — root node only (no moves, empty repertoire).
 */
export function createEmptyTree(): RepertoireNode {
  fixtureIdCounter = 0;
  return node('root', null, STARTING_FEN, 'w');
}
