import { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { ArrowLeft, Check } from 'lucide-react';

interface TrainingBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  interactive: boolean;
  lastMove: { from: string; to: string } | null;
  correctMoveArrow: { from: string; to: string } | null;
  feedbackMessage: string | null;
  phase: string;
  completedLines: number;
  totalLines: number;
  totalMistakes: number;
  boardKey: number;
  onMove: (san: string, from: string, to: string) => void;
  onBack: () => void;
}

export function TrainingBoard({
  fen,
  orientation,
  interactive,
  lastMove,
  correctMoveArrow,
  feedbackMessage,
  phase,
  completedLines,
  totalLines,
  totalMistakes,
  boardKey,
  onMove,
  onBack,
}: TrainingBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setBoardSize(Math.min(width - 16, 560));
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMove = useCallback(
    (move: { from: string; to: string; san: string }) => {
      onMove(move.san, move.from, move.to);
    },
    [onMove]
  );

  const displayedCompleted = phase === 'line_complete'
    ? completedLines + 1
    : completedLines;
  const progressPercent = totalLines > 0 ? (displayedCompleted / totalLines) * 100 : 0;

  const isLineComplete = phase === 'line_complete';
  const isWrongMove = phase === 'wrong_move';
  const isRetryMove = phase === 'retry_move';

  const arrows: [string, string, string?][] = isWrongMove && correctMoveArrow
    ? [[correctMoveArrow.from, correctMoveArrow.to, 'rgb(220, 38, 38)']]
    : [];

  const feedbackColor =
    isWrongMove
      ? 'bg-danger/10 text-danger border-danger/20'
      : isRetryMove
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        : phase === 'line_complete'
          ? 'bg-success/10 text-success border-success/20'
          : 'bg-primary/10 text-primary border-primary/20';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer"
          title="Back to selection"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span>
              Line {Math.min(completedLines + 1, totalLines)} / {totalLines}
            </span>
            <span className="text-text-muted/40">|</span>
            <span>
              {totalMistakes} mistake{totalMistakes !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-primary/10 mb-4 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Board with overlay */}
      <div ref={containerRef} className="relative flex justify-center mb-4">
        <ChessBoard
          key={boardKey}
          fen={fen}
          onMove={handleMove}
          interactive={interactive}
          orientation={orientation}
          lastMove={lastMove}
          customArrows={arrows}
          width={boardSize}
        />

        {/* Line complete overlay */}
        <AnimatePresence>
          {isLineComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 10 }}
            >
              <div className="absolute inset-0 bg-black/20 rounded-sm" />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="relative flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center shadow-lg shadow-success/30">
                  <Check className="w-9 h-9 text-white" strokeWidth={3} />
                </div>
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-white font-bold text-lg drop-shadow-md"
                >
                  Line complete!
                </motion.span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feedback messages */}
      <AnimatePresence mode="wait">
        {feedbackMessage && !isLineComplete && (
          <motion.div
            key={`${phase}-${feedbackMessage}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`text-center py-2.5 px-4 rounded-xl border text-sm font-medium ${feedbackColor}`}
          >
            {feedbackMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
