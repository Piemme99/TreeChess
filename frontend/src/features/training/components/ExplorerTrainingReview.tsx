import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Chess } from 'chess.js';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { EvalBar } from '../../repertoire/edit/components/EvalBar';
import { GameNavigation } from '../../game-analysis/components/GameNavigation';
import { useEngine } from '../../repertoire/edit/hooks/useEngine';
import { useBatchEval } from '../hooks/useBatchEval';
import { STARTING_FEN } from '../../../shared/utils/chess';
import { RotateCcw, ArrowUpDown, ExternalLink, ArrowLeft, BookOpen, Plus, Loader2 } from 'lucide-react';
import type { MoveRecord } from '../hooks/useExplorerTraining';
import type { MoveEvalDelta } from '../hooks/useBatchEval';
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

/** Compute all FENs from a list of SAN moves starting from the initial position. */
function computePositions(moves: MoveRecord[]): { fens: string[]; lastMoves: ({ from: string; to: string } | null)[] } {
  const fens: string[] = [STARTING_FEN];
  const lastMoves: ({ from: string; to: string } | null)[] = [null];
  const chess = new Chess();

  for (const record of moves) {
    const move = chess.move(record.san);
    if (!move) break;
    fens.push(chess.fen());
    lastMoves.push({ from: move.from, to: move.to });
  }

  return { fens, lastMoves };
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

/** Compute FEN after replaying moves up to index. */
function computeFenAtIndex(moves: MoveRecord[], upToIndex: number): string {
  if (upToIndex < 0) return STARTING_FEN;
  const chess = new Chess();
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    try { chess.move(moves[i].san); } catch { break; }
  }
  return chess.fen();
}

function getWinRateColor(winRate: number): string {
  if (winRate >= 55) return 'text-success';
  if (winRate >= 48) return 'text-primary';
  if (winRate >= 40) return 'text-amber-500';
  return 'text-danger';
}

