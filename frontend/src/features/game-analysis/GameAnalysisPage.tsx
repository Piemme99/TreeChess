import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { fadeUp } from '../../shared/utils/animations';
import { useGameLoader } from './hooks/useGameLoader';
import { useChessNavigation, useToggleFullGame } from './hooks/useChessNavigation';
import { useFENComputed } from './hooks/useFENComputed';
import { computeFEN, computeFENPath, STARTING_FEN } from './utils/fenCalculator';
import { GameBoardSection } from './components/GameBoardSection';
import { GameNavigation } from './components/GameNavigation';
import { SessionNavigation } from './components/SessionNavigation';
import { AnalysisRepertoirePicker } from './components/AnalysisRepertoirePicker';
import { Button, Loading } from '../../shared/components/UI';
import { GameMoveList } from './components/GameMoveList';
import { useEngine } from '../../shared/hooks/useEngine';
import { useReanalysisCompletion } from '../../shared/hooks';
import { useNewGamesSession } from './hooks/useNewGamesSession';
import { countDivergences } from './utils/session';
import {
  buildLineFromDivergence,
  findFirstDivergenceIndex,
  graftLine,
  stashPendingAddSequence,
  stashPendingNavigate,
} from '../../shared/repertoireHandoff';
import { useRepertoireStore } from '../../stores/repertoireStore';
import { parseOpeningName } from './utils/parseOpeningName';
import { toast } from '../../stores/toastStore';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { MoveStatus } from '../../types';
import type { GameAnalysis, GameSummary, MoveAnalysis } from '../../types';

// Shape of the router state we attach when navigating into this page, so the
// Back button can return to wherever the user came from.
interface LocationState {
  from?: string;
}

