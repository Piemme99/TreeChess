import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import type { DashboardStatsResponse } from '../../../types';

interface StatsSummaryProps {
  stats: DashboardStatsResponse;
}

function StatCard({ label, value, subtext, index }: { label: string; value: string; subtext?: string; index: number }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="flex-1 min-w-[140px] bg-bg-card border border-primary/10 rounded-2xl p-4"
    >
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text font-display">{value}</p>
      {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
    </motion.div>
  );
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  const winRatePct = Math.round(stats.overallWinRate * 100);
  const coveragePct = Math.round(stats.overallCoverage * 100);
  const liftPct = Math.round((stats.winRateInRep - stats.winRateOutRep) * 100);
  const inRepPct = Math.round(stats.winRateInRep * 100);
  const outRepPct = Math.round(stats.winRateOutRep * 100);

  const liftSign = liftPct > 0 ? '+' : '';
  const liftColor = liftPct > 0 ? 'text-success' : liftPct < 0 ? 'text-danger' : 'text-text-muted';

  return (
    <div className="flex flex-wrap gap-4">
      <StatCard
        label="Total Games"
        value={String(stats.totalGames)}
        subtext={`${stats.wins}W / ${stats.draws}D / ${stats.losses}L`}
        index={0}
      />
      <StatCard
        label="Win Rate"
        value={`${winRatePct}%`}
        index={1}
      />
      <StatCard
        label="Repertoire Coverage"
        value={`${coveragePct}%`}
        subtext={`${stats.inRepCount} in-rep / ${stats.outRepCount} out`}
        index={2}
      />
      <motion.div
        variants={fadeUp}
        custom={3}
        className="flex-1 min-w-[140px] bg-bg-card border border-primary/10 rounded-2xl p-4"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Win Rate Lift</p>
        <p className={`text-2xl font-semibold font-display ${liftColor}`}>
          {stats.inRepCount > 0 || stats.outRepCount > 0 ? `${liftSign}${liftPct}%` : '—'}
        </p>
        {(stats.inRepCount > 0 || stats.outRepCount > 0) && (
          <p className="text-xs text-text-muted mt-1">
            {inRepPct}% in-rep vs {outRepPct}% out
          </p>
        )}
      </motion.div>
    </div>
  );
}