/** Format a centipawn score as a readable string like "+0.3" or "-1.2". */
function formatCp(cp: number): string {
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/**
 * Classify a user move's quality from its centipawn loss (Stockfish eval delta).
 *
 * For suboptimal moves, displays the loss in pawns (e.g. "-0.4").
 * Good moves show no extra text, just a green dot.
 */
function getMoveQualityFromEval(
  delta: MoveEvalDelta | undefined,
): { dotColor: string; sanColor: string; lossDisplay: string | null; title: string } | null {
  if (!delta || delta.cpLoss === null) return null;
  const loss = delta.cpLoss;

  if (loss <= 20) {
    return {
      dotColor: 'bg-success',
      sanColor: 'text-success',
      lossDisplay: null,
      title: `Good move (${formatCp(delta.scoreAfter ?? 0)})`,
    };
  }
  if (loss <= 60) {
    return {
      dotColor: 'bg-warning',
      sanColor: 'text-warning',
      lossDisplay: `-${(loss / 100).toFixed(1)}`,
      title: `Inaccuracy: lost ${(loss / 100).toFixed(2)} pawns (eval ${formatCp(delta.scoreAfter ?? 0)})`,
    };
  }
  return {
    dotColor: 'bg-danger',
    sanColor: 'text-danger',
    lossDisplay: `-${(loss / 100).toFixed(1)}`,
    title: `Mistake: lost ${(loss / 100).toFixed(2)} pawns (eval ${formatCp(delta.scoreAfter ?? 0)})`,
  };
}

function getRepertoireStatusBadge(status: string | undefined): { label: string; className: string } | null {
  switch (status) {
    case 'in-repertoire':
      return { label: 'In rep.', className: 'bg-success/10 text-success' };
    case 'out-of-repertoire':
      return { label: 'Deviation', className: 'bg-danger/10 text-danger' };
    case 'opponent-new':
      return { label: 'New line', className: 'bg-info/10 text-info' };
    case 'out-of-book':
      return null; // Don't show badge for out-of-book (would clutter)
    default:
      return null;
  }
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
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  // Board sizing — responsive
  useEffect(() => {
    const el = boardWrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setBoardSize(Math.floor(Math.min(width, 560)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Compute all positions from the move history
  const { fens, lastMoves } = useMemo(() => computePositions(moveHistory), [moveHistory]);
  const maxIndex = fens.length - 2;

  // Batch Stockfish evaluation for move quality
  const batchEval = useBatchEval(fens, userColor, !errorMessage);

  // Navigation state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(maxIndex);

  const goToMove = useCallback((index: number) => {
    setCurrentMoveIndex(Math.max(-1, Math.min(index, maxIndex)));
  }, [maxIndex]);

  const goFirst = useCallback(() => goToMove(-1), [goToMove]);
  const goPrev = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex]);
  const goNext = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex]);
  const goLast = useCallback(() => goToMove(maxIndex), [goToMove, maxIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); goToMove(currentMoveIndex - 1); break;
        case 'ArrowRight': e.preventDefault(); goToMove(currentMoveIndex + 1); break;
        case 'Home': e.preventDefault(); goToMove(-1); break;
        case 'End': e.preventDefault(); goToMove(maxIndex); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToMove, currentMoveIndex, maxIndex]);

  // Auto-scroll selected move into view
  useEffect(() => {
    if (!moveListRef.current) return;
    const el = moveListRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMoveIndex]);

  // Current position data
  const fenIndex = currentMoveIndex + 1;
  const currentFen = fens[fenIndex] ?? STARTING_FEN;
  const currentLastMove = lastMoves[fenIndex] ?? null;

  // Stockfish analysis
  const engine = useEngine();

  useEffect(() => {
    engine.analyze(currentFen);
  }, [currentFen, engine]);

  const bestMoveArrow = useMemo<[string, string, string?][]>(() => {
    if (engine.currentEvaluation?.bestMoveFrom && engine.currentEvaluation?.bestMoveTo) {
      return [[engine.currentEvaluation.bestMoveFrom, engine.currentEvaluation.bestMoveTo, 'rgba(230, 126, 34, 0.6)']];
    }
    return [];
  }, [engine.currentEvaluation?.bestMoveFrom, engine.currentEvaluation?.bestMoveTo]);

  // Lichess analysis URL
  const lichessUrl = useMemo(() => {
    const pgn = buildPgn(moveHistory);
    return `https://lichess.org/analysis/pgn/${encodeURIComponent(pgn)}`;
  }, [moveHistory]);

  // Build move pairs for display
  const movePairs = useMemo(() => {
    const pairs: { number: number; white?: MoveEntry; black?: MoveEntry }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: {
          index: i,
          record: moveHistory[i],
          analysis: repertoireComparison.moveAnalysis[i],
          evalDelta: batchEval.deltas[i],
        },
        black: moveHistory[i + 1] ? {
          index: i + 1,
          record: moveHistory[i + 1],
          analysis: repertoireComparison.moveAnalysis[i + 1],
          evalDelta: batchEval.deltas[i + 1],
        } : undefined,
      });
    }
    return pairs;
  }, [moveHistory, repertoireComparison.moveAnalysis, batchEval.deltas]);

  // "Add to Repertoire" handler — reuses the pendingAddNode sessionStorage mechanism
  const handleAddToRepertoire = useCallback(() => {
    const { matchedRepertoire, moveAnalysis } = repertoireComparison;
    if (!matchedRepertoire || moveAnalysis.length === 0) return;

    // Find divergence point
    const divergenceIndex = moveAnalysis.findIndex(
      m => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
    );

    let startIndex: number;
    if (divergenceIndex !== -1) {
      startIndex = divergenceIndex;
    } else {
      const outOfBookIndex = moveAnalysis.findIndex(m => m.status === 'out-of-book');
      if (outOfBookIndex === -1) return;
      startIndex = outOfBookIndex;
    }

    const endIndex = moveHistory.length - 1;

    // Build move sequence with FENs
    const moves: { parentFEN: string; moveSAN: string; resultFEN: string }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const parentFEN = i === 0 ? STARTING_FEN : computeFenAtIndex(moveHistory, i - 1);
      const resultFEN = computeFenAtIndex(moveHistory, i);
      moves.push({
        parentFEN,
        moveSAN: moveHistory[i].san,
        resultFEN,
      });
    }

    const context = {
      repertoireId: matchedRepertoire.id,
      repertoireName: matchedRepertoire.name,
      gameInfo: 'Explorer Training',
      moves,
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));
    navigate(`/repertoire/${matchedRepertoire.id}/edit`, { state: { from: location.pathname } });
  }, [repertoireComparison, moveHistory, navigate, location]);

  // "Open in Repertoire" handler
  const handleOpenInRepertoire = useCallback(() => {
    const { matchedRepertoire } = repertoireComparison;
    if (!matchedRepertoire) return;
    const fen = currentMoveIndex >= 0 ? computeFenAtIndex(moveHistory, currentMoveIndex) : STARTING_FEN;
    sessionStorage.setItem('pendingNavigateToFen', JSON.stringify({
      repertoireId: matchedRepertoire.id,
      fen,
    }));
    navigate(`/repertoire/${matchedRepertoire.id}/edit`, { state: { from: location.pathname } });
  }, [repertoireComparison, currentMoveIndex, moveHistory, navigate, location]);

  // Determine if we have actionable moves to add
  const hasMovesToAdd = useMemo(() => {
    if (!repertoireComparison.matchedRepertoire || repertoireComparison.moveAnalysis.length === 0) return false;
    return repertoireComparison.moveAnalysis.some(
      m => m.status === 'opponent-new' || m.status === 'out-of-repertoire' || m.status === 'out-of-book'
    );
  }, [repertoireComparison]);

  // Check if current move is in-repertoire (for "Open in Repertoire" button)
  const currentMoveInRepertoire = useMemo(() => {
    if (currentMoveIndex < 0 || !repertoireComparison.matchedRepertoire) return false;
    const analysis = repertoireComparison.moveAnalysis[currentMoveIndex];
    return analysis?.status === 'in-repertoire';
  }, [currentMoveIndex, repertoireComparison]);

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
        {/* Win rate + verdict in header */}
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

      {/* 2-column layout */}
      <div className="flex gap-6 flex-1 min-h-0 max-md:flex-col">
        {/* Left column: Board + eval + navigation */}
        <div className="flex flex-col gap-2 shrink-0 max-md:items-center max-md:w-full">
          <div className="flex items-stretch gap-1">
            <EvalBar
              score={engine.currentEvaluation?.score}
              mate={engine.currentEvaluation?.mate}
              fen={currentFen}
            />
            <div ref={boardWrapperRef} className="w-full max-w-[560px]">
              <ChessBoard
                fen={currentFen}
                orientation={orientation}
                interactive={false}
                lastMove={currentLastMove}
                width={boardSize}
                customArrows={bestMoveArrow}
              />
            </div>
          </div>
          <GameNavigation
            currentMoveIndex={currentMoveIndex}
            maxDisplayedMoveIndex={maxIndex}
            goFirst={goFirst}
            goPrev={goPrev}
            goNext={goNext}
            goLast={goLast}
          />
        </div>

        {/* Right column: Move list + info */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Repertoire match banner */}
          {repertoireComparison.loading ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Comparing with repertoire...
            </div>
          ) : repertoireComparison.matchedRepertoire ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-sm">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-text truncate">{repertoireComparison.matchedRepertoire.name}</span>
              <span className="text-text-muted shrink-0">{repertoireComparison.matchScore} moves matched</span>
            </div>
          ) : !repertoireComparison.loading && repertoireComparison.moveAnalysis.length > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-sm text-text-muted">
              <BookOpen className="w-4 h-4 shrink-0" />
              No matching repertoire found
            </div>
          ) : null}

          {/* Move list */}
          <div className="rounded-2xl border border-primary/10 bg-bg-card overflow-hidden flex flex-col min-h-0 flex-1">
            <div className="px-4 py-2.5 border-b border-primary/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Moves</span>
                {finalWinRate !== null && (
                  <span className="text-xs text-text-muted sm:hidden">
                    <span className={`font-bold ${getWinRateColor(winRate)}`}>{winRate.toFixed(0)}%</span> {finalVerdict}
                  </span>
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted/70">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                  Good
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
                  <span className="text-warning">-0.3</span> Inaccuracy
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger" />
                  <span className="text-danger">-1.2</span> Mistake
                </span>
                {!batchEval.done && (
                  <span className="flex items-center gap-1 text-text-muted/50">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {batchEval.progress}/{batchEval.total}
                  </span>
                )}
                {repertoireComparison.matchedRepertoire && (
                  <>
                    <span className="text-text-muted/30 mx-0.5">|</span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block rounded bg-success/10 text-success px-1">In rep.</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block rounded bg-danger/10 text-danger px-1">Deviation</span>
                    </span>
                  </>
                )}
              </div>
            </div>
            <div ref={moveListRef} className="overflow-y-auto flex-1 divide-y divide-primary/5" style={{ maxHeight: '400px' }}>
              {movePairs.map((pair) => (
                <div key={pair.number} className="flex items-center px-3 py-1.5 text-sm">
                  <span className="w-7 text-text-muted/60 text-xs font-mono shrink-0">{pair.number}.</span>
                  {pair.white && (
                    <MoveCell
                      entry={pair.white}
                      isSelected={currentMoveIndex === pair.white.index}
                      isUserColor={userColor === 'w'}
                      onClick={() => goToMove(pair.white!.index)}
                    />
                  )}
                  {pair.black && (
                    <MoveCell
                      entry={pair.black}
                      isSelected={currentMoveIndex === pair.black.index}
                      isUserColor={userColor === 'b'}
                      onClick={() => goToMove(pair.black!.index)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Expected move hint */}
            {currentMoveIndex >= 0 && repertoireComparison.moveAnalysis[currentMoveIndex]?.status === 'out-of-repertoire' && (
              <div className="px-4 py-2 border-t border-danger/20 bg-danger/5 text-xs text-danger">
                Expected: <span className="font-semibold">{repertoireComparison.moveAnalysis[currentMoveIndex].expectedMove}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onTryAgain} className={btnClass}>
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <button onClick={onSwitchColor} className={btnClass}>
              <ArrowUpDown className="w-3.5 h-3.5" />
              Switch Color
            </button>
            <a
              href={lichessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={btnClass}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Lichess
            </a>
            {repertoireComparison.matchedRepertoire && hasMovesToAdd && (
              <button onClick={handleAddToRepertoire} className={btnClass}>
                <Plus className="w-3.5 h-3.5" />
                Add to Repertoire
              </button>
            )}
            {repertoireComparison.matchedRepertoire && currentMoveInRepertoire && (
              <button onClick={handleOpenInRepertoire} className={btnClass}>
                <BookOpen className="w-3.5 h-3.5" />
                Open in Repertoire
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Move cell sub-component ---

interface MoveEntry {
  index: number;
  record: MoveRecord;
  analysis?: MoveAnalysis;
  evalDelta?: MoveEvalDelta;
}

interface MoveCellProps {
  entry: MoveEntry;
  isSelected: boolean;
  isUserColor: boolean;
  onClick: () => void;
}

function MoveCell({ entry, isSelected, isUserColor, onClick }: MoveCellProps) {
  const { record, analysis, evalDelta } = entry;
  const quality = record.isUser
    ? getMoveQualityFromEval(evalDelta)
    : null;
  const repBadge = analysis ? getRepertoireStatusBadge(analysis.status) : null;

  const repTitle = analysis?.status === 'in-repertoire' ? 'This move is in your repertoire'
    : analysis?.status === 'out-of-repertoire' ? `Deviation — your repertoire expects ${analysis.expectedMove || 'a different move'}`
    : analysis?.status === 'opponent-new' ? 'Opponent move not covered in your repertoire'
    : undefined;

  // SAN color: quality color for user moves, muted for opponent moves
  const sanColor = quality
    ? quality.sanColor
    : isUserColor ? 'text-text' : 'text-text-muted';

  return (
    <div
      data-selected={isSelected}
      onClick={onClick}
      className={`flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 rounded-lg cursor-pointer transition-all duration-100
        ${isSelected ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-primary-light/30'}
      `}
    >
      {/* Quality dot — only for user moves with eval data */}
      {quality ? (
        <span
          title={quality.title}
          className={`w-2 h-2 rounded-full shrink-0 ${quality.dotColor}`}
        />
      ) : (
        <span className="w-2 shrink-0" /> /* spacer to keep alignment */
      )}
      <span className={`font-medium text-sm ${sanColor}`} title={quality?.title}>
        {record.san}
      </span>
      {/* Eval loss for suboptimal moves — shows pawn loss like "-0.4" */}
      {quality?.lossDisplay && (
        <span
          title={quality.title}
          className={`text-[10px] leading-tight font-mono ${quality.sanColor} opacity-70`}
        >
          {quality.lossDisplay}
        </span>
      )}
      {/* Repertoire badge — textual, visually distinct from the quality indicator */}
      {repBadge && (
        <span
          title={repTitle}
          className={`text-[10px] leading-tight px-1 py-0.5 rounded ${repBadge.className}`}
        >
          {repBadge.label}
        </span>
      )}
    </div>
  );
}
