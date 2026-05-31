import { useMemo } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { getMoveQualityDisplay, formatWinPercent } from '../../../../shared/utils/moveClassification';
import { getWinRateColor } from './winRateColor';
import type { MoveEvalDelta } from '../../../../shared/hooks/useBatchEval';
import type { MoveClassification } from '../../../../shared/utils/moveClassification';
import type { MoveAnalysis, RepertoireRef } from '../../../../types';
import type { MoveRecord } from '../../hooks/useExplorerTraining';

/**
 * Get display info for a move using the unified Win% classification system.
 * Returns null for opponent moves or moves without eval data.
 */
function getMoveQualityInfo(
  delta: MoveEvalDelta | undefined,
): ReturnType<typeof getMoveQualityDisplay> | null {
  if (!delta?.classification) return null;
  return getMoveQualityDisplay(delta.classification);
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

interface RepertoireComparison {
  matchedRepertoire: RepertoireRef | null;
  matchScore: number;
  moveAnalysis: MoveAnalysis[];
  loading: boolean;
}

interface BatchEvalState {
  deltas: MoveEvalDelta[];
  done: boolean;
  progress: number;
  total: number;
}

interface MoveListColumnProps {
  moveHistory: MoveRecord[];
  userColor: 'w' | 'b';
  currentMoveIndex: number;
  goToMove: (index: number) => void;
  moveListRef: React.RefObject<HTMLDivElement | null>;
  repertoireComparison: RepertoireComparison;
  batchEval: BatchEvalState;
  finalWinRate: number | null;
  finalVerdict: string | null;
}

/** Repertoire match banner + move list + per-move quality/repertoire feedback. */
export function MoveListColumn({
  moveHistory,
  userColor,
  currentMoveIndex,
  goToMove,
  moveListRef,
  repertoireComparison,
  batchEval,
  finalWinRate,
  finalVerdict,
}: MoveListColumnProps) {
  const winRate = finalWinRate ?? 50;

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

  return (
    <>
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
          {/* Legend — 6 categories */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted/70">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500" />
              Best
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
              Excellent
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success/60" />
              Good
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
              Inaccuracy
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
              Mistake
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger" />
              Blunder
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

        {/* Win% info for selected move */}
        {currentMoveIndex >= 0 && batchEval.deltas[currentMoveIndex]?.classification && (
          <SelectedMoveInfo
            classification={batchEval.deltas[currentMoveIndex].classification!}
          />
        )}
      </div>
    </>
  );
}

// --- Selected move info panel ---

interface SelectedMoveInfoProps {
  classification: MoveClassification;
}

function SelectedMoveInfo({ classification }: SelectedMoveInfoProps) {
  const display = getMoveQualityDisplay(classification);
  const isNegative = classification.category === 'inaccuracy' || classification.category === 'mistake' || classification.category === 'blunder';

  if (!isNegative) return null;

  return (
    <div className="px-4 py-2 border-t border-primary/10 bg-bg text-xs">
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${display.sanColor}`}>
          {classification.category.charAt(0).toUpperCase() + classification.category.slice(1)}
        </span>
        <span className="text-text-muted">
          Lost {classification.winPercentDrop.toFixed(1)}% winning chances
        </span>
        <span className="text-text-muted/60">
          ({formatWinPercent(classification.winPercentBefore)} &rarr; {formatWinPercent(classification.winPercentAfter)})
        </span>
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
    ? getMoveQualityInfo(evalDelta)
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
        {quality?.symbol && (
          <span className="ml-0.5 text-[10px] opacity-70">{quality.symbol}</span>
        )}
      </span>
      {/* Win% loss for suboptimal moves */}
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
