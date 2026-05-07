import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { Loading } from '../../shared/components/UI';
import { RepertoireSelector } from './components/RepertoireSelector';
import { TrainingBoard } from './components/TrainingBoard';
import { TrainingComplete } from './components/TrainingComplete';
import { ExplorerTrainingBoard } from './components/ExplorerTrainingBoard';
import { ExplorerTrainingReview } from './components/ExplorerTrainingReview';
import { TrainingLichessGate } from './components/TrainingLichessGate';
import { useTrainingSession } from './hooks/useTrainingSession';
import { useExplorerTraining } from './hooks/useExplorerTraining';
import { useRepertoireComparison } from './hooks/useRepertoireComparison';
import { useAuthStore } from '../../stores/authStore';
import type { Repertoire } from '../../types';

type Mode = 'repertoire' | 'explorer';

export function TrainingPage() {
  usePageTitle('Training');
  const user = useAuthStore((s) => s.user);
  const { repertoires, loading } = useRepertoires();

  const [mode, setMode] = useState<Mode>('explorer');

  const training = useTrainingSession();
  const explorer = useExplorerTraining();
  const explorerStarted = useRef(false);

  // Auto-start explorer session on mount
  useEffect(() => {
    if (!explorerStarted.current && explorer.phase === 'idle') {
      explorerStarted.current = true;
      explorer.startSession('w');
    }
  }, [explorer]);

  // Repertoire comparison — runs when explorer session completes
  const comparison = useRepertoireComparison(
    explorer.moveHistory,
    explorer.orientation === 'white' ? 'w' : 'b',
    explorer.phase === 'session_complete',
  );

  const backToExplorer = useCallback(() => {
    training.reset();
    explorer.reset();
    explorer.startSession('w');
    setMode('explorer');
  }, [training, explorer]);

  const handleSelectRepertoire = useCallback((repertoire: Repertoire, lineCount: number) => {
    training.startSession(repertoire, lineCount);
  }, [training]);

  const handleSwitchToRepertoire = useCallback(() => {
    explorer.reset();
    setMode('repertoire');
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

  // Training is gated behind a Lichess link: every cache miss has to be paid
  // for by the requesting user's own Lichess token, so unlinked accounts can't
  // enter Training at all (even the repertoire-only mode).
  if (user && !user.lichessLinked) {
    return <TrainingLichessGate />;
  }

  if (loading && repertoires.length === 0) {
    return <Loading size="lg" text="Loading repertoires..." />;
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
          <RepertoireSelector repertoires={repertoires} onSelect={handleSelectRepertoire} onBack={backToExplorer} />
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
            onChooseAnother={backToExplorer}
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
          onBack={backToExplorer}
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
          onBackToModes={backToExplorer}
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
        onRepertoireTraining={handleSwitchToRepertoire}
      />
    </motion.div>
  );
}
