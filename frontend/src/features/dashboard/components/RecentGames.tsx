import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';
import type { GameSummary, Color } from '../../../types';

function gameOutcome(result: string, userColor: Color): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') return 'draw';
  const whiteWins = result === '1-0';
  const isWhite = userColor === 'white';
  return whiteWins === isWhite ? 'win' : 'loss';
}

interface RecentGamesProps {
  games: GameSummary[];
  loading: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    'ok': { label: 'OK', className: 'status-badge status-ok' },
    'error': { label: 'Error', className: 'status-badge status-error' },
    'new-line': { label: 'New line', className: 'status-badge status-new-line' }
  };

  const { label, className } = config[status] || { label: status, className: 'status-badge' };
  return <span className={className}>{label}</span>;
}

export function RecentGames({ games, loading }: RecentGamesProps) {
  const navigate = useNavigate();

  if (loading) return null;

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">Recent Games</h2>
        {games.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
            View all
          </Button>
        )}
      </div>
      {games.length === 0 ? (
        <p className="dashboard-empty">
          No games imported yet. Import games to compare them to your repertoire.
        </p>
      ) : (
        <div className="recent-games-list">
          {games.slice(0, 5).map((game) => (
            <div
              key={`${game.analysisId}-${game.gameIndex}`}
              className={`recent-game-item game-${gameOutcome(game.result, game.userColor)}`}
              onClick={() => navigate(`/analyse/${game.analysisId}/game/${game.gameIndex}`)}
            >
              <div className="recent-game-players">
                <span>{game.white}</span>
                <span className="vs">vs</span>
                <span>{game.black}</span>
              </div>
              <span className="recent-game-result">{game.result}</span>
              <span className="recent-game-status"><StatusBadge status={game.status} /></span>
              {game.date && <span className="recent-game-date">{game.date}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
