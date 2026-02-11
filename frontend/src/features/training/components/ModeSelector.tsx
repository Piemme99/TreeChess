import { motion } from 'framer-motion';
import { BookOpen, Globe } from 'lucide-react';
import { fadeUp, staggerContainer } from '../../../shared/utils/animations';

interface ModeSelectorProps {
  onSelectRepertoire: () => void;
  onSelectExplorer: () => void;
}

export function ModeSelector({ onSelectRepertoire, onSelectExplorer }: ModeSelectorProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto"
    >
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold font-display text-text mb-2">Training</h1>
        <p className="text-text-muted text-sm">
          Choose a training mode to sharpen your opening skills.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.button
          variants={fadeUp}
          onClick={onSelectRepertoire}
          className="text-left p-6 rounded-2xl border border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="font-semibold text-text mb-1">Repertoire Training</div>
          <div className="text-sm text-text-muted">
            Practice your repertoire lines. The computer plays your opponent's moves and you find the correct responses.
          </div>
        </motion.button>

        <motion.button
          variants={fadeUp}
          onClick={onSelectExplorer}
          className="text-left p-6 rounded-2xl border border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="font-semibold text-text mb-1">Explorer Training</div>
          <div className="text-sm text-text-muted">
            Play freely against the most popular moves from real games. See how well you navigate the opening.
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
