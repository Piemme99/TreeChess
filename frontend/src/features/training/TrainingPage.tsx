import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { Loading } from '../../shared/components/UI';
import { ModeSelector } from './components/ModeSelector';
import { RepertoireSelector } from './components/RepertoireSelector';
import { TrainingBoard } from './components/TrainingBoard';
import { TrainingComplete } from './components/TrainingComplete';
import { ExplorerTrainingBoard } from './components/ExplorerTrainingBoard';
import { ExplorerTrainingReview } from './components/ExplorerTrainingReview';
import { useTrainingSession } from './hooks/useTrainingSession';
import { useExplorerTraining } from './hooks/useExplorerTraining';
import { useRepertoireComparison } from './hooks/useRepertoireComparison';
import type { Repertoire } from '../../types';

type Mode = 'none' | 'repertoire' | 'explorer';

export function TrainingPage() {
  usePageTitle('Training');
  const { repertoires, loading } = useRepertoires();

  const [mode, setMode] = useState<Mode>('none');

  const training = useTrainingSession();
  const explorer = useExplorerTraining();

  // Repertoire comparison — runs when explorer session completes
  const comparison = useRepertoireComparison(
    explorer.moveHistory,
    explorer.orientation === 'white' ? 'w' : 'b',
    explorer.phase === 'session_complete',
  );

  const backToModes = useCallback(() => {
    training.reset();
    explorer.reset();
    setMode('none');
  }, [training, explorer]);

  const handleSelectRepertoire = useCallback((repertoire: Repertoire, lineCount: number) => {
    training.startSession(repertoire, lineCount);
  }, [training]);

  const handleSelectExplorer = useCallback(() => {
    explorer.startSession('w');
    setMode('explorer');
  }, [explorer]);

  const handleExplorerTryAgain = useCallback(() => {
    const currentColor = explorer.orientation === 'white' ? 'w' as const : 'b' as const;
    explorer.reset();
    explorer.startSession(currentColor);
  }, [explorer]);

  const handleExplorerSwitchColor = useCallback(() => {
    const newColor = explorer.orientation === 'white' ? 'b' as const : 'w' as const;
    explorer.reset();
    explorer.startSession(newColor);
  }, [explorer]);

  if (loading && repertoires.length === 0) {
    return <Loading size="lg" text="Loading repertoires..." />;
  }

  // Mode selector
  if (mode === 'none') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <ModeSelector
          onSelectRepertoire={() => setMode('repertoire')}
          onSelectExplorer={handleSelectExplorer}
        />
      </motion.div>
    );
  }

  // --- Repertoire Training ---
  if (mode === 'repertoire') {
    if (training.phase === 'idle') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <RepertoireSelector repertoires={repertoires} onSelect={handleSelectRepertoire} />
        </motion.div>
      );
    }

    if (training.phase === 'session_complete') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <TrainingComplete
            totalLines={training.totalLines}
            totalMistakes={training.totalMistakes}
            feedbackMessage={training.feedbackMessage}
            onTrainAgain={training.restartSession}
            onChooseAnother={training.reset}
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
          fen={training.fen}
          orientation={training.orientation}
          interactive={training.isInteractive}
          lastMove={training.lastMove}
          correctMoveArrow={training.correctMoveArrow}
          feedbackMessage={training.feedbackMessage}
          phase={training.phase}
          completedLines={training.completedLines}
          totalLines={training.totalLines}
          totalMistakes={training.totalMistakes}
          boardKey={training.boardKey}
          onMove={training.handleUserMove}
          onBack={backToModes}
        />
      </motion.div>
    );
  }

  // --- Explorer Training ---
  if (explorer.phase === 'session_complete') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <ExplorerTrainingReview
          moveHistory={explorer.moveHistory}
          orientation={explorer.orientation}
          userColor={explorer.orientation === 'white' ? 'w' : 'b'}
          errorMessage={explorer.errorMessage}
          finalWinRate={explorer.finalWinRate}
          finalVerdict={explorer.finalVerdict}
          repertoireComparison={comparison}
          onTryAgain={handleExplorerTryAgain}
          onSwitchColor={handleExplorerSwitchColor}
          onBackToModes={backToModes}
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
      <ExplorerTrainingBoard
        fen={explorer.fen}
        orientation={explorer.orientation}
        interactive={explorer.isInteractive}
        lastMove={explorer.lastMove}
        moveCount={explorer.moveCount}
        onMove={explorer.handleUserMove}
        onSwitchColor={handleExplorerSwitchColor}
        onBack={backToModes}
      />
    </motion.div>
  );
}
