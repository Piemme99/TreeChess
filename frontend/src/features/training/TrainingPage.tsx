import { motion } from 'framer-motion';
import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { Loading } from '../../shared/components/UI';
import { RepertoireSelector } from './components/RepertoireSelector';
import { TrainingBoard } from './components/TrainingBoard';
import { TrainingComplete } from './components/TrainingComplete';
import { useTrainingSession } from './hooks/useTrainingSession';

export function TrainingPage() {
  usePageTitle('Training');
  const { repertoires, loading } = useRepertoires();
  const {
    phase, fen, lastMove, orientation, feedbackMessage,
    totalMistakes, currentLineIndex, totalLines, isInteractive,
    startSession, handleUserMove, reset,
  } = useTrainingSession();

  if (loading && repertoires.length === 0) {
    return <Loading size="lg" text="Loading repertoires..." />;
  }

  if (phase === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <RepertoireSelector repertoires={repertoires} onSelect={startSession} />
      </motion.div>
    );
  }

  if (phase === 'session_complete') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <TrainingComplete
          totalLines={totalLines}
          totalMistakes={totalMistakes}
          feedbackMessage={feedbackMessage}
          onTrainAgain={reset}
          onChooseAnother={reset}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <TrainingBoard
        fen={fen}
        orientation={orientation}
        interactive={isInteractive}
        lastMove={lastMove}
        feedbackMessage={feedbackMessage}
        phase={phase}
        currentLineIndex={currentLineIndex}
        totalLines={totalLines}
        totalMistakes={totalMistakes}
        onMove={handleUserMove}
        onBack={reset}
      />
    </motion.div>
  );
}
