import type { DashboardStatsResponse } from '../../../types';

interface StatsSummaryProps {
  stats: DashboardStatsResponse;
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-bg-card border border-primary/10 rounded-2xl p-4">
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text font-display">{value}</p>
      {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
    </div>
  );
}

function errorRateColor(pct: number): string {
  if (pct <= 15) return 'text-success';
  if (pct <= 30) return 'text-warning';
  return 'text-danger';
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  const winRatePct = Math.round(stats.overallWinRate * 100);
  const coveragePct = Math.round(stats.overallCoverage * 100);
  const errorPct = Math.round(stats.openingErrorRate * 100);

  return (
    <div className="flex flex-wrap gap-4">
      <StatCard
        label="Total Games"
        value={String(stats.totalGames)}
        subtext={`${stats.wins}W / ${stats.draws}D / ${stats.losses}L`}
      />
      <StatCard
        label="Win Rate"
        value={`${winRatePct}%`}
      />
      <StatCard
        label="Repertoire Coverage"
        value={`${coveragePct}%`}
        subtext={`${stats.inRepCount} in-rep / ${stats.outRepCount} out`}
      />
      <div className="flex-1 min-w-[140px] bg-bg-card border border-primary/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Opening Errors</p>
        <p className={`text-2xl font-semibold font-display ${stats.matchedGamesCount > 0 ? errorRateColor(errorPct) : 'text-text-muted'}`}>
          {stats.matchedGamesCount > 0 ? `${errorPct}%` : '\u2014'}
        </p>
        {stats.matchedGamesCount > 0 && (
          <p className="text-xs text-text-muted mt-1">
            {stats.openingErrorCount} error{stats.openingErrorCount !== 1 ? 's' : ''} in {stats.matchedGamesCount} game{stats.matchedGamesCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
