import { repertoireApi } from '../services/api';
import { findNodeByFEN } from '../features/repertoire/edit/utils/nodeUtils';
import { makeMove, getShortFEN, deriveChildMoveNumber } from './utils/chess';
import type {
  AddNodeRequest,
  MoveStatus,
  Repertoire,
  RepertoireNode,
} from '../types';

/**
 * The single source of truth for the cross-route "add to repertoire" / "open in
 * repertoire" handoff. Both the analyse-session graft handlers and the editor's
 * pending-add consumer go through the typed helpers here, so a field rename is a
 * compile error rather than a silent runtime break.
 */

// --- sessionStorage contract ---------------------------------------------

/** sessionStorage key carrying a line to graft when the editor mounts. */
export const PENDING_ADD_NODE_KEY = 'pendingAddNode';
/** sessionStorage key carrying a position to navigate to when the editor mounts. */
export const PENDING_NAVIGATE_KEY = 'pendingNavigateToFen';

/**
 * A single move to graft, expressed as the parent position, the SAN played, and
 * the resulting position.
 */
export interface PendingMoveEntry {
  parentFEN: string;
  moveSAN: string;
  resultFEN: string;
}

/**
 * A line to graft onto a repertoire, handed off through sessionStorage. This is
 * the only on-the-wire format — single-move producers emit a one-element
 * `moves` array.
 */
export interface PendingAddSequence {
  repertoireId: string;
  repertoireName: string;
  gameInfo: string;
  moves: PendingMoveEntry[];
}

/** A request to navigate the editor to a position, handed off via sessionStorage. */
export interface PendingNavigate {
  repertoireId: string;
  fen: string;
}

function isPendingMoveEntry(value: unknown): value is PendingMoveEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.parentFEN === 'string' &&
    typeof entry.moveSAN === 'string' &&
    typeof entry.resultFEN === 'string'
  );
}

function isPendingAddSequence(value: unknown): value is PendingAddSequence {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.repertoireId === 'string' &&
    typeof data.repertoireName === 'string' &&
    typeof data.gameInfo === 'string' &&
    Array.isArray(data.moves) &&
    data.moves.every(isPendingMoveEntry)
  );
}

function isPendingNavigate(value: unknown): value is PendingNavigate {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return typeof data.repertoireId === 'string' && typeof data.fen === 'string';
}

/** Stash a line to graft; the editor consumes it on its next mount. */
export function stashPendingAddSequence(sequence: PendingAddSequence): void {
  sessionStorage.setItem(PENDING_ADD_NODE_KEY, JSON.stringify(sequence));
}

/** Stash a position for the editor to navigate to on its next mount. */
export function stashPendingNavigate(navigate: PendingNavigate): void {
  sessionStorage.setItem(PENDING_NAVIGATE_KEY, JSON.stringify(navigate));
}

/**
 * Read (and validate) a stashed add-sequence without removing it. Returns null
 * when absent or malformed.
 */
