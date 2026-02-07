import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '../../../shared/utils/animations';
import type { Repertoire } from '../../../types';

interface RepertoireOverviewProps {
  repertoires: Repertoire[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RepertoireCard({ repertoire, index }: { repertoire: Repertoire; index: number }) {
  const navigate = useNavigate();
  const isWhite = repertoire.color === 'white';

  return (
    <motion.button
      variants={fadeUp}
      custom={index}
      whileHover={{ scale: 1.04, boxShadow: '0 12px 24px -8px rgba(230,126,34,0.2)' }}
      whileTap={{ scale: 0.97 }}
      className="flex-shrink-0 w-48 bg-bg-card border border-primary/10 rounded-2xl p-4 cursor-pointer transition-colors duration-150 text-left font-sans hover:border-primary/30 group"
      onClick={() => navigate(`/repertoire/${repertoire.id}/edit`)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl leading-none">{isWhite ? '\u2654' : '\u265A'}</span>
        <span className="font-semibold text-sm text-text truncate">{repertoire.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{repertoire.metadata.totalMoves} moves</span>
        <span>{formatDate(repertoire.updatedAt)}</span>
      </div>
    </motion.button>
  );
}

function AddRepertoireCard() {
  const navigate = useNavigate();

  return (
    <button
      className="flex-shrink-0 w-48 bg-bg-card border border-dashed border-primary/30 rounded-2xl p-4 cursor-pointer transition-all duration-150 font-sans hover:border-primary hover:bg-primary-light flex flex-col items-center justify-center gap-2"
      onClick={() => navigate('/repertoires')}
    >
      <span className="text-2xl text-text-muted leading-none">+</span>
      <span className="text-sm text-text-muted font-medium">New Repertoire</span>
    </button>
  );
}

export function RepertoireOverview({ repertoires }: RepertoireOverviewProps) {
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="visible">
      <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Your Repertoires</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {repertoires.map((rep, i) => (
          <RepertoireCard key={rep.id} repertoire={rep} index={i} />
        ))}
        <AddRepertoireCard />
      </div>
    </motion.section>
  );
}
