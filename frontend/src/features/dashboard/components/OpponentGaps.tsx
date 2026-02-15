import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Chess } from 'chess.js';
import { X } from 'lucide-react';
import { ColorDot } from '../../../shared/components/UI';
import { StaticBoard } from '../../../shared/components/Board/StaticBoard';
import { ensureFullFEN } from '../../../shared/utils/chess';
import { dashboardApi } from '../../../services/api';
import type { OpponentGap } from '../../../types';

function gapKey(gap: OpponentGap): string {
  return `${gap.fen}|${gap.opponentMove}|${gap.repertoireId}`;
}

interface OpponentGapsProps {
  gaps: OpponentGap[];
}

function winRateColor(rate: number): string {
  if (rate >= 0.6) return 'text-success';
  if (rate >= 0.4) return 'text-warning';
  return 'text-danger';
}

function sanToArrow(fen: string, san: string): [string, string, string][] {
  try {
    const chess = new Chess(ensureFullFEN(fen));
    const move = chess.move(san);
    if (!move) return [];
    return [[move.from, move.to, 'rgba(220, 53, 69, 0.8)']];
  } catch {
    return [];
  }
}

function GapCard({ gap, onDismiss }: { gap: OpponentGap; onDismiss: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const winPct = Math.round(gap.winRate * 100);
  const arrows = useMemo(() => sanToArrow(gap.fen, gap.opponentMove), [gap.fen, gap.opponentMove]);

  return (
    <div className="bg-bg-card border border-primary/10 rounded-2xl p-4 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ColorDot color={gap.color} size="sm" />
          <span className="text-xs text-text-muted truncate">{gap.repertoireName}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {gap.frequency}x
          </span>
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text transition-colors p-0.5 rounded"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="shrink-0 w-[120px] h-[120px]">
          <StaticBoard
            fen={gap.fen}
            orientation={gap.color}
            arrows={arrows}
          />
        </div>

        <div className="flex flex-col justify-between min-w-0 flex-1">
          <div>
            <p className="text-xs text-text-muted">
              {gap.contextMove && (
                <span>After <span className="font-medium text-text">{gap.moveNumber > 1 ? `${gap.moveNumber - 1}. ` : ''}{gap.contextMove}</span>, </span>
              )}
              opponent plays
            </p>
            <p className="text-base font-semibold text-text font-display mt-0.5">
              {gap.moveNumber}. {gap.opponentMove}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${winRateColor(gap.winRate)}`}>
              {winPct}% win rate
            </span>
            <button
              onClick={() => {
                onDismiss();
                sessionStorage.setItem('pendingAddNode', JSON.stringify({
                  repertoireId: gap.repertoireId,
                  repertoireName: gap.repertoireName,
                  parentFEN: gap.fen,
                  moveSAN: gap.opponentMove,
                  gameInfo: 'Unprepared Lines',
                }));
                navigate(`/repertoire/${gap.repertoireId}/edit`, { state: { from: location.pathname } });
              }}
              className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Add to repertoire
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpponentGaps({ gaps }: OpponentGapsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set);

  const visibleGaps = gaps.filter(g => !dismissed.has(gapKey(g))).slice(0, 4);

  if (visibleGaps.length === 0) return null;

  const handleDismiss = (gap: OpponentGap) => {
    const key = gapKey(gap);
    dashboardApi.dismissGap(gap.fen, gap.opponentMove, gap.repertoireId);
    setDismissed(prev => new Set(prev).add(key));
  };

  return (
    <section>
      <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Unprepared Lines</h2>
      <p className="text-xs text-text-muted mb-3">
        Frequent opponent moves not in your repertoire
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleGaps.map((gap) => (
          <GapCard key={gapKey(gap)} gap={gap} onDismiss={() => handleDismiss(gap)} />
        ))}
      </div>
    </section>
  );
}
