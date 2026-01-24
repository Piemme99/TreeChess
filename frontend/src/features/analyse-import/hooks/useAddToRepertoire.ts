import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../stores/toastStore';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

export function useAddToRepertoire() {
  const navigate = useNavigate();

  const handleAddToRepertoire = useCallback((move: MoveAnalysis, game: GameAnalysis) => {
    if (!game.userColor) return;

    const context = {
      color: game.userColor,
      fen: move.fen,
      moveSAN: move.san,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${game.userColor}/edit`);
    toast.info(`Navigate to position and add "${move.san}"`);
  }, [navigate]);

  return { handleAddToRepertoire };
}