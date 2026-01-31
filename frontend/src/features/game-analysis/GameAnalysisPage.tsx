import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameLoader } from './hooks/useGameLoader';
import { useChessNavigation, useToggleFullGame } from './hooks/useChessNavigation';
import { useFENComputed } from './hooks/useFENComputed';
import { computeFEN, STARTING_FEN } from './utils/fenCalculator';
import { GameBoardSection } from './components/GameBoardSection';
import { GameNavigation } from './components/GameNavigation';
import { RepertoireSelector } from './components/RepertoireSelector';
import { Button, Loading, ConfirmModal } from '../../shared/components/UI';
import { GameMoveList } from './components/GameMoveList';
import { useDeleteGame } from '../analyse-tab/hooks/useDeleteGame';
import { toast } from '../../stores/toastStore';
import type { GameAnalysis, MoveAnalysis } from '../../types';

export function GameAnalysisPage() {
  const { gameIndex } = useParams<{ id: string; gameIndex: string }>();
  const navigate = useNavigate();

  const { analysis, loading, reanalyzeGame } = useGameLoader();
  const [flipped, setFlipped] = useState(false);
  const { showFullGame, toggleFullGame } = useToggleFullGame();
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(() => {
    navigate('/games');
  });

  const gameIdx = parseInt(gameIndex || '0', 10);
  const game: GameAnalysis | null = useMemo(() => {
    if (!analysis || gameIdx < 0 || gameIdx >= analysis.results.length) {
      return null;
    }
    return analysis.results[gameIdx];
  }, [analysis, gameIdx]);

  useEffect(() => {
    if (game?.userColor === 'black') {
      setFlipped(true);
    }
  }, [game?.userColor]);

  const {
    currentMoveIndex,
    maxDisplayedMoveIndex,
    hasMoreMoves,
    goToMove,
    goFirst,
    goPrev,
    goNext,
    goLast
  } = useChessNavigation(game, showFullGame);

  const { currentFEN, lastMove } = useFENComputed(game, currentMoveIndex);

  const handleAddToRepertoire = useCallback((_move: MoveAnalysis, clickedIndex: number) => {
    if (!game || !game.userColor) return;

    if (!game.matchedRepertoire) {
      toast.error('No matching repertoire found for this game. Create a repertoire first.');
      return;
    }

    // Find the divergence index: first non-in-repertoire move
    const divergenceIndex = game.moves.findIndex(
      m => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
    );
    if (divergenceIndex === -1) return;

    const startIndex = divergenceIndex;
    const endIndex = clickedIndex;

    const gameInfo = `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`;

    // Build array of moves from divergence to clicked move
    const moves: { parentFEN: string; moveSAN: string; resultFEN: string }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const parentFEN = i === 0 ? STARTING_FEN : computeFEN(game.moves, i - 1);
      const resultFEN = computeFEN(game.moves, i);
      moves.push({
        parentFEN,
        moveSAN: game.moves[i].san,
        resultFEN
      });
    }

    const context = {
      repertoireId: game.matchedRepertoire.id,
      repertoireName: game.matchedRepertoire.name,
      gameInfo,
      moves
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${game.matchedRepertoire.id}/edit`);
  }, [game, navigate]);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto min-h-full flex flex-col">
        <Loading size="lg" text="Loading game..." />
      </div>
    );
  }

  if (!analysis || !game) {
    return (
      <div className="max-w-[1000px] mx-auto min-h-full flex flex-col">
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <p>Game not found</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const opponent = game.headers.White && game.headers.Black
    ? `${game.headers.White} vs ${game.headers.Black}`
    : 'Unknown players';
  const result = game.headers.Result || '*';

  return (
    <div className="max-w-[1000px] mx-auto min-h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
          &larr; Back
        </Button>
        <span className="text-xl font-semibold">Game {gameIdx + 1}: {opponent}</span>
        <span className="font-mono text-text-muted">{result}</span>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteTarget({ analysisId: analysis.id, gameIndex: gameIdx })}
        >
          Delete
        </Button>
      </div>

      {/* Repertoire selector with reanalyze option */}
      <RepertoireSelector
        userColor={game.userColor}
        currentRepertoire={game.matchedRepertoire}
        matchScore={game.matchScore}
        onReanalyze={(repertoireId) => reanalyzeGame(gameIdx, repertoireId)}
      />

      <div className="flex gap-6 flex-1 min-h-0 max-md:flex-col">
        <GameBoardSection
          fen={currentFEN}
          orientation={flipped ? 'black' : 'white'}
          lastMove={lastMove}
          onFlip={() => setFlipped(!flipped)}
        />

        <div className="flex-1 min-w-0 bg-bg-card rounded-lg p-4 shadow-sm flex flex-col overflow-hidden">
          <h3 className="text-base font-semibold text-text-muted mb-4 pb-2 border-b border-border">Opening</h3>
          <GameMoveList
            moves={game.moves}
            currentMoveIndex={currentMoveIndex}
            maxDisplayedIndex={maxDisplayedMoveIndex}
            onMoveClick={goToMove}
            onAddToRepertoire={game.matchedRepertoire ? handleAddToRepertoire : undefined}
            showFullGame={showFullGame}
            hasMoreMoves={hasMoreMoves}
            onToggleFullGame={toggleFullGame}
          />
        </div>
      </div>

      <GameNavigation
        currentMoveIndex={currentMoveIndex}
        maxDisplayedMoveIndex={maxDisplayedMoveIndex}
        goFirst={goFirst}
        goPrev={goPrev}
        goNext={goNext}
        goLast={goLast}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Game"
        message="Are you sure you want to delete this game? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
