import { motion } from 'framer-motion';
import { Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import { fadeUp } from '../../../shared/utils/animations';

interface TrainingCompleteProps {
  totalLines: number;
  totalMistakes: number;
  feedbackMessage: string | null;
  onTrainAgain: () => void;
  onChooseAnother: () => void;
}

export function TrainingComplete({
  totalLines,
  totalMistakes,
  feedbackMessage,
  onTrainAgain,
  onChooseAnother,
}: TrainingCompleteProps) {
  const accuracy =
    totalLines > 0
      ? Math.round((totalLines / (totalLines + totalMistakes)) * 100)
      : 0;

  // Edge case: empty repertoire
  if (totalLines === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <motion.p variants={fadeUp} initial="hidden" animate="visible" className="text-text-muted mb-6">
          {feedbackMessage || 'No lines to train in this repertoire.'}
        </motion.p>
        <motion.button
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          onClick={onChooseAnother}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-150 cursor-pointer border-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Choose Another
        </motion.button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold font-display text-text mb-1">Training Complete!</h2>
        <p className="text-text-muted text-sm">Great work on your repertoire practice.</p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-2xl border border-primary/10 bg-bg-card">
          <div className="text-2xl font-bold text-text">{totalLines}</div>
          <div className="text-xs text-text-muted mt-0.5">Lines</div>
        </div>
        <div className="p-4 rounded-2xl border border-primary/10 bg-bg-card">
          <div className="text-2xl font-bold text-text">{totalMistakes}</div>
          <div className="text-xs text-text-muted mt-0.5">Mistakes</div>
        </div>
        <div className="p-4 rounded-2xl border border-primary/10 bg-bg-card">
          <div className="text-2xl font-bold text-text">{accuracy}%</div>
          <div className="text-xs text-text-muted mt-0.5">Accuracy</div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="flex items-center justify-center gap-3">
        <button
          onClick={onTrainAgain}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-150 cursor-pointer border-0"
        >
          <RotateCcw className="w-4 h-4" />
          Train Again
        </button>
        <button
          onClick={onChooseAnother}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/10 bg-bg-card text-text font-medium hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Choose Another
        </button>
      </motion.div>
    </div>
  );
}
