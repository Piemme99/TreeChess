import { useCallback } from 'react';
import { Chess } from 'chess.js';

/**
 * Custom hook wrapping chess.js operations
 */
export function useChess() {
  const createPosition = useCallback((fen?: string) => {
    return fen ? new Chess(fen) : new Chess();
  }, []);

  const isValidMove = useCallback((fen: string, san: string): boolean => {
    try {
      const chess = new Chess(fen);
      const move = chess.move(san);
      return move !== null;
    } catch {
      return false;
    }
  }, []);

  const makeMove = useCallback((fen: string, san: string): string | null => {
    try {
      const chess = new Chess(fen);
      const move = chess.move(san);
      return move ? chess.fen() : null;
    } catch {
      return null;
    }
  }, []);

  const getLegalMoves = useCallback((fen: string) => {
    try {
      const chess = new Chess(fen);
      return chess.moves({ verbose: true });
    } catch {
      return [];
    }
  }, []);

  const getTurn = useCallback((fen: string): 'w' | 'b' => {
    try {
      const chess = new Chess(fen);
      return chess.turn();
    } catch {
      return 'w';
    }
  }, []);

  const getShortFEN = useCallback((fullFEN: string): string => {
    // Remove halfmove clock and fullmove number
    const parts = fullFEN.split(' ');
    return parts.slice(0, 4).join(' ');
  }, []);

  const getMoveNumber = useCallback((fen: string): number => {
    const parts = fen.split(' ');
    return parseInt(parts[5] || '1', 10);
  }, []);

  return {
    createPosition,
    isValidMove,
    makeMove,
    getLegalMoves,
    getTurn,
    getShortFEN,
    getMoveNumber
  };
}
