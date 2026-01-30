import { useMemo, useState, useCallback } from 'react';
import { Button, Loading } from '../../../shared/components/UI';
import type { GameSummary, GameStatus, Color } from '../../../types';
import { formatDate, formatSource } from '../utils/dateUtils';
import { gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

function gameOutcome(result: string, userColor: Color): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') return 'draw';
  const whiteWins = result === '1-0';
  const isWhite = userColor === 'white';
  return whiteWins === isWhite ? 'win' : 'loss';
}

type GameKey = `${string}-${number}`;

function toKey(analysisId: string, gameIndex: number): GameKey {
  return `${analysisId}-${gameIndex}`;
}

export interface GamesListProps {
  games: GameSummary[];
  loading: boolean;
  onDeleteClick: (analysisId: string, gameIndex: number) => void;
  onBulkDelete: (games: { analysisId: string; gameIndex: number }[]) => void;
  onViewClick: (analysisId: string, gameIndex: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onGameReanalyzed?: () => void;
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

function GameCard({ game, onViewClick, onDeleteClick, onReanalyze, reanalyzing, showNewBadge, selectionMode, selected, onToggleSelect }: {
  game: GameSummary;
  onViewClick: (analysisId: string, gameIndex: number) => void;
  onDeleteClick: (analysisId: string, gameIndex: number) => void;
  onReanalyze: (analysisId: string, gameIndex: number, repertoireId: string) => void;
  reanalyzing: boolean;
  showNewBadge?: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div
      className={`game-card game-${gameOutcome(game.result, game.userColor)}${selected ? ' game-card--selected' : ''}`}
      onClick={selectionMode ? onToggleSelect : undefined}
    >
      {selectionMode && (
        <div className="game-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="game-info">
        <div className="game-players">
          <span className="player-white">{game.white}</span>
          <span className="vs">vs</span>
          <span className="player-black">{game.black}</span>
          {showNewBadge && <span className="badge-new">New</span>}
        </div>
        <div className="game-meta">
          <span className="game-result">{game.result}</span>
          {game.date && <span className="game-date">{game.date}</span>}
          <StatusBadge status={game.status} />
          {game.opening && <span className="game-opening">{game.opening}</span>}
          {game.repertoireName && <span className="game-repertoire">{game.repertoireName}</span>}
        </div>
        <div className="game-import-date">
          Imported {formatDate(game.importedAt)} from {formatSource(game.source)}
        </div>
      </div>
      {!selectionMode && (
        <div className="game-actions">
          {game.repertoireId && (
            <button
              className={`reanalyze-btn${reanalyzing ? ' reanalyzing' : ''}`}
              onClick={() => onReanalyze(game.analysisId, game.gameIndex, game.repertoireId!)}
              disabled={reanalyzing}
              title="Re-analyze against current repertoire"
            >
              <svg className="reanalyze-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.5 2.5v2h-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
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
      )}
    </div>
  );
}

export function GamesList({
  games,
  loading,
  onDeleteClick,
  onBulkDelete,
  onViewClick,
  hasNextPage,
  hasPrevPage,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  selectionMode,
  onToggleSelectionMode,
  onGameReanalyzed
}: GamesListProps) {
  const [selected, setSelected] = useState<Set<GameKey>>(new Set());
  const [reanalyzingKeys, setReanalyzingKeys] = useState<Set<GameKey>>(new Set());

  const handleReanalyze = useCallback(async (analysisId: string, gameIndex: number, repertoireId: string) => {
    const key = toKey(analysisId, gameIndex);
    setReanalyzingKeys((prev) => new Set(prev).add(key));
    try {
      await gamesApi.reanalyze(analysisId, gameIndex, repertoireId);
      toast.success('Game re-analyzed');
      onGameReanalyzed?.();
    } catch {
      toast.error('Failed to re-analyze game');
    } finally {
      setReanalyzingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [onGameReanalyzed]);

  const toggleSelect = useCallback((analysisId: string, gameIndex: number) => {
    const key = toKey(analysisId, gameIndex);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(games.map((g) => toKey(g.analysisId, g.gameIndex))));
  }, [games]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const items = Array.from(selected).map((key) => {
      const lastDash = key.lastIndexOf('-');
      return {
        analysisId: key.slice(0, lastDash),
        gameIndex: parseInt(key.slice(lastDash + 1), 10),
      };
    });
    onBulkDelete(items);
    setSelected(new Set());
  }, [selected, onBulkDelete]);

  const { newGames, analyzedGames } = useMemo(() => {
    const newG: GameSummary[] = [];
    const analyzedG: GameSummary[] = [];
    for (const game of games) {
      if (game.synced) {
        newG.push(game);
      } else {
        analyzedG.push(game);
      }
    }
    return { newGames: newG, analyzedGames: analyzedG };
  }, [games]);

  if (loading) {
    return <Loading text="Loading games..." />;
  }

  if (games.length === 0) {
    return <p className="no-analyses">No games yet. Upload a PGN file to get started.</p>;
  }

  const renderGrid = (list: GameSummary[], showNew: boolean) => (
    <div className="games-grid">
      {list.map((game) => {
        const key = toKey(game.analysisId, game.gameIndex);
        return (
          <GameCard
            key={key}
            game={game}
            onViewClick={onViewClick}
            onDeleteClick={onDeleteClick}
            onReanalyze={handleReanalyze}
            reanalyzing={reanalyzingKeys.has(key)}
            showNewBadge={showNew}
            selectionMode={selectionMode}
            selected={selected.has(key)}
            onToggleSelect={() => toggleSelect(game.analysisId, game.gameIndex)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="games-list">
      <div className="games-list-toolbar">
        <Button
          variant={selectionMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => {
            if (selectionMode) {
              clearSelection();
            }
            onToggleSelectionMode();
          }}
        >
          {selectionMode ? 'Cancel' : (
            <>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ verticalAlign: '-2px' }}>
                <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7v5M9.5 7v5M3.5 4l.5 9a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 13l.5-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {' Delete mode'}
            </>
          )}
        </Button>
        {selectionMode && (
          <>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selected.size === 0}
            >
              Delete {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </>
        )}
      </div>

      {newGames.length > 0 && (
        <>
          <h3 className="games-section-title">
            New games
            <span className="games-section-count">{newGames.length}</span>
          </h3>
          {renderGrid(newGames, true)}
        </>
      )}

      {analyzedGames.length > 0 && (
        <>
          {newGames.length > 0 && (
            <h3 className="games-section-title">Previously analyzed</h3>
          )}
          {renderGrid(analyzedGames, false)}
        </>
      )}

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
