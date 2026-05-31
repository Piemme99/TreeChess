import { RotateCcw, ArrowUpDown, ExternalLink, BookOpen, Plus } from 'lucide-react';

export interface GameSummaryStats {
  counts: {
    best: number;
    excellent: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  avgAccuracy: number;
  totalMoves: number;
}

const btnClass = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer text-sm';

interface GameSummaryProps {
  stats: GameSummaryStats | null;
  lichessUrl: string;
  hasMatchedRepertoire: boolean;
  showAddToRepertoire: boolean;
  showOpenInRepertoire: boolean;
  onTryAgain: () => void;
  onSwitchColor: () => void;
  onAddToRepertoire: () => void;
  onOpenInRepertoire: () => void;
}

/** Per-category move-quality counts + post-game action buttons. */
export function GameSummary({
  stats,
  lichessUrl,
  hasMatchedRepertoire,
  showAddToRepertoire,
  showOpenInRepertoire,
  onTryAgain,
  onSwitchColor,
  onAddToRepertoire,
  onOpenInRepertoire,
}: GameSummaryProps) {
  return (
    <>
      {/* Game summary (shown when eval is done) */}
      {stats && (
        <div className="rounded-xl border border-primary/10 bg-bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {stats.counts.best > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-cyan-600 font-medium">{stats.counts.best}</span> best
              </span>
            )}
            {stats.counts.excellent > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="text-success font-medium">{stats.counts.excellent}</span> excellent
              </span>
            )}
            {stats.counts.good > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success/60" />
                <span className="text-success font-medium">{stats.counts.good}</span> good
              </span>
            )}
            {stats.counts.inaccuracy > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-warning font-medium">{stats.counts.inaccuracy}</span> inaccuracy
              </span>
            )}
            {stats.counts.mistake > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-orange-500 font-medium">{stats.counts.mistake}</span> mistake
              </span>
            )}
            {stats.counts.blunder > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-danger" />
                <span className="text-danger font-medium">{stats.counts.blunder}</span> blunder
              </span>
            )}
          </div>
        </div>
      )}

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
        {hasMatchedRepertoire && showAddToRepertoire && (
          <button onClick={onAddToRepertoire} className={btnClass}>
            <Plus className="w-3.5 h-3.5" />
            Add to Repertoire
          </button>
        )}
        {hasMatchedRepertoire && showOpenInRepertoire && (
          <button onClick={onOpenInRepertoire} className={btnClass}>
            <BookOpen className="w-3.5 h-3.5" />
            Open in Repertoire
          </button>
        )}
      </div>
    </>
  );
}
