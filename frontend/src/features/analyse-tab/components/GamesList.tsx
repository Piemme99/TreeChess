import { Button, Loading } from '../../../shared/components/UI';
import type { GameSummary, GameStatus } from '../../../types';
import { formatDate } from '../utils/dateUtils';

export interface GamesListProps {
  games: GameSummary[];
  loading: boolean;
  onDeleteClick: (analysisId: string, gameIndex: number) => void;
  onViewClick: (analysisId: string, gameIndex: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
}

function StatusBadge({ status }: { status: GameStatus }) {
  const config: Record<GameStatus, { label: string; className: string }> = {
    'ok': { label: 'OK', className: 'status-badge status-ok' },
    'error': { label: 'Error', className: 'status-badge status-error' },
    'new-line': { label: 'New line', className: 'status-badge status-new-line' }
  };

  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}

export function GamesList({
  games,
  loading,
  onDeleteClick,
  onViewClick,
  hasNextPage,
  hasPrevPage,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage
}: GamesListProps) {
  if (loading) {
    return <Loading text="Loading games..." />;
  }

  if (games.length === 0) {
    return <p className="no-analyses">No games yet. Upload a PGN file to get started.</p>;
  }

  return (
    <div className="games-list">
      <div className="games-grid">
        {games.map((game) => (
          <div key={`${game.analysisId}-${game.gameIndex}`} className="game-card">
            <div className="game-info">
              <div className="game-players">
                <span className="player-white">{game.white}</span>
                <span className="vs">vs</span>
                <span className="player-black">{game.black}</span>
              </div>
              <div className="game-meta">
                <span className="game-result">{game.result}</span>
                {game.date && <span className="game-date">{game.date}</span>}
                <StatusBadge status={game.status} />
              </div>
              <div className="game-import-date">
                Imported {formatDate(game.importedAt)}
              </div>
            </div>
            <div className="game-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onViewClick(game.analysisId, game.gameIndex)}
              >
                View
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDeleteClick(game.analysisId, game.gameIndex)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevPage}
            disabled={!hasPrevPage}
          >
            Previous
          </Button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNextPage}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
