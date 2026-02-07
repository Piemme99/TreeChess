import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import type { RepertoireStats } from '../../../types';

interface RepertoireHealthProps {
  repertoires: RepertoireStats[];
}

function coverageColor(pct: number): string {
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-warning';
  return 'bg-danger';
}

function HealthCard({ rep, index }: { rep: RepertoireStats; index: number }) {
  const isWhite = rep.color === 'white';
  const winPct = Math.round(rep.winRate * 100);
  const inRepPct = Math.round(rep.winRateInRep * 100);
  const outRepPct = Math.round(rep.winRateOutRep * 100);
  const coverage = Math.round(rep.coveragePercent);

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="bg-bg-card border border-primary/10 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none">{isWhite ? '\u2654' : '\u265A'}</span>
          <span className="font-semibold text-sm text-text truncate">{rep.repertoireName}</span>
        </div>
        <span className="text-xs text-text-muted shrink-0">
          {rep.gameCount} game{rep.gameCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Coverage bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
          <span>Coverage</span>
          <span>{coverage}%</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${coverageColor(coverage)}`}
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>

      {/* Mini stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-text font-display">{winPct}%</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Win Rate</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-success font-display">{rep.inRepCount > 0 ? `${inRepPct}%` : '—'}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">In-Rep</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-danger font-display">{rep.outRepCount > 0 ? `${outRepPct}%` : '—'}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Out-Rep</p>
        </div>
      </div>
    </motion.div>
  );
}

export function RepertoireHealth({ repertoires }: RepertoireHealthProps) {
  if (repertoires.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Repertoire Health</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {repertoires.map((rep, i) => (
          <HealthCard key={rep.repertoireId} rep={rep} index={i} />
        ))}
      </div>
    </section>
  );
}
