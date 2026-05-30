import { useReducer, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { STARTING_FEN } from '../../../shared/utils/chess';
import {
  fetchExplorerData,
  getWeightedRandomMove,
  getMovePopularity,
  getMoveWinRate,
  getBestMoveWinRate,
  calcWinRate,
  isOutOfBook,
} from '../services/lichessExplorer';

// --- Types ---

type Phase =
  | 'idle'
  | 'fetching_explorer'
  | 'user_turn'
  | 'opponent_moving'
  | 'session_complete';

interface LastMove {
  from: string;
  to: string;
}

export interface MoveRecord {
  san: string;
  isUser: boolean;
  popularity: number | null; // null = novelty
  winRate: number | null;    // user win rate after this move (from Lichess explorer)
  bestWinRate: number | null; // win rate of the best available move at this position
}

export interface ExplorerState {
  phase: Phase;
  fen: string;
  orientation: 'white' | 'black';
  userColor: 'w' | 'b';
  lastMove: LastMove | null;
  moveHistory: MoveRecord[];
  feedbackMessage: string | null;
  finalWinRate: number | null;
  finalVerdict: string | null;
  moveCount: number;
  errorMessage: string | null;
}

export interface UserMoveStats {
  popularity?: number | null;
  winRate?: number | null;
  bestWinRate?: number | null;
}

export type Action =
  | { type: 'START_SESSION'; userColor: 'w' | 'b' }
  | { type: 'SET_USER_TURN'; feedbackMessage?: string; stats?: UserMoveStats }
  | { type: 'OPPONENT_MOVE_DONE'; san: string; from: string; to: string; resultFen: string; popularity: number | null; winRate: number | null; bestWinRate: number | null }
  | { type: 'USER_MOVE'; san: string; from: string; to: string; resultFen: string }
  | { type: 'OUT_OF_BOOK'; winRate: number; verdict: string; feedbackMessage?: string; stats?: UserMoveStats }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

export const initialState: ExplorerState = {
  phase: 'idle',
  fen: STARTING_FEN,
  orientation: 'white',
  userColor: 'w',
  lastMove: null,
  moveHistory: [],
  feedbackMessage: null,
  finalWinRate: null,
  finalVerdict: null,
  moveCount: 0,
  errorMessage: null,
};

export function getVerdict(winRate: number): string {
  if (winRate >= 55) return 'Strong opening!';
  if (winRate >= 48) return 'Solid position';
  if (winRate >= 40) return 'Slightly passive';
  return 'Difficult position';
}

export function updateLastMoveStats(history: MoveRecord[], stats: UserMoveStats): MoveRecord[] {
  if (history.length === 0) return history;
  const updated = [...history];
  const last = updated[updated.length - 1];
  updated[updated.length - 1] = {
    ...last,
    ...(stats.popularity !== undefined && { popularity: stats.popularity }),
    ...(stats.winRate !== undefined && { winRate: stats.winRate }),
    ...(stats.bestWinRate !== undefined && { bestWinRate: stats.bestWinRate }),
  };
  return updated;
}

// --- Reducer ---

export function reducer(state: ExplorerState, action: Action): ExplorerState {
  switch (action.type) {
    case 'START_SESSION': {
      const orientation = action.userColor === 'w' ? 'white' : 'black';
      return {
        ...initialState,
        phase: 'fetching_explorer',
        orientation,
        userColor: action.userColor,
      };
    }

    case 'SET_USER_TURN': {
      const history = action.stats
        ? updateLastMoveStats(state.moveHistory, action.stats)
        : state.moveHistory;
      return {
        ...state,
        phase: 'user_turn',
        moveHistory: history,
        feedbackMessage: action.feedbackMessage ?? null,
      };
    }

    case 'OPPONENT_MOVE_DONE':
      return {
        ...state,
        phase: 'user_turn',
        fen: action.resultFen,
        lastMove: { from: action.from, to: action.to },
        moveHistory: [
          ...state.moveHistory,
          { san: action.san, isUser: false, popularity: action.popularity, winRate: action.winRate, bestWinRate: action.bestWinRate },
        ],
        moveCount: state.moveCount + 1,
        feedbackMessage: null,
      };

    case 'USER_MOVE':
      return {
        ...state,
        phase: 'fetching_explorer',
        fen: action.resultFen,
        lastMove: { from: action.from, to: action.to },
        moveHistory: [
          ...state.moveHistory,
          { san: action.san, isUser: true, popularity: null, winRate: null, bestWinRate: null },
        ],
        moveCount: state.moveCount + 1,
        feedbackMessage: null,
      };

    case 'OUT_OF_BOOK': {
      const history = action.stats
        ? updateLastMoveStats(state.moveHistory, action.stats)
        : state.moveHistory;
      return {
        ...state,
        phase: 'session_complete',
        finalWinRate: action.winRate,
        finalVerdict: action.verdict,
        moveHistory: history,
        feedbackMessage: action.feedbackMessage ?? null,
      };
    }

    case 'ERROR':
      return {
        ...state,
        phase: 'session_complete',
        errorMessage: action.message,
        finalWinRate: null,
        finalVerdict: null,
        feedbackMessage: null,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// --- Hook ---

export function useExplorerTraining() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timersRef = useRef<number[]>([]);

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

  // Track the SAN of the last user move and the pre-move FEN
  const lastUserMoveSanRef = useRef<string | null>(null);
  const preFenRef = useRef<string>(STARTING_FEN);

  const processExplorerPhase = useCallback(
    async (fen: string, userColor: 'w' | 'b', lastUserSan: string | null, preFen: string) => {
      try {
        // If we have a user move to evaluate, get its stats from the pre-move position
        let userStats: UserMoveStats | undefined;
        let feedbackMsg: string | undefined;
        if (lastUserSan) {
          const preMoveData = await fetchExplorerData(preFen);
          const pop = getMovePopularity(preMoveData, lastUserSan);
          const wr = getMoveWinRate(preMoveData, lastUserSan, userColor);
          const bestWr = getBestMoveWinRate(preMoveData, userColor);
          userStats = { popularity: pop, winRate: wr, bestWinRate: bestWr };
          feedbackMsg = pop === null
            ? 'Novelty!'
            : `Played in ${pop.toFixed(0)}% of games`;
        }

        // Fetch current position data
        const data = await fetchExplorerData(fen);

        // Check if out of book
        if (isOutOfBook(data)) {
          const winRate = calcWinRate(data, userColor);
          dispatch({
            type: 'OUT_OF_BOOK',
            winRate,
            verdict: getVerdict(winRate),
            feedbackMessage: feedbackMsg,
            stats: userStats,
          });
          return;
        }

        // Determine whose turn it is
        const chess = new Chess(fen);
        const sideToMove = chess.turn();

        if (sideToMove === userColor) {
          // User's turn - make board interactive
          dispatch({
            type: 'SET_USER_TURN',
            feedbackMessage: feedbackMsg,
            stats: userStats,
          });
        } else {
          // Opponent's turn - play most popular move
          const bestMove = getWeightedRandomMove(data);
          if (!bestMove) {
            const winRate = calcWinRate(data, userColor);
            dispatch({
              type: 'OUT_OF_BOOK',
              winRate,
              verdict: getVerdict(winRate),
              feedbackMessage: feedbackMsg,
              stats: userStats,
            });
            return;
          }

          // If we have user feedback, dispatch it first so it shows during opponent delay
          if (userStats) {
            dispatch({
              type: 'SET_USER_TURN',
              feedbackMessage: feedbackMsg,
              stats: userStats,
            });
          }

          const move = chess.move(bestMove.san);
          if (!move) {
            dispatch({ type: 'ERROR', message: 'Failed to play opponent move.' });
            return;
          }

          const popularity = getMovePopularity(data, bestMove.san);
          const opponentWr = getMoveWinRate(data, bestMove.san, userColor);
          const opponentBestWr = getBestMoveWinRate(data, userColor);
          const resultFen = chess.fen();

          addTimer(() => {
            dispatch({
              type: 'OPPONENT_MOVE_DONE',
              san: bestMove.san,
              from: move.from,
              to: move.to,
              resultFen,
              popularity,
              winRate: opponentWr,
              bestWinRate: opponentBestWr,
            });
          }, 500);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        dispatch({ type: 'ERROR', message: 'Failed to load opening data. Please try again.' });
      }
    },
    [addTimer],
  );

  // React to fetching_explorer phase
  useEffect(() => {
    if (state.phase === 'fetching_explorer') {
      processExplorerPhase(
        state.fen,
        state.userColor,
        lastUserMoveSanRef.current,
        preFenRef.current,
      );
      lastUserMoveSanRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.moveCount]);

  const startSession = useCallback((userColor: 'w' | 'b') => {
    preFenRef.current = STARTING_FEN;
    lastUserMoveSanRef.current = null;
    dispatch({ type: 'START_SESSION', userColor });
  }, []);

  const handleUserMove = useCallback(
    (san: string, from: string, to: string) => {
      preFenRef.current = state.fen;
      lastUserMoveSanRef.current = san;
      const chess = new Chess(state.fen);
      const move = chess.move(san);
      if (!move) return;
      dispatch({ type: 'USER_MOVE', san, from, to, resultFen: chess.fen() });
    },
    [state.fen],
  );

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    dispatch({ type: 'RESET' });
  }, []);

  return {
    phase: state.phase,
    fen: state.fen,
    orientation: state.orientation,
    lastMove: state.lastMove,
    feedbackMessage: state.feedbackMessage,
    moveHistory: state.moveHistory,
    moveCount: state.moveCount,
    finalWinRate: state.finalWinRate,
    finalVerdict: state.finalVerdict,
    errorMessage: state.errorMessage,
    isInteractive: state.phase === 'user_turn',
    startSession,
    handleUserMove,
    reset,
  };
}
