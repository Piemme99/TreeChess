import { useCallback } from 'react';
import { Chess } from 'chess.js';
import {
  isValidMove,
  makeMove,
  getLegalMoves,
  getTurn,
  getMoveNumber
} from '../utils/chess';

/**
 * Custom hook wrapping chess.js operations
 */
export function useChess() {
  const createPosition = useCallback((fen?: string) => {
    return fen ? new Chess(fen) : new Chess();
  }, []);

  return {
    createPosition,
    isValidMove,
    makeMove,
    getLegalMoves,
    getTurn,
    getMoveNumber
  };
}
