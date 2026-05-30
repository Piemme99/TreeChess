import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { toast } from '../../../stores/toastStore';
import { stashPendingAddSequence } from '../../../shared/repertoireHandoff';
import { makeMove } from '../../../shared/utils/chess';
import { computeParentFEN } from '../utils/fenUtils';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

export function useAddToRepertoire() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAddToRepertoire = useCallback((move: MoveAnalysis, game: GameAnalysis) => {
    if (!game.userColor) return;

    if (!game.matchedRepertoire) {
      toast.error('No matching repertoire found for this game. Create a repertoire first.');
      return;
    }

    const parentFEN = computeParentFEN(game.moves, move);
    const resultFEN = makeMove(parentFEN, move.san);
    if (!resultFEN) {
      toast.error(`Invalid move: ${move.san}`);
      return;
    }

    stashPendingAddSequence({
      repertoireId: game.matchedRepertoire.id,
      repertoireName: game.matchedRepertoire.name,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`,
      moves: [{ parentFEN, moveSAN: move.san, resultFEN }],
    });

    navigate(`/repertoire/${game.matchedRepertoire.id}/edit`, { state: { from: location.pathname } });
  }, [navigate, location]);

  return { handleAddToRepertoire };
}
