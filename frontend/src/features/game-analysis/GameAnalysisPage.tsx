import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '../../shared/utils/animations';
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
import { useEngine } from '../repertoire/edit/hooks/useEngine';
import { toast } from '../../stores/toastStore';
import type { GameAnalysis, MoveAnalysis } from '../../types';

export function GameAnalysisPage() {
  const { gameIndex } = useParams<{ id: string; gameIndex: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { analysis, loading, reanalyzeGame } = useGameLoader();

  // Read initial ply from query parameter
  const initialPly = useMemo(() => {
    const plyParam = searchParams.get('ply');
    if (plyParam !== null) {
      const parsed = parseInt(plyParam, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }, [searchParams]);
  const [flipped, setFlipped] = useState(false);
  const { showFullGame, toggleFullGame } = useToggleFullGame();
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(() => {
    navigate('/games');
  });
  const engine = useEngine();

  const gameIdx = parseInt(gameIndex || '0', 10);
  const game: GameAnalysis | null = useMemo(() => {
    if (!analysis || gameIdx < 0 || gameIdx >= analysis.results.length) {
      return null;
    }
    return analysis.results[gameIdx];
  }, [analysis, gameIdx]);

  // Extract opening name from headers (Opening, ECOUrl, or ECO as fallback)
  const openingName = useMemo(() => {
    if (!game) return undefined;
    const { Opening, ECOUrl, ECO } = game.headers;

    // If Opening header exists, use it
    if (Opening) return Opening;

    // Extract from Chess.com ECOUrl (e.g., "https://www.chess.com/openings/Sicilian-Defense-...")
    if (ECOUrl) {
      const match = ECOUrl.match(/\/openings\/([^?]+)/);
      if (match) {
        let name = match[1];
        // Remove move sequences (e.g., "...4.O-O-Nge7-5.Re1") - stop at first digit followed by a dot
        name = name.replace(/\.{2,}.*$/, ''); // Remove "..." and everything after
        name = name.replace(/-\d+\..*$/, ''); // Remove move sequences like "-4.O-O-..."
        // Convert "Sicilian-Defense-Najdorf-Variation" to "Sicilian Defense Najdorf Variation"
        return name.replace(/-/g, ' ');
      }
    }

    // Fallback to ECO code
    return ECO;
  }, [game]);

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
  } = useChessNavigation(game, showFullGame, initialPly);

  const { currentFEN, lastMove } = useFENComputed(game, currentMoveIndex);

  // Trigger engine analysis when position changes
  useEffect(() => {
    engine.analyze(currentFEN);
  }, [currentFEN, engine]);

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

  // Handle creating a new repertoire and adding the current moves to it
  const handleCreateAndAdd = useCallback((repertoireId: string) => {
    if (!game || !game.userColor) return;

    // Find the divergence index: first non-in-repertoire move
    const divergenceIndex = game.moves.findIndex(
      m => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
    );

    // If no divergence, start from current move
    const startIndex = divergenceIndex === -1 ? currentMoveIndex : divergenceIndex;
    const endIndex = currentMoveIndex;

    const gameInfo = `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`;

    // Build array of moves from start to current move
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
      repertoireId,
      repertoireName: 'New Repertoire',
      gameInfo,
      moves
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${repertoireId}/edit`);
  }, [game, currentMoveIndex, navigate]);

  // Refresh repertoire data after import - reanalyze with new repertoires available
  const handleImportSuccess = useCallback(() => {
    // The user will need to select a repertoire from the dropdown and reanalyze
    toast.success('Repertoire imported! Select it from the dropdown above to analyze.');
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-full flex flex-col">
        <Loading size="lg" text="Loading game..." />
      </div>
    );
  }

  if (!analysis || !game) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-full flex flex-col">
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
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-[1400px] mx-auto min-h-full flex flex-col"
    >
      <motion.div variants={fadeUp} custom={0} className="flex items-center gap-4 mb-6 pb-4 border-b border-primary/10 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
          &larr; Back
        </Button>
        <span className="text-xl font-semibold font-display">Game {gameIdx + 1}: {opponent}</span>
        <span className="font-mono text-text-muted">{result}</span>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => setDeleteTarget({ analysisId: analysis.id, gameIndex: gameIdx })}
        >
          Delete
        </Button>
      </motion.div>

      {/* Repertoire selector with reanalyze option */}
      <motion.div variants={fadeUp} custom={1}>
      <RepertoireSelector
        userColor={game.userColor}
        currentRepertoire={game.matchedRepertoire}
        matchScore={game.matchScore}
        onReanalyze={(repertoireId) => reanalyzeGame(gameIdx, repertoireId)}
      />
      </motion.div>

      <motion.div variants={fadeUp} custom={2} className="flex gap-6 flex-1 min-h-0 max-md:flex-col">
        <GameBoardSection
          fen={currentFEN}
          orientation={flipped ? 'black' : 'white'}
          lastMove={lastMove}
          onFlip={() => setFlipped(!flipped)}
          engineEvaluation={engine.currentEvaluation}
        />

        <div className="flex-1 min-w-0 bg-bg-card rounded-2xl p-4 shadow-md shadow-primary/5 flex flex-col overflow-hidden">
          <h3 className="text-base font-semibold font-display text-text-muted mb-4 pb-2 border-b border-primary/10">Opening</h3>
          <GameMoveList
            moves={game.moves}
            currentMoveIndex={currentMoveIndex}
            maxDisplayedIndex={maxDisplayedMoveIndex}
            onMoveClick={goToMove}
            onAddToRepertoire={game.matchedRepertoire ? handleAddToRepertoire : undefined}
            onCreateAndAdd={handleCreateAndAdd}
            onImportSuccess={handleImportSuccess}
            userColor={game.userColor}
            openingName={openingName}
            showFullGame={showFullGame}
            hasMoreMoves={hasMoreMoves}
            onToggleFullGame={toggleFullGame}
          />
        </div>
      </motion.div>

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
    </motion.div>
  );
}
