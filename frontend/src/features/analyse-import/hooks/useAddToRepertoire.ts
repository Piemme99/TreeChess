import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../stores/toastStore';
import { computeParentFEN } from '../utils/fenUtils';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

export function useAddToRepertoire() {
  const navigate = useNavigate();

  const handleAddToRepertoire = useCallback((move: MoveAnalysis, game: GameAnalysis) => {
    if (!game.userColor) return;

    if (!game.matchedRepertoire) {
      toast.error('No matching repertoire found for this game. Create a repertoire first.');
      return;
    }

    const parentFEN = computeParentFEN(game.moves, move);

    const context = {
      repertoireId: game.matchedRepertoire.id,
      repertoireName: game.matchedRepertoire.name,
      parentFEN,
      moveSAN: move.san,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${game.matchedRepertoire.id}/edit`);
  }, [navigate]);

  return { handleAddToRepertoire };
}