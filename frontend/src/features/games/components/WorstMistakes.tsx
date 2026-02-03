import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OpeningMistake } from '../../../types';

interface WorstMistakesProps {
  mistakes: OpeningMistake[];
  engineAnalysisDone: boolean;
  engineAnalysisTotal: number;
  engineAnalysisCompleted: number;
  onDismiss?: (fen: string, playedMove: string) => void;
}

function SeverityIndicator({ winrateDrop }: { winrateDrop: number }) {
  const pct = winrateDrop * 100;
  const level = pct >= 10 ? 'high' : pct >= 5 ? 'medium' : 'low';
  const styles = {
    high: 'bg-danger-light text-danger',
    medium: 'bg-warning-light text-warning',
    low: 'bg-info-light text-info',
  };
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

interface MistakeCardProps {
  mistake: OpeningMistake;
  onDismiss?: (fen: string, playedMove: string) => void;
}

function MistakeCard({ mistake, onDismiss }: MistakeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const dropPct = (mistake.winrateDrop * 100).toFixed(1);

  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-text">
              <span className="text-danger font-semibold">{mistake.playedMove}</span>
            </span>
            <span className="font-mono text-sm text-text-muted">
              (best <span className="text-success font-semibold">{mistake.bestMove}</span>)
            </span>
            <span className="text-xs text-text-muted">
              -{dropPct}% winrate
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-bg text-text-muted border border-border">
            {mistake.frequency} game{mistake.frequency > 1 ? 's' : ''}
          </span>
          <SeverityIndicator winrateDrop={mistake.winrateDrop} />
          {onDismiss && (
            <button
              className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer bg-transparent border-none p-1"
              onClick={() => onDismiss(mistake.fen, mistake.playedMove)}
              title="Dismiss this mistake"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {mistake.games.length > 0 && (
        <div>
          <button
            className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide games' : `Show ${mistake.games.length} game${mistake.games.length > 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {mistake.games.map((ref) => (
                <button
                  key={`${ref.analysisId}-${ref.gameIndex}`}
                  className="w-full text-left text-sm px-3 py-1.5 rounded bg-bg hover:bg-border transition-colors cursor-pointer border-none"
                  onClick={() => navigate(`/analyse/${ref.analysisId}/game/${ref.gameIndex}?ply=${ref.plyNumber}`)}
                >
                  <span className="text-text">{ref.white} vs {ref.black}</span>
                  <span className="text-text-muted ml-2">{ref.result}</span>
                  {ref.date && <span className="text-text-muted ml-2">{ref.date}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorstMistakes({ mistakes, engineAnalysisDone, engineAnalysisTotal, engineAnalysisCompleted, onDismiss }: WorstMistakesProps) {
  if (mistakes.length === 0 && engineAnalysisDone) return null;

  const progressPct = engineAnalysisTotal > 0 ? Math.round((engineAnalysisCompleted / engineAnalysisTotal) * 100) : 0;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold">Worst Opening Mistakes</h3>
        {!engineAnalysisDone && engineAnalysisTotal > 0 && (
          <span className="text-xs text-text-muted flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {engineAnalysisCompleted}/{engineAnalysisTotal} games analyzed
          </span>
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
        <div className="space-y-3">
          {mistakes.map((mistake, i) => (
            <MistakeCard key={`${mistake.fen}-${mistake.playedMove}-${i}`} mistake={mistake} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </section>
  );
}
