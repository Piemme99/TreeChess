import { useNavigate, useLocation } from 'react-router';
import { Button } from '../../../shared/components/UI';
import type { GameSummary, Color } from '../../../types';

function gameOutcome(result: string, userColor: Color): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') return 'draw';
  const whiteWins = result === '1-0';
  const isWhite = userColor === 'white';
  return whiteWins === isWhite ? 'win' : 'loss';
}

const outcomeDot: Record<string, string> = {
  win: 'bg-success',
  loss: 'bg-danger',
  draw: 'bg-text-light',
};

const sourceIcons: Record<string, string> = {
  lichess: '\u265E',
  chesscom: '\u265F',
  pgn: '\uD83D\uDCC4',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  'in-repertoire': { label: 'In repertoire', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-success-light text-success' },
  error: { label: 'Opening error', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-danger-light text-danger' },
  'new-line': { label: 'New', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-info-light text-info' },
  'new-opening': { label: 'New opening', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-warning-light text-warning' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium' };
  return <span className={config.className}>{config.label}</span>;
}

interface RecentGamesProps {
  games: GameSummary[];
  loading: boolean;
}

export function RecentGames({ games, loading }: RecentGamesProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Recent Games</h2>
        {games.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
            View all
          </Button>
        )}
      </div>
      {games.length === 0 ? (
        <p className="text-center text-text-muted py-8 px-6 bg-bg-card rounded-2xl border border-primary/10">
          No games imported yet. Import games to compare them to your repertoire.
        </p>
      ) : (
        <div className="bg-bg-card rounded-2xl border border-primary/10 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[16px_1fr_150px_100px_80px_50px] items-center gap-x-3 px-4 py-2 border-b border-primary/10 text-[11px] font-semibold text-text-light uppercase tracking-wide">
            <span></span>
            <span>Players</span>
            <span className="text-center">Repertoire</span>
            <span className="text-center">Status</span>
            <span className="text-center">Date</span>
            <span className="text-center">Source</span>
          </div>
          {/* Game rows */}
          {games.slice(0, 4).map((game) => {
            const outcome = gameOutcome(game.result, game.userColor);
            return (
              <div
                key={`${game.analysisId}-${game.gameIndex}`}
                className="grid grid-cols-[16px_1fr_150px_100px_80px_50px] items-center gap-x-3 px-4 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-primary-light/30 border-b border-primary/10 last:border-b-0"
                onClick={() => navigate(`/analyse/${game.analysisId}/game/${game.gameIndex}`, { state: { from: location.pathname } })}
              >
                {/* Result dot */}
                <span className={`w-2.5 h-2.5 rounded-full ${outcomeDot[outcome]}`} title={outcome} />

                {/* Players */}
                <div className="flex items-center gap-1.5 text-sm min-w-0">
                  <span className="font-medium truncate">{game.white}</span>
                  <span className="text-text-light text-xs">vs</span>
                  <span className="font-medium truncate">{game.black}</span>
                  <span className="font-mono text-xs text-text-muted ml-1">{game.result}</span>
                </div>

                {/* Opening */}
                <span className="text-xs text-text-muted truncate text-center">
                  {game.repertoireName || '-'}
                </span>

                {/* Status */}
                <div className="flex justify-center">
                  <StatusBadge status={game.status} />
                </div>

                {/* Date */}
                <span className="text-xs text-text-muted whitespace-nowrap text-center">{game.date || '-'}</span>

                {/* Source */}
                <span className="text-xs text-text-muted text-center" title={game.source}>
                  {sourceIcons[game.source] || game.source}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
