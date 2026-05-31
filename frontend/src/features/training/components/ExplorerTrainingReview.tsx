import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useBatchEval } from '../../../shared/hooks/useBatchEval';
import { useMoveCursor } from '../../../shared/hooks/useMoveCursor';
import { STARTING_FEN, allFens, fenAfter, lastMoveAt } from '../../../shared/utils/chess';
import {
  buildLineFromDivergence,
  findFirstDivergenceIndex,
  isDivergence,
  stashPendingAddSequence,
  stashPendingNavigate,
} from '../../../shared/repertoireHandoff';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import { BoardColumn } from './review/BoardColumn';
import { MoveListColumn } from './review/MoveListColumn';
import { GameSummary, type GameSummaryStats } from './review/GameSummary';
import { getWinRateColor } from './review/winRateColor';
import type { MoveRecord } from '../hooks/useExplorerTraining';
import type { MoveAnalysis, RepertoireRef } from '../../../types';

interface ExplorerTrainingReviewProps {
  moveHistory: MoveRecord[];
  orientation: 'white' | 'black';
  userColor: 'w' | 'b';
  errorMessage: string | null;
  finalWinRate: number | null;
  finalVerdict: string | null;
  // Repertoire comparison data
  repertoireComparison: {
    matchedRepertoire: RepertoireRef | null;
    matchScore: number;
    moveAnalysis: MoveAnalysis[];
    loading: boolean;
  };
  onTryAgain: () => void;
  onSwitchColor: () => void;
  onBackToModes: () => void;
}

/** Build a PGN-style move string for the Lichess analysis URL. */
function buildPgn(moves: MoveRecord[]): string {
  let pgn = '';
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      pgn += `${Math.floor(i / 2) + 1}.`;
    }
    pgn += `${moves[i].san} `;
  }
  return pgn.trim();
}

const btnClass = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer text-sm';

