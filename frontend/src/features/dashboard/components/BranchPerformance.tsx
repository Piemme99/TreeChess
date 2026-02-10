import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import { ColorDot } from '../../../shared/components/UI';
import type { BranchStats } from '../../../types';

interface BranchPerformanceProps {
  branches: BranchStats[];
}

function winRateBarColor(rate: number): string {
  if (rate >= 0.6) return 'bg-success';
  if (rate >= 0.4) return 'bg-warning';
  return 'bg-danger';
}

function errorRateColor(rate: number): string {
  if (rate <= 0.15) return 'text-success';
  if (rate <= 0.30) return 'text-warning';
  return 'text-danger';
}

export function BranchPerformance({ branches }: BranchPerformanceProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (branches.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Line Performance</h2>
      <p className="text-xs text-text-muted mb-3">
        Results by named repertoire branch
      </p>
      <motion.div
        variants={fadeUp}
        custom={0}
        className="bg-bg-card border border-primary/10 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_100px_70px] gap-2 px-4 py-2.5 border-b border-primary/10 text-[10px] font-bold text-text-muted uppercase tracking-wider">
          <span>Line</span>
          <span className="text-center">Games</span>
          <span className="text-center">Win Rate</span>
          <span className="text-center">Errors</span>
        </div>

        {/* Rows */}
        {branches.map((branch) => {
          const winPct = Math.round(branch.winRate * 100);
          const errPct = Math.round(branch.errorRate * 100);

          return (
            <div
              key={`${branch.branchName}-${branch.repertoireId}`}
              className="grid grid-cols-[1fr_60px_100px_70px] gap-2 px-4 py-3 border-b border-primary/5 last:border-b-0 hover:bg-primary/5 cursor-pointer transition-colors items-center"
              onClick={() => navigate(`/repertoire/${branch.repertoireId}/edit`, { state: { from: location.pathname } })}
            >
              {/* Branch name + repertoire */}
              <div className="flex items-center gap-2 min-w-0">
                <ColorDot color={branch.color} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{branch.branchName}</p>
                  <p className="text-[10px] text-text-muted truncate">{branch.repertoireName}</p>
                </div>
              </div>

              {/* Game count */}
              <span className="text-sm text-text text-center font-medium">{branch.gameCount}</span>

              {/* Win rate bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${winRateBarColor(branch.winRate)}`}
                    style={{ width: `${winPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text w-8 text-right">{winPct}%</span>
              </div>

              {/* Error rate */}
              <span className={`text-sm text-center font-medium ${errorRateColor(branch.errorRate)}`}>
                {errPct}%
                {branch.errorCount > 0 && (
                  <span className="text-[10px] text-text-muted block">{branch.errorCount}x</span>
                )}
              </span>
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
