import { Chess, type Move } from 'chess.js';

import type { RepertoireNode } from '../../types';

/** Standard starting position FEN */
export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Follows the main line of a repertoire tree and returns the FEN at the given depth.
 * - Prefers children marked with `isMainLine`
 * - Falls back to the first child if none is marked
 * - Stops at `maxDepth` half-moves or when there are no more children
 */
export function getMainlineFEN(treeData: RepertoireNode, maxDepth = 6): string {
  let current = treeData;
  let depth = 0;

  while (current.children.length > 0 && depth < maxDepth) {
    const mainChild = current.children.find((c) => c.isMainLine);
    current = mainChild ?? current.children[0];
    depth++;
  }

  return ensureFullFEN(current.fen);
}

export function createInitialPosition(): Chess {
  return new Chess();
}

export function createPositionFromFEN(fen: string): Chess | null {
  try {
    const chess = new Chess(fen);
    return chess;
  } catch {
    return null;
  }
}

/** Ensures a FEN has all 6 parts (appends "0 1" if only 4 parts). */
export function ensureFullFEN(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length >= 6) return fen;
  if (parts.length >= 4) return fen + ' 0 1';
  return fen;
}

export function getShortFEN(fullFEN: string): string {
  const parts = fullFEN.split(' ');
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
  }
  return fullFEN;
}

export function isValidMove(fen: string, san: string): boolean {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    return move !== null;
  } catch {
    return false;
  }
}

export function getMoveSAN(fen: string, from: string, to: string, promotion?: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from,
      to,
      promotion: promotion || 'q'
    });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

export function getLegalMoves(fen: string): { from: string; to: string; san: string }[] {
  try {
    const chess = new Chess(fen);
    const moves: { from: string; to: string; san: string }[] = [];
    chess.moves({ verbose: true }).forEach((move: Move) => {
      if (move.from && move.to && move.san) {
        moves.push({ from: move.from, to: move.to, san: move.san });
      }
    });
    return moves;
  } catch {
    return [];
  }
}

export function makeMove(fen: string, san: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    if (move) {
      return chess.fen();
    }
    return null;
  } catch {
    return null;
  }
}

export function getTurn(fen: string): 'w' | 'b' {
  if (!fen || typeof fen !== 'string') {
    return 'w'; // Default to white for invalid input
  }
  const parts = fen.split(' ');
  if (parts.length < 2 || (parts[1] !== 'w' && parts[1] !== 'b')) {
    return 'w'; // Default to white for malformed FEN
  }
  return parts[1];
}

export function getFullMoveNumber(fen: string): number {
  if (!fen || typeof fen !== 'string') {
    return 1; // Default to move 1 for invalid input
  }
  const parts = fen.split(' ');
  if (parts.length >= 6) {
    const moveNumber = parseInt(parts[5], 10);
    return isNaN(moveNumber) ? 1 : moveNumber;
  }
  return 1;
}

/**
 * Computes the full-move number for a child move played from a parent node,
 * matching the backend's canonical convention (`deriveMoveNumber` in
 * repertoire_service.go and the PGN parser / template numbering):
 *
 *   - the root node has moveNumber 0
 *   - a white move (parent's side to move is White) starts a new full move:
 *     parent.moveNumber + 1  (e.g. e4 -> 1, Nf3 -> 2)
 *   - a black move (parent's side to move is Black) completes the current full
 *     move: parent.moveNumber  (e.g. e5 -> 1, Nc6 -> 2)
 *
 * `parentColorToMove` is the side to move *at the parent* (the side that plays
 * the child move); this is the `colorToMove` stored on the parent node.
 *
 * Note: AddNode now server-derives MoveNumber and ignores the client value, but
 * grafted subtrees saved via SaveTree are persisted verbatim, and the value is
 * also used for optimistic display, so the frontend must agree with the backend.
 */
export function deriveChildMoveNumber(
  parentMoveNumber: number,
  parentColorToMove: 'w' | 'b'
): number {
  return parentColorToMove === 'w' ? parentMoveNumber + 1 : parentMoveNumber;
}

/**
 * Formats a repertoire node's move in standard algebraic notation with its move
 * number, e.g. "1. e4" or "1... c5". Matches the dot/ellipsis convention used by
 * MoveHistory: `colorToMove` is the side to move *after* this node's move, so a
 * white move leaves Black to move (`colorToMove === 'b'`) and gets a single dot,
 * while a black move (`colorToMove === 'w'`) gets an ellipsis.
 */
export function formatNodeNotation(
  moveNumber: number,
  colorToMove: 'w' | 'b',
  move: string
): string {
  const separator = colorToMove === 'b' ? '.' : '...';
  return `${moveNumber}${separator} ${move}`;
}


