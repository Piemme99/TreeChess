import { useNavigate } from 'react-router-dom';
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
  chesscom: '\u265E',
  pgn: '\uD83D\uDCC4',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-success-light text-success' },
  error: { label: 'Error', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-danger-light text-danger' },
  'new-line': { label: 'New', className: 'py-0.5 px-1.5 rounded-full text-[11px] font-medium bg-info-light text-info' },
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

  if (loading) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Recent Games</h2>
        {games.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
            View all
          </Button>
        )}
      </div>
      {games.length === 0 ? (
        <p className="text-center text-text-muted py-8 px-6 bg-bg-card rounded-lg border border-border">
          No games imported yet. Import games to compare them to your repertoire.
        </p>
      ) : (
        <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-3 px-4 py-2 border-b border-border text-[11px] font-semibold text-text-light uppercase tracking-wide">
            <span></span>
            <span>Players</span>
            <span>Opening</span>
            <span>Status</span>
            <span>Date</span>
            <span>Source</span>
          </div>
          {/* Game rows */}
          {games.slice(0, 8).map((game) => {
            const outcome = gameOutcome(game.result, game.userColor);
            return (
              <div
                key={`${game.analysisId}-${game.gameIndex}`}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-3 px-4 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-bg border-b border-border last:border-b-0"
                onClick={() => navigate(`/analyse/${game.analysisId}/game/${game.gameIndex}`)}
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
                <span className="text-xs text-text-muted max-w-[160px] truncate">
                  {game.opening || '-'}
                </span>

                {/* Status */}
                <StatusBadge status={game.status} />

                {/* Date */}
                <span className="text-xs text-text-muted whitespace-nowrap">{game.date || '-'}</span>

                {/* Source */}
                <span className="text-xs text-text-muted" title={game.source}>
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
