import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';
import type { GameSummary, Color } from '../../../types';

function gameOutcome(result: string, userColor: Color): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') return 'draw';
  const whiteWins = result === '1-0';
  const isWhite = userColor === 'white';
  return whiteWins === isWhite ? 'win' : 'loss';
}

const outcomeClasses: Record<string, string> = {
  win: 'bg-success-light',
  loss: 'bg-danger-light',
  draw: '',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'py-1 px-2 rounded-full text-xs font-medium bg-success-light text-success' },
  error: { label: 'Error', className: 'py-1 px-2 rounded-full text-xs font-medium bg-danger-light text-danger' },
  'new-line': { label: 'New line', className: 'py-1 px-2 rounded-full text-xs font-medium bg-info-light text-info' },
};

function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusConfig[status] || { label: status, className: 'py-1 px-2 rounded-full text-xs font-medium' };
  return <span className={className}>{label}</span>;
}

interface RecentGamesProps {
  games: GameSummary[];
  loading: boolean;
}

export function RecentGames({ games, loading }: RecentGamesProps) {
  const navigate = useNavigate();

  if (loading) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-muted">Recent Games</h2>
        {games.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
            View all
          </Button>
        )}
      </div>
      {games.length === 0 ? (
        <p className="text-center text-text-muted p-6 bg-bg-card rounded-md">
          No games imported yet. Import games to compare them to your repertoire.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {games.slice(0, 5).map((game) => (
            <div
              key={`${game.analysisId}-${game.gameIndex}`}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-2 py-2 px-4 bg-bg-card rounded-md shadow-sm cursor-pointer transition-colors duration-150 hover:bg-bg ${outcomeClasses[gameOutcome(game.result, game.userColor)] || ''}`}
              onClick={() => navigate(`/analyse/${game.analysisId}/game/${game.gameIndex}`)}
            >
              <div className="flex items-center gap-2 font-medium">
                <span>{game.white}</span>
                <span className="text-text-muted font-normal text-sm">vs</span>
                <span>{game.black}</span>
              </div>
              <span className="font-mono font-medium text-sm">{game.result}</span>
              <span><StatusBadge status={game.status} /></span>
              {game.date && <span className="text-sm text-text-muted">{game.date}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
