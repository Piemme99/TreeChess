import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { Repertoire } from '../../../types';
import { colorToShort } from '../../../types';
import { generateTrainingLines, type TrainingLine } from '../utils/treeTraversal';
import { Chess } from 'chess.js';
import { STARTING_FEN } from '../../../shared/utils/chess';

// --- Types ---

type Phase =
  | 'idle'
  | 'playing'
  | 'wrong_move'
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

interface TrainingState {
  phase: Phase;
  lines: TrainingLine[];
  currentLineIndex: number;
  currentMoveIndex: number;
  fen: string;
  lastMove: LastMove | null;
  totalMistakes: number;
  lineMistakes: number;
  correctMoveSan: string | null;
  correctMoveArrow: CorrectMoveArrow | null;
  orientation: 'white' | 'black';
  userColor: 'w' | 'b';
  feedbackMessage: string | null;
}

type Action =
  | { type: 'START_SESSION'; lines: TrainingLine[]; orientation: 'white' | 'black'; userColor: 'w' | 'b' }
  | { type: 'USER_MOVE'; san: string; from: string; to: string }
  | { type: 'OPPONENT_MOVE_DONE' }
  | { type: 'LINE_RESTART' }
  | { type: 'NEXT_LINE' }
  | { type: 'RESET' };

const initialState: TrainingState = {
  phase: 'idle',
  lines: [],
  currentLineIndex: 0,
  currentMoveIndex: 0,
  fen: STARTING_FEN,
  lastMove: null,
  totalMistakes: 0,
  lineMistakes: 0,
  correctMoveSan: null,
  correctMoveArrow: null,
  orientation: 'white',
  userColor: 'w',
  feedbackMessage: null,
};

// --- Reducer ---

function reducer(state: TrainingState, action: Action): TrainingState {
  switch (action.type) {
    case 'START_SESSION': {
      if (action.lines.length === 0) {
        return {
          ...initialState,
          phase: 'session_complete',
          lines: [],
          orientation: action.orientation,
          userColor: action.userColor,
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
          fen: STARTING_FEN,
          orientation: action.orientation,
          userColor: action.userColor,
          feedbackMessage: null,
        };
      }
      return {
        ...initialState,
        phase: 'playing',
        lines: action.lines,
        fen: STARTING_FEN,
        orientation: action.orientation,
        userColor: action.userColor,
        feedbackMessage: null,
      };
    }

    case 'USER_MOVE': {
      const line = state.lines[state.currentLineIndex];
      const expectedMove = line[state.currentMoveIndex];

      if (action.san === expectedMove.san) {
        // Correct move
        const nextIndex = state.currentMoveIndex + 1;
        const lastMove: LastMove = { from: action.from, to: action.to };

        if (nextIndex >= line.length) {
          // Line complete
          return {
            ...state,
            phase: 'line_complete',
            currentMoveIndex: nextIndex,
            fen: expectedMove.resultFen,
            lastMove,
            feedbackMessage: 'Line complete!',
          };
        }

        const nextMove = line[nextIndex];
        if (!nextMove.isUserMove) {
          // Next is opponent move — transition to opponent_moving
          return {
            ...state,
            phase: 'opponent_moving',
            currentMoveIndex: nextIndex,
            fen: expectedMove.resultFen,
            lastMove,
            feedbackMessage: null,
          };
        }

        // Next is user move again
        return {
          ...state,
          phase: 'playing',
          currentMoveIndex: nextIndex,
          fen: expectedMove.resultFen,
          lastMove,
          feedbackMessage: null,
        };
      }

      // Wrong move — compute arrow for the correct move
      let correctMoveArrow: CorrectMoveArrow | null = null;
      try {
        const chess = new Chess(expectedMove.fen);
        const correctMove = chess.move(expectedMove.san);
        if (correctMove) {
          correctMoveArrow = { from: correctMove.from, to: correctMove.to };
        }
      } catch {
        // fallback — no arrow
      }

      return {
        ...state,
        phase: 'wrong_move',
        totalMistakes: state.totalMistakes + 1,
        lineMistakes: state.lineMistakes + 1,
        correctMoveSan: expectedMove.san,
        correctMoveArrow,
        feedbackMessage: `Wrong! The correct move was ${expectedMove.san}`,
      };
    }

    case 'OPPONENT_MOVE_DONE': {
      const line = state.lines[state.currentLineIndex];
      const opponentMove = line[state.currentMoveIndex];

      // Parse the opponent move to get from/to squares
      let lastMove: LastMove | null = null;
      try {
        const chess = new Chess(opponentMove.fen);
        const move = chess.move(opponentMove.san);
        if (move) {
          lastMove = { from: move.from, to: move.to };
        }
      } catch {
        // fallback — no lastMove highlight
      }

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

    case 'LINE_RESTART': {
      const line = state.lines[state.currentLineIndex];
      const firstMove = line[0];

      if (!firstMove.isUserMove) {
        return {
          ...state,
          phase: 'opponent_moving',
          currentMoveIndex: 0,
          fen: STARTING_FEN,
          lastMove: null,
          lineMistakes: 0,
          correctMoveSan: null,
          correctMoveArrow: null,
          feedbackMessage: null,
        };
      }

      return {
        ...state,
        phase: 'playing',
        currentMoveIndex: 0,
        fen: STARTING_FEN,
        lastMove: null,
        lineMistakes: 0,
        correctMoveSan: null,
        correctMoveArrow: null,
        feedbackMessage: null,
      };
    }

    case 'NEXT_LINE': {
      const nextLineIndex = state.currentLineIndex + 1;
      if (nextLineIndex >= state.lines.length) {
        return {
          ...state,
          phase: 'session_complete',
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
          fen: STARTING_FEN,
          lastMove: null,
          lineMistakes: 0,
          correctMoveSan: null,
          correctMoveArrow: null,
          feedbackMessage: null,
        };
      }

      return {
        ...state,
        phase: 'playing',
        currentLineIndex: nextLineIndex,
        currentMoveIndex: 0,
        fen: STARTING_FEN,
        lastMove: null,
        lineMistakes: 0,
        correctMoveSan: null,
        correctMoveArrow: null,
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

  const startSession = useCallback((repertoire: Repertoire) => {
    const userColor = colorToShort(repertoire.color);
    const lines = generateTrainingLines(repertoire.treeData, userColor);
    const orientation = repertoire.color;
    dispatch({ type: 'START_SESSION', lines, orientation, userColor });
  }, []);

  const handleUserMove = useCallback((san: string, from: string, to: string) => {
    dispatch({ type: 'USER_MOVE', san, from, to });
  }, []);

  const retryLine = useCallback(() => {
    dispatch({ type: 'LINE_RESTART' });
  }, []);

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    dispatch({ type: 'RESET' });
  }, []);

  // Auto-play opponent moves and handle transitions
  useEffect(() => {
    if (state.phase === 'opponent_moving') {
      addTimer(() => {
        dispatch({ type: 'OPPONENT_MOVE_DONE' });
      }, 500);
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
    currentLineIndex: state.currentLineIndex,
    totalLines: state.lines.length,
    isInteractive: state.phase === 'playing',
    startSession,
    handleUserMove,
    retryLine,
    reset,
  };
}
