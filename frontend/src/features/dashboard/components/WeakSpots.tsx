import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { motion } from 'framer-motion';
import { fadeUp } from '../../../shared/utils/animations';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { ensureFullFEN } from '../../../shared/utils/chess';
import type { InsightsResponse, OpeningMistake } from '../../../types';

interface WeakSpotsProps {
  insights: InsightsResponse;
}

function moveToArrows(fen: string, playedMove: string, bestMove: string): [string, string, string][] {
  const arrows: [string, string, string][] = [];
  try {
    const chess = new Chess(ensureFullFEN(fen));
    const played = chess.move(playedMove);
    if (played) {
      arrows.push([played.from, played.to, 'rgba(220, 53, 69, 0.8)']);
    }
  } catch { /* ignore */ }
  try {
    const chess = new Chess(ensureFullFEN(fen));
    const best = chess.move(bestMove);
    if (best) {
      arrows.push([best.from, best.to, 'rgba(40, 167, 69, 0.8)']);
    }
  } catch { /* ignore */ }
  return arrows;
}

function orientationFromFen(fen: string): 'white' | 'black' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'black' : 'white';
}

function MistakeCard({ mistake, index }: { mistake: OpeningMistake; index: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dropPct = (mistake.winrateDrop * 100).toFixed(1);
  const severityLevel = mistake.winrateDrop * 100 >= 10 ? 'high' : mistake.winrateDrop * 100 >= 5 ? 'medium' : 'low';
  const severityStyles = {
    high: 'bg-danger-light text-danger',
    medium: 'bg-warning-light text-warning',
    low: 'bg-info-light text-info',
  };
  const firstGame = mistake.games[0];
  const arrows = useMemo(
    () => moveToArrows(mistake.fen, mistake.playedMove, mistake.bestMove),
    [mistake.fen, mistake.playedMove, mistake.bestMove]
  );
  const orientation = useMemo(() => orientationFromFen(mistake.fen), [mistake.fen]);

  return (
    <motion.button
      variants={fadeUp}
      custom={index}
      className="w-full bg-bg-card border border-primary/10 rounded-2xl p-4 cursor-pointer transition-colors hover:border-primary/30 text-left font-sans"
      onClick={() => {
        if (firstGame) {
          navigate(`/analyse/${firstGame.analysisId}/game/${firstGame.gameIndex}?ply=${firstGame.plyNumber}`, { state: { from: location.pathname } });
        }
      }}
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          <ChessBoard
            fen={mistake.fen}
            interactive={false}
            orientation={orientation}
            width={120}
            customArrows={arrows}
          />
        </div>

        <div className="flex flex-col justify-between min-w-0 flex-1">
          <div>
            <p className="text-xs text-text-muted mb-0.5">You played</p>
            <p className="text-base font-semibold text-danger font-display">
              {mistake.playedMove}
            </p>
            <p className="text-xs text-text-muted mt-1.5 mb-0.5">Best was</p>
            <p className="text-base font-semibold text-success font-display">
              {mistake.bestMove}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-bg text-text-muted border border-primary/10">
              {mistake.frequency}x
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityStyles[severityLevel]}`}>
              -{dropPct}%
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function WeakSpots({ insights }: WeakSpotsProps) {
  const navigate = useNavigate();
  const mistakes = insights.worstMistakes.slice(0, 4);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mistakes.map((mistake, i) => (
            <MistakeCard key={`${mistake.fen}-${mistake.playedMove}`} mistake={mistake} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