export function ExplorerTrainingReview({
  moveHistory,
  orientation,
  userColor,
  errorMessage,
  finalWinRate,
  finalVerdict,
  repertoireComparison,
  onTryAgain,
  onSwitchColor,
  onBackToModes,
}: ExplorerTrainingReviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const moveListRef = useRef<HTMLDivElement>(null);

  // Compute all positions from the move history
  const fens = useMemo(() => allFens(moveHistory), [moveHistory]);
  const maxIndex = fens.length - 2;

  // Batch Stockfish evaluation for move quality
  const batchEval = useBatchEval(fens, userColor, !errorMessage);

  // Navigation state — start at the last move, with keyboard nav (Arrow/Home/End)
  const { currentMoveIndex, goToMove, goFirst, goPrev, goNext, goLast } = useMoveCursor(maxIndex, {
    initialIndex: maxIndex,
  });

  // Auto-scroll selected move into view
  useEffect(() => {
    if (!moveListRef.current) return;
    const el = moveListRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMoveIndex]);

  // Current position data
  const fenIndex = currentMoveIndex + 1;
  const currentFen = fens[fenIndex] ?? STARTING_FEN;
  const currentLastMove = useMemo(
    () => lastMoveAt(moveHistory, currentMoveIndex),
    [moveHistory, currentMoveIndex],
  );

  // Lichess analysis URL
  const lichessUrl = useMemo(() => {
    const pgn = buildPgn(moveHistory);
    return `https://lichess.org/analysis/pgn/${encodeURIComponent(pgn)}`;
  }, [moveHistory]);

  // "Add to Repertoire" handler — hands off the line via the shared handoff layer
  const handleAddToRepertoire = useCallback(() => {
    const { matchedRepertoire, moveAnalysis } = repertoireComparison;
    if (!matchedRepertoire || moveAnalysis.length === 0) return;

    // Start at the divergence; if the line never leaves the repertoire, fall back
    // to the first out-of-book move so the user can still extend the repertoire.
    let startIndex = findFirstDivergenceIndex(moveAnalysis);
    if (startIndex === -1) {
      const outOfBookIndex = moveAnalysis.findIndex((m) => m.status === 'out-of-book');
      if (outOfBookIndex === -1) return;
      startIndex = outOfBookIndex;
    }

    const endIndex = moveHistory.length - 1;

    const moves = buildLineFromDivergence(moveHistory, startIndex, endIndex, (i) =>
      fenAfter(moveHistory, i)
    );

    stashPendingAddSequence({
      repertoireId: matchedRepertoire.id,
      repertoireName: matchedRepertoire.name,
      gameInfo: 'Explorer Training',
      moves,
    });
    navigate(`/repertoire/${matchedRepertoire.id}/edit`, { state: { from: location.pathname } });
  }, [repertoireComparison, moveHistory, navigate, location]);

  // "Open in Repertoire" handler
  const handleOpenInRepertoire = useCallback(() => {
    const { matchedRepertoire } = repertoireComparison;
    if (!matchedRepertoire) return;
    const fen = currentMoveIndex >= 0 ? fenAfter(moveHistory, currentMoveIndex) : STARTING_FEN;
    stashPendingNavigate({ repertoireId: matchedRepertoire.id, fen });
    navigate(`/repertoire/${matchedRepertoire.id}/edit`, { state: { from: location.pathname } });
  }, [repertoireComparison, currentMoveIndex, moveHistory, navigate, location]);

  // Determine if we have actionable moves to add: a divergence (handled by the
  // shared predicate) or an out-of-book move (the explicit extend-repertoire
  // fallback — deliberately not part of `isDivergence`).
  const hasMovesToAdd = useMemo(() => {
    if (!repertoireComparison.matchedRepertoire || repertoireComparison.moveAnalysis.length === 0) return false;
    return repertoireComparison.moveAnalysis.some(
      (m) => isDivergence(m.status) || m.status === 'out-of-book'
    );
  }, [repertoireComparison]);

  // Check if current move is in-repertoire (for "Open in Repertoire" button)
  const currentMoveInRepertoire = useMemo(() => {
    if (currentMoveIndex < 0 || !repertoireComparison.matchedRepertoire) return false;
    const analysis = repertoireComparison.moveAnalysis[currentMoveIndex];
    return analysis?.status === 'in-repertoire';
  }, [currentMoveIndex, repertoireComparison]);

  // Compute game summary stats
  const gameSummary = useMemo<GameSummaryStats | null>(() => {
    if (!batchEval.done) return null;
    const userDeltas = batchEval.deltas.filter(d => d.classification !== null);
    if (userDeltas.length === 0) return null;

    const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    let totalAccuracy = 0;
    for (const d of userDeltas) {
      if (d.classification) {
        counts[d.classification.category]++;
        // Per-move accuracy: 100% minus the Win% drop (clamped to [0, 100])
        totalAccuracy += Math.max(0, Math.min(100, 100 - d.classification.winPercentDrop));
      }
    }
    const avgAccuracy = totalAccuracy / userDeltas.length;

    return { counts, avgAccuracy, totalMoves: userDeltas.length };
  }, [batchEval.done, batchEval.deltas]);

  // Error state
  if (errorMessage) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-text-muted mb-6">{errorMessage}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onTryAgain} className={btnClass}>
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <button onClick={onBackToModes} className={btnClass}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  const winRate = finalWinRate ?? 50;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBackToModes}
          className="p-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer"
          title="Back to selection"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span>Review</span>
            <span className="text-text-muted/40">|</span>
            <span>Explorer Training</span>
          </div>
        </div>
        {/* Win rate + accuracy in header */}
        <div className="flex items-center gap-3">
          {gameSummary && (
            <div className="flex items-center gap-1.5" title={`Average accuracy across ${gameSummary.totalMoves} moves`}>
              <span className="text-xs text-text-muted hidden sm:inline">Accuracy</span>
              <span className={`text-lg font-bold font-display ${gameSummary.avgAccuracy >= 80 ? 'text-success' : gameSummary.avgAccuracy >= 60 ? 'text-warning' : 'text-danger'}`}>
                {gameSummary.avgAccuracy.toFixed(0)}%
              </span>
            </div>
          )}
          {finalWinRate !== null && (
            <div className="flex items-center gap-2" title="Expected score based on Lichess database statistics for the final position">
              <span className="text-xs text-text-muted hidden sm:inline">Expected score</span>
              <span className={`text-lg font-bold font-display ${getWinRateColor(winRate)}`}>
                {winRate.toFixed(0)}%
              </span>
              <span className="text-xs text-text-muted/70 hidden sm:inline">
                {finalVerdict}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-6 flex-1 min-h-0 max-md:flex-col">
        {/* Left column: Board + eval + navigation */}
        <BoardColumn
          fen={currentFen}
          orientation={orientation}
          lastMove={currentLastMove}
          currentMoveIndex={currentMoveIndex}
          maxIndex={maxIndex}
          goFirst={goFirst}
          goPrev={goPrev}
          goNext={goNext}
          goLast={goLast}
        />

        {/* Right column: Move list + info */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <MoveListColumn
            moveHistory={moveHistory}
            userColor={userColor}
            currentMoveIndex={currentMoveIndex}
            goToMove={goToMove}
            moveListRef={moveListRef}
            repertoireComparison={repertoireComparison}
            batchEval={batchEval}
            finalWinRate={finalWinRate}
            finalVerdict={finalVerdict}
          />

          <GameSummary
            stats={gameSummary}
            lichessUrl={lichessUrl}
            hasMatchedRepertoire={!!repertoireComparison.matchedRepertoire}
            showAddToRepertoire={hasMovesToAdd}
            showOpenInRepertoire={currentMoveInRepertoire}
            onTryAgain={onTryAgain}
            onSwitchColor={onSwitchColor}
            onAddToRepertoire={handleAddToRepertoire}
            onOpenInRepertoire={handleOpenInRepertoire}
          />
        </div>
      </div>
    </div>
  );
}