export function GameAnalysisPage() {
  usePageTitle('Game Analysis');
  const { gameIndex } = useParams<{ id: string; gameIndex: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const { id: analysisId, analysis, loading, reanalyzeGame, updateGame, reload } = useGameLoader();
  const updateRepertoire = useRepertoireStore((s) => s.updateRepertoire);

  // Moves grafted in this analyse-session (persists while stepping between games).
  const [movesAddedThisSession, setMovesAddedThisSession] = useState(0);
  const addingRef = useRef(false);
  // Mirror of addingRef for rendering an in-flight affordance on the add button.
  const [adding, setAdding] = useState(false);

  // After an in-place add, the repertoire change triggers a debounced background
  // re-analysis; refresh the session's results once it finishes so move statuses
  // become authoritative (the optimistic highlight is replaced by the real one).
  useReanalysisCompletion(reload);

  // The ordered list of "New" games (across imports) this session steps through.
  const { sessionGames } = useNewGamesSession();

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
  const { analyze, currentEvaluation } = useEngine();

  const gameIdx = parseInt(gameIndex || '0', 10);
  const game: GameAnalysis | null = useMemo(() => {
    if (!analysis || gameIdx < 0 || gameIdx >= analysis.results.length) {
      return null;
    }
    return analysis.results[gameIdx];
  }, [analysis, gameIdx]);

  // Extract opening name from headers (Opening, ECOUrl, or ECO as fallback)
  const openingName = useMemo(
    () => (game ? parseOpeningName(game.headers) : undefined),
    [game]
  );

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
  } = useChessNavigation(game, showFullGame, initialPly, analysisId);

  const { currentFEN, lastMove } = useFENComputed(game, currentMoveIndex);

  const fenPath = useMemo(
    () => (game ? computeFENPath(game.moves, currentMoveIndex) : [STARTING_FEN]),
    [game, currentMoveIndex]
  );

  // Trigger engine analysis when position changes
  useEffect(() => {
    analyze(currentFEN);
  }, [currentFEN, analyze]);

  const handleOpenInRepertoire = useCallback((_move: MoveAnalysis, clickedIndex: number) => {
    if (!game?.matchedRepertoire) return;

    const fen = computeFEN(game.moves, clickedIndex);
    stashPendingNavigate({ repertoireId: game.matchedRepertoire.id, fen });
    navigate(`/repertoire/${game.matchedRepertoire.id}/edit`, { state: { from: location.pathname + location.search } });
  }, [game, navigate, location]);

  // Add the line from the divergence up to the clicked move onto the matched
  // repertoire IN PLACE — no navigation. The user stays in the analyse-session;
  // a toast reports what was grafted and the move statuses update optimistically.
  const handleAddToRepertoire = useCallback(async (_move: MoveAnalysis, clickedIndex: number) => {
    if (!game || !game.matchedRepertoire) return;
    if (addingRef.current) return;

    const gameIndex = game.gameIndex;

    // Start at the divergence (first move that leaves the repertoire); if the
    // line never diverges, fall back to the first out-of-book move so the user
    // can still extend the repertoire.
    let startIndex = findFirstDivergenceIndex(game.moves);
    if (startIndex === -1) {
      const outOfBookIndex = game.moves.findIndex((m) => m.status === MoveStatus.OutOfBook);
      if (outOfBookIndex === -1) return;
      startIndex = outOfBookIndex;
    }

    const endIndex = clickedIndex;
    const repName = game.matchedRepertoire.name;

    // Build the line from divergence to clicked move
    const line = buildLineFromDivergence(game.moves, startIndex, endIndex, (i) =>
      computeFEN(game.moves, i)
    );

    addingRef.current = true;
    setAdding(true);
    try {
      const result = await graftLine(game.matchedRepertoire.id, line);

      // Refresh the editor's cached repertoire so the grafted line shows up
      // without a refetch when the user next opens it.
      if (result.repertoire) {
        updateRepertoire(result.repertoire);
      }

      // Optimistically mark the moves we processed as in-repertoire so the user
      // gets immediate feedback; the background re-analysis reconciles later.
      // Patch functionally by gameIndex so we don't overwrite the game with a
      // stale snapshot captured when this callback was created.
      const processed = result.added.length + result.skipped.length;
      if (processed > 0) {
        updateGame(gameIndex, (prev) => ({
          ...prev,
          moves: prev.moves.map((m, i) =>
            i >= startIndex && i < startIndex + processed
              ? { ...m, status: MoveStatus.InRepertoire }
              : m
          ),
        }));
        setMovesAddedThisSession((n) => n + result.added.length);
      }

      if (result.error) {
        if (result.added.length > 0) {
          toast.warning(`Added ${result.added.join(', ')} to ${repName}, then stopped: ${result.error}`);
        } else {
          toast.error(result.error);
        }
      } else if (result.added.length > 0) {
        const tail = result.skipped.length ? ` (${result.skipped.length} already there)` : '';
        toast.success(`Added ${result.added.join(', ')} to ${repName}${tail}`);
      } else {
        toast.info(`Already in ${repName}`);
      }
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }, [game, updateGame, updateRepertoire]);

  // Step to another game in the session, preserving the original entry point so
  // the Back button still returns to the list the user came from.
  const handleSelectGame = useCallback((targetAnalysisId: string, targetGameIndex: number) => {
    const from = (location.state as LocationState | null)?.from;
    navigate(`/analyse/${targetAnalysisId}/game/${targetGameIndex}`, {
      state: { from: from || '/games' }
    });
  }, [navigate, location]);

  // Anchor the current game in the session even if it's no longer "New" (the
  // Games tab marks a game viewed on click-through, which would otherwise drop
  // the entry game out of the New-games list and break navigation).
  const sessionList = useMemo<GameSummary[]>(() => {
    if (!game || !analysisId) return sessionGames;
    const present = sessionGames.some(
      (g) => g.analysisId === analysisId && g.gameIndex === game.gameIndex
    );
    if (present) return sessionGames;
    const current: GameSummary = {
      analysisId,
      gameIndex: game.gameIndex,
      white: game.headers.White || '?',
      black: game.headers.Black || '?',
      result: game.headers.Result || '*',
      date: game.headers.Date || '',
      userColor: game.userColor,
      status: countDivergences(game) > 0 ? 'new-line' : 'in-repertoire',
      importedAt: '',
      source: 'pgn',
      synced: false,
    };
    return [current, ...sessionGames];
  }, [sessionGames, game, analysisId]);

  // Handle creating a new repertoire and adding the current moves to it
  const handleCreateAndAdd = useCallback((repertoireId: string) => {
    if (!game) return;

    // New repertoire is empty (only root node). Build the full sequence from move 0
    // up to the selected move, or — if no move is selected (new-opening default) —
    // up to the last displayed move so the user gets the full opening line.
    const startIndex = 0;
    const endIndex = currentMoveIndex >= 0 ? currentMoveIndex : maxDisplayedMoveIndex;
    if (endIndex < 0) return;

    const gameInfo = `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`;

    const moves = buildLineFromDivergence(game.moves, startIndex, endIndex, (i) =>
      computeFEN(game.moves, i)
    );

    stashPendingAddSequence({
      repertoireId,
      repertoireName: 'New Repertoire',
      gameInfo,
      moves,
    });

    navigate(`/repertoire/${repertoireId}/edit`, { state: { from: location.pathname + location.search } });
  }, [game, currentMoveIndex, maxDisplayedMoveIndex, navigate, location]);

  // Refresh repertoire data after import - reanalyze with new repertoires available
  const handleImportSuccess = useCallback(() => {
    // The user will need to select a repertoire from the dropdown and reanalyze
    toast.success('Repertoire imported! Select it from the dropdown above to analyze.');
  }, []);

  // Full-page spinner only on the initial load (nothing to show yet). Background
  // refreshes — e.g. the post-add re-analysis reload — keep the current view
  // mounted and swap the data in place, avoiding a whole-page flicker.
  if (loading && !analysis) {
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
    <div className="max-w-[1400px] mx-auto min-h-full flex flex-col">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="flex items-center gap-4 mb-6 pb-4 border-b border-primary/10 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate((location.state as LocationState | null)?.from || '/games')}>
          &larr; Back
        </Button>
        <span className="text-xl font-semibold font-display">Game {gameIdx + 1}: {opponent}</span>
        <span className="font-mono text-text-muted">{result}</span>
      </motion.div>

      {/* Session navigation: step between New games (across imports) in place */}
      <SessionNavigation
        sessionGames={sessionList}
        currentAnalysisId={analysisId}
        currentGameIndex={game.gameIndex}
        onSelect={handleSelectGame}
        movesAddedThisSession={movesAddedThisSession}
      />

      {/* Repertoire selector with reanalyze option */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
      <AnalysisRepertoirePicker
        userColor={game.userColor}
        currentRepertoire={game.matchedRepertoire}
        matchScore={game.matchScore}
        onReanalyze={(repertoireId) => reanalyzeGame(gameIdx, repertoireId)}
      />
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="flex gap-6 flex-1 min-h-0 max-md:flex-col">
        <GameBoardSection
          fen={currentFEN}
          fenPath={fenPath}
          orientation={flipped ? 'black' : 'white'}
          lastMove={lastMove}
          onFlip={() => setFlipped(!flipped)}
          engineEvaluation={currentEvaluation}
        />

        <div className="flex-1 min-w-0 bg-bg-card rounded-2xl p-4 shadow-md shadow-primary/5 flex flex-col overflow-hidden">
          <h3 className="text-base font-semibold font-display text-text-muted mb-4 pb-2 border-b border-primary/10">Opening</h3>
          <GameMoveList
            moves={game.moves}
            currentMoveIndex={currentMoveIndex}
            maxDisplayedIndex={maxDisplayedMoveIndex}
            onMoveClick={goToMove}
            onAddToRepertoire={game.matchedRepertoire ? handleAddToRepertoire : undefined}
            addingToRepertoire={adding}
            onOpenInRepertoire={game.matchedRepertoire ? handleOpenInRepertoire : undefined}
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
    </div>
  );
}
