import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { ChessBoard } from './Board/ChessBoard';
import { ensureFullFEN } from '../utils/chess';
import type { InsightsResponse, OpeningMistake } from '../../types';

interface MistakesListProps {
  insights: InsightsResponse;
  /** Max number of mistakes to display. Defaults to all. */
  limit?: number;
  /** Title displayed above the list */
  title?: string;
  /** Path to navigate to when "View all" is clicked. Hidden if omitted. */
  viewAllPath?: string;
  /** Called when a mistake is dismissed. Dismiss button hidden if omitted. */
  onDismiss?: (fen: string, playedMove: string) => void;
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

interface MistakeCardProps {
  mistake: OpeningMistake;
  index: number;
  onDismiss?: (fen: string, playedMove: string) => void;
}

function MistakeCard({ mistake, index, onDismiss }: MistakeCardProps) {
  const [expanded, setExpanded] = useState(false);
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
    <motion.div
      variants={fadeUp}
      custom={index}
      className="bg-bg-card border border-primary/10 rounded-2xl p-4 relative"
    >
      {/* Header row: severity + frequency + dismiss */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityStyles[severityLevel]}`}>
          -{dropPct}%
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {mistake.frequency}x
          </span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(mistake.fen, mistake.playedMove)}
              className="text-text-muted hover:text-text transition-colors p-0.5 rounded"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body: board + text */}
      <div className="flex gap-3">
        <div
          className="shrink-0 cursor-pointer"
          onClick={() => {
            if (firstGame) {
              navigate(`/analyse/${firstGame.analysisId}/game/${firstGame.gameIndex}?ply=${firstGame.plyNumber}`, { state: { from: location.pathname } });
            }
          }}
        >
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

          {mistake.games.length > 0 && (
            <div className="mt-2">
              <button
                className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide games' : `Show ${mistake.games.length} game${mistake.games.length > 1 ? 's' : ''}`}
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="games-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="mt-2 space-y-1">
                      {mistake.games.map((ref) => (
                        <button
                          key={`${ref.analysisId}-${ref.gameIndex}`}
                          className="w-full text-left text-sm px-3 py-1.5 rounded bg-bg hover:bg-border transition-colors cursor-pointer border-none"
                          onClick={() => navigate(`/analyse/${ref.analysisId}/game/${ref.gameIndex}?ply=${ref.plyNumber}`, { state: { from: location.pathname } })}
                        >
                          <span className="text-text">{ref.white} vs {ref.black}</span>
                          <span className="text-text-muted ml-2">{ref.result}</span>
                          {ref.date && <span className="text-text-muted ml-2">{ref.date}</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MistakesList({ insights, limit, title = 'Weak Spots', viewAllPath, onDismiss }: MistakesListProps) {
  const navigate = useNavigate();
  const mistakes = limit ? insights.worstMistakes.slice(0, limit) : insights.worstMistakes;
  const { engineAnalysisDone, engineAnalysisTotal, engineAnalysisCompleted } = insights;
  const progressPct = engineAnalysisTotal > 0 ? Math.round((engineAnalysisCompleted / engineAnalysisTotal) * 100) : 0;

  if (mistakes.length === 0 && engineAnalysisDone) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">{title}</h2>
          {!engineAnalysisDone && engineAnalysisTotal > 0 && (
            <span className="text-xs text-text-muted flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              {engineAnalysisCompleted}/{engineAnalysisTotal} analyzed
            </span>
          )}
        </div>
        {viewAllPath && mistakes.length > 0 && (
          <button
            className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
            onClick={() => navigate(viewAllPath)}
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
            <MistakeCard
              key={`${mistake.fen}-${mistake.playedMove}`}
              mistake={mistake}
              index={i}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </section>
  );
}
