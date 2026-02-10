import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import { ColorDot } from '../../../shared/components/UI';
import type { OpponentGap } from '../../../types';

interface OpponentGapsProps {
  gaps: OpponentGap[];
}

function winRateColor(rate: number): string {
  if (rate >= 0.6) return 'text-success';
  if (rate >= 0.4) return 'text-warning';
  return 'text-danger';
}

function GapCard({ gap, index }: { gap: OpponentGap; index: number }) {
  const navigate = useNavigate();
  const winPct = Math.round(gap.winRate * 100);

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="bg-bg-card border border-primary/10 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ColorDot color={gap.color} size="sm" />
          <span className="text-xs text-text-muted truncate">{gap.repertoireName}</span>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
          {gap.frequency}x
        </span>
      </div>

      <div className="mb-3">
        <p className="text-sm text-text-muted">
          {gap.contextMove && (
            <span>After <span className="font-medium text-text">{gap.moveNumber > 1 ? `${gap.moveNumber - 1}. ` : ''}{gap.contextMove}</span>, </span>
          )}
          opponent plays
        </p>
        <p className="text-lg font-semibold text-text font-display mt-0.5">
          {gap.moveNumber}. {gap.opponentMove}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className={winRateColor(gap.winRate)}>
            {winPct}% win rate
          </span>
          <span>{gap.wins}W / {gap.draws}D / {gap.losses}L</span>
        </div>

        <button
          onClick={() => navigate(`/repertoire/${gap.repertoireId}/edit`)}
          className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
        >
          View in repertoire
        </button>
      </div>
    </motion.div>
  );
}

export function OpponentGaps({ gaps }: OpponentGapsProps) {
  if (gaps.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Unprepared Lines</h2>
      <p className="text-xs text-text-muted mb-3">
        Frequent opponent moves not in your repertoire
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {gaps.map((gap, i) => (
          <GapCard key={`${gap.fen}-${gap.opponentMove}-${gap.repertoireId}`} gap={gap} index={i} />
        ))}
      </div>
    </section>
  );
}
