import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import type { InsightsResponse } from '../../../types';

interface WeakSpotsProps {
  insights: InsightsResponse;
}

export function WeakSpots({ insights }: WeakSpotsProps) {
  const navigate = useNavigate();
  const mistakes = insights.worstMistakes.slice(0, 3);
  const { engineAnalysisDone, engineAnalysisTotal, engineAnalysisCompleted } = insights;
  const progressPct = engineAnalysisTotal > 0 ? Math.round((engineAnalysisCompleted / engineAnalysisTotal) * 100) : 0;

  if (mistakes.length === 0 && engineAnalysisDone) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Weak Spots</h2>
          {!engineAnalysisDone && engineAnalysisTotal > 0 && (
            <span className="text-xs text-text-muted flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              {engineAnalysisCompleted}/{engineAnalysisTotal} analyzed
            </span>
          )}
        </div>
        {mistakes.length > 0 && (
          <button
            className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
            onClick={() => navigate('/games')}
          >
            View all
          </button>
        )}
      </div>

      {!engineAnalysisDone && engineAnalysisTotal > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {mistakes.length === 0 ? (
        <p className="text-sm text-text-muted">
          {engineAnalysisDone ? 'No significant opening mistakes found.' : 'Engine analysis in progress...'}
        </p>
      ) : (
        <div className="space-y-2">
          {mistakes.map((mistake, i) => {
            const dropPct = (mistake.winrateDrop * 100).toFixed(1);
            const severityLevel = mistake.winrateDrop * 100 >= 10 ? 'high' : mistake.winrateDrop * 100 >= 5 ? 'medium' : 'low';
            const severityStyles = {
              high: 'bg-danger-light text-danger',
              medium: 'bg-warning-light text-warning',
              low: 'bg-info-light text-info',
            };
            const firstGame = mistake.games[0];

            return (
              <motion.button
                key={`${mistake.fen}-${mistake.playedMove}`}
                variants={fadeUp}
                custom={i}
                className="w-full bg-bg-card border border-primary/10 rounded-2xl px-4 py-3 cursor-pointer transition-colors hover:border-primary/30 text-left font-sans"
                onClick={() => {
                  if (firstGame) {
                    navigate(`/analyse/${firstGame.analysisId}/game/${firstGame.gameIndex}?ply=${firstGame.plyNumber}`);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm">
                      <span className="text-danger font-semibold">{mistake.playedMove}</span>
                      <span className="text-text-muted mx-1">→</span>
                      <span className="text-success font-semibold">{mistake.bestMove}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-bg text-text-muted border border-primary/10">
                      {mistake.frequency}x
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityStyles[severityLevel]}`}>
                      -{dropPct}%
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