export function readPendingAddNode(): PendingAddSequence | null {
  const raw = sessionStorage.getItem(PENDING_ADD_NODE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPendingAddSequence(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read (and validate) a stashed navigate request without removing it. Returns
 * null when absent or malformed.
 */
export function readPendingNavigate(): PendingNavigate | null {
  const raw = sessionStorage.getItem(PENDING_NAVIGATE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPendingNavigate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remove a stashed add-sequence (call after consuming it). */
export function clearPendingAddNode(): void {
  sessionStorage.removeItem(PENDING_ADD_NODE_KEY);
}

/** Remove a stashed navigate request (call after consuming it). */
export function clearPendingNavigate(): void {
  sessionStorage.removeItem(PENDING_NAVIGATE_KEY);
}

// --- divergence -----------------------------------------------------------

/**
 * A divergence is a move where the played game leaves the prepared repertoire:
 * either the opponent played a move not covered (`opponent-new`) or the user
 * deviated from their own line (`out-of-repertoire`). `out-of-book` (past all
 * theory) is deliberately NOT a divergence — graft handlers treat it as a
 * separate "extend the repertoire" fallback.
 */
export function isDivergence(status: MoveStatus | undefined): boolean {
  return status === 'opponent-new' || status === 'out-of-repertoire';
}

/**
 * Index of the first divergence in a list of move statuses, or -1 if the line
 * never leaves the repertoire.
 */
export function findFirstDivergenceIndex(
  moves: { status: MoveStatus }[]
): number {
  return moves.findIndex((m) => isDivergence(m.status));
}

// --- line building --------------------------------------------------------

/**
 * Build the graftable line from `startIndex` through `endIndex` (inclusive),
 * resolving each move's surrounding positions with `fenAt(index)` (the FEN
 * after replaying moves up to and including that index; index -1 is the start).
 */
export function buildLineFromDivergence(
  moves: { san: string }[],
  startIndex: number,
  endIndex: number,
  fenAt: (index: number) => string
): PendingMoveEntry[] {
  const line: PendingMoveEntry[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    line.push({
      parentFEN: fenAt(i - 1),
      moveSAN: moves[i].san,
      resultFEN: fenAt(i),
    });
  }
  return line;
}

// --- AddNode request ------------------------------------------------------

/**
 * Build an AddNodeRequest for grafting `moveSAN` onto `parentNode`, collapsing
 * the move-number derivation and color flip that were previously copy-pasted at
 * every graft site. `childFEN` is the full FEN of the resulting position; it is
 * shortened here to the canonical stored form.
 */
export function buildAddNodeRequest(
  parentNode: RepertoireNode,
  moveSAN: string,
  childFEN: string
): AddNodeRequest {
  return {
    parentId: parentNode.id,
    move: moveSAN,
    fen: getShortFEN(childFEN),
    moveNumber: deriveChildMoveNumber(parentNode.moveNumber, parentNode.colorToMove),
    colorToMove: parentNode.colorToMove === 'w' ? 'b' : 'w',
  };
}

// --- grafting -------------------------------------------------------------

export interface GraftLineResult {
  /** SANs that were newly added to the repertoire, in order. */
  added: string[];
  /** SANs that already existed on the path and were left untouched. */
  skipped: string[];
  /** Set when the sequence could not be fully applied. `added` still lists what landed. */
  error?: string;
  /** The repertoire after grafting, so callers can refresh their cache/view. */
  repertoire?: Repertoire;
}

/**
 * Graft a line of moves onto an existing repertoire in place, without leaving
 * the current view. Fetches the repertoire's current tree, then walks the
 * sequence move-by-move: positions already present are skipped, new positions
 * are POSTed. Stops at the first position it cannot locate or a move it cannot
 * play, reporting what was added so far plus the latest repertoire snapshot.
 */
export async function graftLine(
  repertoireId: string,
  line: PendingMoveEntry[]
): Promise<GraftLineResult> {
  const added: string[] = [];
  const skipped: string[] = [];

  let repertoire: Repertoire;
  try {
    repertoire = await repertoireApi.get(repertoireId);
  } catch {
    return { added, skipped, error: 'Failed to load repertoire' };
  }

  let currentTree: RepertoireNode = repertoire.treeData;

  for (const entry of line) {
    const parentNode = findNodeByFEN(currentTree, entry.parentFEN);
    if (!parentNode) {
      return {
        added,
        skipped,
        error: `Could not find the position before ${entry.moveSAN} in the repertoire`,
        repertoire,
      };
    }

    const existingChild = parentNode.children.find((c) => c.move === entry.moveSAN);
    if (existingChild) {
      skipped.push(entry.moveSAN);
      continue;
    }

    const newFEN = makeMove(parentNode.fen, entry.moveSAN);
    if (!newFEN) {
      return { added, skipped, error: `Invalid move: ${entry.moveSAN}`, repertoire };
    }

    try {
      const request = buildAddNodeRequest(parentNode, entry.moveSAN, newFEN);
      repertoire = await repertoireApi.addNode(repertoireId, request);
      currentTree = repertoire.treeData;
      added.push(entry.moveSAN);
    } catch {
      return { added, skipped, error: `Failed to add ${entry.moveSAN}`, repertoire };
    }
  }

  return { added, skipped, repertoire };
}
