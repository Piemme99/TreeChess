import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft, Palette } from 'lucide-react';
import { fadeUp } from '../../../shared/utils/animations';
import type { MoveRecord } from '../hooks/useExplorerTraining';

interface ExplorerTrainingCompleteProps {
  finalWinRate: number | null;
  finalVerdict: string | null;
  errorMessage: string | null;
  moveHistory: MoveRecord[];
  onTryAgain: () => void;
  onChangeColor: () => void;
  onBackToModes: () => void;
}

function getWinRateColor(winRate: number): string {
  if (winRate >= 55) return 'text-success';
  if (winRate >= 48) return 'text-primary';
  if (winRate >= 40) return 'text-amber-500';
  return 'text-danger';
}

function getPopularityBadge(popularity: number | null): { label: string; className: string } {
  if (popularity === null) {
    return { label: 'Novelty', className: 'bg-gray-100 text-gray-500' };
  }
  if (popularity > 30) {
    return { label: `${popularity.toFixed(0)}%`, className: 'bg-success/10 text-success' };
  }
  if (popularity >= 5) {
    return { label: `${popularity.toFixed(0)}%`, className: 'bg-amber-100 text-amber-600' };
  }
  return { label: `${popularity.toFixed(0)}%`, className: 'bg-danger/10 text-danger' };
}

export function ExplorerTrainingComplete({
  finalWinRate,
  finalVerdict,
  errorMessage,
  moveHistory,
  onTryAgain,
  onChangeColor,
  onBackToModes,
}: ExplorerTrainingCompleteProps) {
  // Error state
  if (errorMessage) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <motion.p variants={fadeUp} initial="hidden" animate="visible" className="text-text-muted mb-6">
          {errorMessage}
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="flex items-center justify-center gap-3">
          <button
            onClick={onTryAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-150 cursor-pointer border-0"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={onBackToModes}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-text font-medium hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </motion.div>
      </div>
    );
  }

  const winRate = finalWinRate ?? 50;
  const winRateColor = getWinRateColor(winRate);

  // Split moves into pairs for display
  const movePairs: { number: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1],
    });
  }

  return (
    <div className="max-w-md mx-auto text-center py-12">
      {/* Win rate display */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
        <div className={`text-5xl font-bold font-display ${winRateColor} mb-2`}>
          {winRate.toFixed(0)}%
        </div>
        <div className="text-sm text-text-muted mb-1">Expected score</div>
        <div className="text-lg font-semibold font-display text-text">
          {finalVerdict}
        </div>
      </motion.div>

      {/* Move history */}
      {movePairs.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="mb-8">
          <div className="rounded-2xl border border-primary/10 bg-bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-primary/10">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Move History</span>
            </div>
            <div className="divide-y divide-primary/5">
              {movePairs.map((pair) => (
                <div key={pair.number} className="flex items-center px-4 py-2 text-sm">
                  <span className="w-8 text-text-muted text-xs">{pair.number}.</span>
                  {pair.white && (
                    <MoveCell move={pair.white} />
                  )}
                  {pair.black && (
                    <MoveCell move={pair.black} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onTryAgain}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-150 cursor-pointer border-0"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
        <button
          onClick={onChangeColor}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-text font-medium hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <Palette className="w-4 h-4" />
          Change Color
        </button>
        <button
          onClick={onBackToModes}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-text font-medium hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Modes
        </button>
      </motion.div>
    </div>
  );
}

function MoveCell({ move }: { move: MoveRecord }) {
  const badge = getPopularityBadge(move.popularity);
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className={`font-medium ${move.isUser ? 'text-text' : 'text-text-muted'}`}>
        {move.san}
      </span>
      <span className={`text-xs px-1.5 py-0.5 rounded-md ${badge.className}`}>
        {badge.label}
      </span>
    </div>
  );
}
