import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { Repertoire, RepertoireNode } from '../../../types';
import { colorToShort } from '../../../types';
import {
  generateTrainingLines,
  selectRandomLines,
  buildNodeMap,
  generateContinuationFromNode,
  findChildBySan,
  type TrainingLine,
  type TrainingMove,
} from '../utils/treeTraversal';
import { Chess } from 'chess.js';
import { STARTING_FEN, ensureFullFEN } from '../../../shared/utils/chess';

// --- Types ---

export type Phase =
  | 'idle'
  | 'playing'
  | 'wrong_move'
  | 'retry_move'
  | 'opponent_moving'
  | 'line_complete'
  | 'session_complete';

interface LastMove {
  from: string;
  to: string;
}

interface CorrectMoveArrow {
  from: string;
  to: string;
}

export interface TrainingState {
  phase: Phase;
  lines: TrainingLine[];
  currentLineIndex: number;
  currentMoveIndex: number;
  completedLineIndices: number[];
  fen: string;
  lastMove: LastMove | null;
  totalMistakes: number;
  lineMistakes: number;
  correctMoveSan: string | null;
  correctMoveArrow: CorrectMoveArrow | null;
  orientation: 'white' | 'black';
  userColor: 'w' | 'b';
  feedbackMessage: string | null;
  // Node map for looking up alternative moves in the full repertoire tree
  nodeMap: Map<string, RepertoireNode>;
  treeRoot: RepertoireNode | null;
  // Incremented on wrong_move to force ChessBoard remount (resets internal Chess state)
  boardKey: number;
}

export type Action =
  | { type: 'START_SESSION'; lines: TrainingLine[]; orientation: 'white' | 'black'; userColor: 'w' | 'b'; nodeMap: Map<string, RepertoireNode>; treeRoot: RepertoireNode }
  | { type: 'USER_MOVE'; san: string; from: string; to: string }
  | { type: 'OPPONENT_MOVE_DONE' }
  | { type: 'SHOW_RETRY' }
  | { type: 'NEXT_LINE' }
  | { type: 'RESET' };

export const initialState: TrainingState = {
  phase: 'idle',
  lines: [],
  currentLineIndex: 0,
  currentMoveIndex: 0,
  completedLineIndices: [],
  fen: STARTING_FEN,
  lastMove: null,
  totalMistakes: 0,
  lineMistakes: 0,
  correctMoveSan: null,
  correctMoveArrow: null,
  orientation: 'white',
  userColor: 'w',
  feedbackMessage: null,
  nodeMap: new Map(),
  treeRoot: null,
  boardKey: 0,
};

// --- Helpers ---

/**
 * Compute the correct-move arrow for display on wrong move.
 */
export function computeCorrectMoveArrow(fen: string, san: string): CorrectMoveArrow | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    if (move) {
      return { from: move.from, to: move.to };
    }
  } catch {
    // fallback — no arrow
  }
  return null;
}

/**
 * Parse a move to extract from/to squares for lastMove highlight.
 */
export function parseLastMove(fen: string, san: string): LastMove | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    if (move) {
      return { from: move.from, to: move.to };
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Find the parent node for the current expected move.
 * The parent is the node whose FEN matches the expected move's FEN (position before the move).
 * We look up by finding the node whose child has nodeId === expectedMove.nodeId.
 */
export function findCurrentParentNode(
  expectedMove: TrainingMove,
  nodeMap: Map<string, RepertoireNode>,
): RepertoireNode | null {
  // The expectedMove.nodeId is the ID of the child node (after the move).
  // We need to find the parent node. We can find it by looking up the child
  // and checking its parentId.
  const childNode = nodeMap.get(expectedMove.nodeId);
  if (childNode?.parentId) {
    return nodeMap.get(childNode.parentId) ?? null;
  }
  return null;
}

/**
 * Check if a SAN move is a valid alternative in the repertoire at the current position.
 * Returns the child node if found, null otherwise.
 */
export function findAlternativeInRepertoire(
  expectedMove: TrainingMove,
  san: string,
  nodeMap: Map<string, RepertoireNode>,
): RepertoireNode | null {
  const parentNode = findCurrentParentNode(expectedMove, nodeMap);
  if (!parentNode) return null;

  return findChildBySan(parentNode, san);
}

// --- Reducer ---

export function reducer(state: TrainingState, action: Action): TrainingState {
  switch (action.type) {
    case 'START_SESSION': {
      if (action.lines.length === 0) {
        return {
          ...initialState,
          phase: 'session_complete',
          lines: [],
          orientation: action.orientation,
          userColor: action.userColor,
          nodeMap: action.nodeMap,
          treeRoot: action.treeRoot,
          feedbackMessage: 'This repertoire has no lines to train.',
        };
      }
      const firstLine = action.lines[0];
      const firstMove = firstLine[0];
      // If first move is opponent's, we need to auto-play it
      if (!firstMove.isUserMove) {
        return {
          ...initialState,
          phase: 'opponent_moving',
          lines: action.lines,
          fen: ensureFullFEN(action.treeRoot.fen),
          orientation: action.orientation,
          userColor: action.userColor,
          nodeMap: action.nodeMap,
          treeRoot: action.treeRoot,
          feedbackMessage: null,
        };
      }
      return {
        ...initialState,
        phase: 'playing',
        lines: action.lines,
        fen: ensureFullFEN(action.treeRoot.fen),
        orientation: action.orientation,
        userColor: action.userColor,
        nodeMap: action.nodeMap,
        treeRoot: action.treeRoot,
        feedbackMessage: null,
      };
    }

    case 'USER_MOVE': {
      const line = state.lines[state.currentLineIndex];
      const expectedMove = line[state.currentMoveIndex];
      const lastMove: LastMove = { from: action.from, to: action.to };

      // --- Helper: advance after a correct move ---
      const advanceAfterCorrectMove = (
        resultFen: string,
        targetLineIndex: number,
        targetLine: TrainingLine,
        extraState: Partial<TrainingState>,
      ): TrainingState => {
        const nextIndex = state.currentMoveIndex + 1;

        if (nextIndex >= targetLine.length) {
          return {
            ...state,
            ...extraState,
            phase: 'line_complete',
            currentLineIndex: targetLineIndex,
            currentMoveIndex: nextIndex,
            fen: resultFen,
            lastMove,
            correctMoveSan: null,
            correctMoveArrow: null,
            feedbackMessage: 'Line complete!',
          };
        }

        const nextMove = targetLine[nextIndex];
        if (!nextMove.isUserMove) {
          return {
            ...state,
            ...extraState,
            phase: 'opponent_moving',
            currentLineIndex: targetLineIndex,
            currentMoveIndex: nextIndex,
            fen: resultFen,
            lastMove,
            correctMoveSan: null,
            correctMoveArrow: null,
            feedbackMessage: null,
          };
        }

        return {
          ...state,
          ...extraState,
          phase: 'playing',
          currentLineIndex: targetLineIndex,
          currentMoveIndex: nextIndex,
          fen: resultFen,
          lastMove,
          correctMoveSan: null,
          correctMoveArrow: null,
          feedbackMessage: null,
        };
      };

      // --- Phase: retry_move ---
      // In retry mode, the user must play the correct move (or any alternative from the repertoire)
      if (state.phase === 'retry_move') {
        // Accept the expected move
        if (action.san === expectedMove.san) {
          return advanceAfterCorrectMove(expectedMove.resultFen, state.currentLineIndex, line, {});
        }

        // Accept alternative move from the repertoire at this position
        const altChild = findAlternativeInRepertoire(expectedMove, action.san, state.nodeMap);
        if (altChild) {
          // Generate new continuation from this alternative child node
          const continuation = generateContinuationFromNode(altChild, state.userColor);
          const newLine = [...line.slice(0, state.currentMoveIndex + 1)];

          // Replace the current move with the alternative
          newLine[state.currentMoveIndex] = {
            nodeId: altChild.id,
            fen: expectedMove.fen,
            san: altChild.move!,
            resultFen: altChild.fen,
            isUserMove: expectedMove.isUserMove,
          };

          // Append the continuation
          newLine.push(...continuation);

          // Update the lines array
          const newLines = [...state.lines];
          newLines[state.currentLineIndex] = newLine;

          return advanceAfterCorrectMove(altChild.fen, state.currentLineIndex, newLine, {
            lines: newLines,
          });
        }

        // Still wrong — show the correct move arrow again
        return {
          ...state,
          phase: 'wrong_move',
          correctMoveSan: expectedMove.san,
          correctMoveArrow: computeCorrectMoveArrow(expectedMove.fen, expectedMove.san),
          feedbackMessage: `Wrong! The correct move was ${expectedMove.san}`,
          boardKey: state.boardKey + 1,
        };
      }

      // --- Phase: playing (normal) ---

      // 1. Fast path: matches expected move on current line
      if (action.san === expectedMove.san) {
        return advanceAfterCorrectMove(expectedMove.resultFen, state.currentLineIndex, line, {});
      }

      // 2. Check line-switching: move exists in another selected line at this position
      const altLineIndex = state.lines.findIndex((l, i) =>
        i !== state.currentLineIndex &&
        !state.completedLineIndices.includes(i) &&
        state.currentMoveIndex < l.length &&
        l[state.currentMoveIndex].fen === expectedMove.fen &&
        l[state.currentMoveIndex].san === action.san &&
        l[state.currentMoveIndex].isUserMove
      );

      if (altLineIndex !== -1) {
        const altLine = state.lines[altLineIndex];
        const altMove = altLine[state.currentMoveIndex];
        return advanceAfterCorrectMove(altMove.resultFen, altLineIndex, altLine, {
          completedLineIndices: [...state.completedLineIndices, state.currentLineIndex],
        });
      }

      // 3. Check if the move is an alternative in the full repertoire tree
      const altChild = findAlternativeInRepertoire(expectedMove, action.san, state.nodeMap);
      if (altChild) {
        // Generate new continuation from this alternative child node
        const continuation = generateContinuationFromNode(altChild, state.userColor);
        const newLine = [...line.slice(0, state.currentMoveIndex + 1)];

        // Replace the current move with the alternative
        newLine[state.currentMoveIndex] = {
          nodeId: altChild.id,
          fen: expectedMove.fen,
          san: altChild.move!,
          resultFen: altChild.fen,
          isUserMove: expectedMove.isUserMove,
        };

        // Append the continuation
        newLine.push(...continuation);

        // Update the lines array
        const newLines = [...state.lines];
        newLines[state.currentLineIndex] = newLine;

        return advanceAfterCorrectMove(altChild.fen, state.currentLineIndex, newLine, {
          lines: newLines,
        });
      }

      // 4. Wrong move — show the correct move arrow
      return {
        ...state,
        phase: 'wrong_move',
        totalMistakes: state.totalMistakes + 1,
        lineMistakes: state.lineMistakes + 1,
        correctMoveSan: expectedMove.san,
        correctMoveArrow: computeCorrectMoveArrow(expectedMove.fen, expectedMove.san),
        feedbackMessage: `Wrong! The correct move was ${expectedMove.san}`,
        boardKey: state.boardKey + 1,
      };
    }

    case 'OPPONENT_MOVE_DONE': {
      const line = state.lines[state.currentLineIndex];
      const opponentMove = line[state.currentMoveIndex];

      const lastMove = parseLastMove(opponentMove.fen, opponentMove.san);
      const nextIndex = state.currentMoveIndex + 1;

      if (nextIndex >= line.length) {
        return {
          ...state,
          phase: 'line_complete',
          currentMoveIndex: nextIndex,
          fen: opponentMove.resultFen,
          lastMove,
          feedbackMessage: 'Line complete!',
        };
      }

      return {
        ...state,
        phase: 'playing',
        currentMoveIndex: nextIndex,
        fen: opponentMove.resultFen,
        lastMove,
        feedbackMessage: null,
      };
    }

    case 'SHOW_RETRY': {
      // Transition from wrong_move to retry_move: hide the arrow, let user replay.
      // Increment boardKey to force a ChessBoard remount so that react-chessboard's
      // internal useDrag hook re-evaluates canDrag with interactive=true. Without this,
      // pieces remain undraggable because the drag hook's stale closure still returns false.
      return {
        ...state,
        phase: 'retry_move',
        correctMoveArrow: null,
        feedbackMessage: 'Play the correct move',
        boardKey: state.boardKey + 1,
      };
    }

    case 'NEXT_LINE': {
      const newCompleted = [...state.completedLineIndices, state.currentLineIndex];

      // Find smallest uncompleted line index
      const nextLineIndex = state.lines.findIndex((_, i) => !newCompleted.includes(i));

      if (nextLineIndex === -1) {
        return {
          ...state,
          phase: 'session_complete',
          completedLineIndices: newCompleted,
          feedbackMessage: null,
        };
      }

      const nextLine = state.lines[nextLineIndex];
      const firstMove = nextLine[0];

      if (!firstMove.isUserMove) {
        return {
          ...state,
          phase: 'opponent_moving',
          currentLineIndex: nextLineIndex,
          currentMoveIndex: 0,
          fen: state.treeRoot ? ensureFullFEN(state.treeRoot.fen) : STARTING_FEN,
          lastMove: null,
          lineMistakes: 0,
          correctMoveSan: null,
          correctMoveArrow: null,
          completedLineIndices: newCompleted,
          feedbackMessage: null,
        };
      }

      return {
        ...state,
        phase: 'playing',
        currentLineIndex: nextLineIndex,
        currentMoveIndex: 0,
        fen: state.treeRoot ? ensureFullFEN(state.treeRoot.fen) : STARTING_FEN,
        lastMove: null,
        lineMistakes: 0,
        correctMoveSan: null,
        correctMoveArrow: null,
        completedLineIndices: newCompleted,
        feedbackMessage: null,
      };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// --- Hook ---

export function useTrainingSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timersRef = useRef<number[]>([]);
  const lastSessionRef = useRef<{ repertoire: Repertoire; lineCount: number } | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const addTimer = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, delay);
    timersRef.current.push(id);
  }, []);

  const startSession = useCallback((repertoire: Repertoire, lineCount: number) => {
    lastSessionRef.current = { repertoire, lineCount };
    const userColor = colorToShort(repertoire.color);
    const allLines = generateTrainingLines(repertoire.treeData, userColor);
    const lines = selectRandomLines(allLines, lineCount);
    const orientation = repertoire.color;
    const nodeMap = buildNodeMap(repertoire.treeData);
    dispatch({
      type: 'START_SESSION',
      lines,
      orientation,
      userColor,
      nodeMap,
      treeRoot: repertoire.treeData,
    });
  }, []);

  const handleUserMove = useCallback((san: string, from: string, to: string) => {
    dispatch({ type: 'USER_MOVE', san, from, to });
  }, []);

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    dispatch({ type: 'RESET' });
  }, []);

  const restartSession = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (lastSessionRef.current) {
      const { repertoire, lineCount } = lastSessionRef.current;
      const userColor = colorToShort(repertoire.color);
      const allLines = generateTrainingLines(repertoire.treeData, userColor);
      const lines = selectRandomLines(allLines, lineCount);
      const orientation = repertoire.color;
      const nodeMap = buildNodeMap(repertoire.treeData);
      dispatch({
        type: 'START_SESSION',
        lines,
        orientation,
        userColor,
        nodeMap,
        treeRoot: repertoire.treeData,
      });
    } else {
      dispatch({ type: 'RESET' });
    }
  }, []);

  // Auto-play opponent moves, handle wrong_move → retry_move, and line_complete transitions
  useEffect(() => {
    if (state.phase === 'opponent_moving') {
      addTimer(() => {
        dispatch({ type: 'OPPONENT_MOVE_DONE' });
      }, 500);
    }

    if (state.phase === 'wrong_move') {
      addTimer(() => {
        dispatch({ type: 'SHOW_RETRY' });
      }, 1500);
    }

    if (state.phase === 'line_complete') {
      addTimer(() => {
        dispatch({ type: 'NEXT_LINE' });
      }, 2200);
    }
  }, [state.phase, state.currentLineIndex, state.currentMoveIndex, addTimer]);

  return {
    phase: state.phase,
    fen: state.fen,
    lastMove: state.lastMove,
    orientation: state.orientation,
    feedbackMessage: state.feedbackMessage,
    correctMoveSan: state.correctMoveSan,
    correctMoveArrow: state.correctMoveArrow,
    totalMistakes: state.totalMistakes,
    completedLines: state.completedLineIndices.length,
    totalLines: state.lines.length,
    isInteractive: state.phase === 'playing' || state.phase === 'retry_move',
    boardKey: state.boardKey,
    startSession,
    handleUserMove,
    reset,
    restartSession,
  };
}
