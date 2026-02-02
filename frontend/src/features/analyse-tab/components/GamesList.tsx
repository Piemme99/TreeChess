import { useMemo, useState, useCallback } from 'react';
import { Button, Loading } from '../../../shared/components/UI';
import type { GameSummary, GameStatus, Color } from '../../../types';
import { formatSource } from '../utils/dateUtils';
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
    'ok': { label: 'OK', className: 'py-1 px-2 rounded-full text-xs font-medium bg-success-light text-success' },
    'error': { label: 'Error', className: 'py-1 px-2 rounded-full text-xs font-medium bg-danger-light text-danger' },
    'new-line': { label: 'New line', className: 'py-1 px-2 rounded-full text-xs font-medium bg-info-light text-info' }
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
  const outcome = gameOutcome(game.result, game.userColor);
  const dotColor = outcome === 'win' ? 'bg-success' : outcome === 'loss' ? 'bg-danger' : 'bg-text-light';

  return (
    <div
      className={`flex items-center gap-4 py-3 px-4 bg-bg-card border-b border-border transition-colors duration-150 hover:bg-bg cursor-pointer${selected ? ' bg-primary-light' : ''}`}
      onClick={selectionMode ? onToggleSelect : () => onViewClick(game.analysisId, game.gameIndex)}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-[18px] h-[18px] cursor-pointer accent-primary shrink-0"
        />
      )}
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
      <span className="font-mono text-sm font-medium w-16 shrink-0">{game.result}</span>
      <div className="flex items-center gap-1 min-w-0 shrink-0">
        <span className="font-medium truncate">{game.white}</span>
        <span className="text-text-muted text-sm">vs</span>
        <span className="font-medium truncate">{game.black}</span>
        {showNewBadge && <span className="inline-block py-px px-2 rounded-sm bg-primary text-white text-[0.6875rem] font-semibold uppercase tracking-wide ml-1">New</span>}
      </div>
      <span className="text-sm text-text-muted truncate max-w-[200px] hidden lg:inline">{game.opening || ''}</span>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <StatusBadge status={game.status} />
        <span className="text-sm text-text-muted whitespace-nowrap hidden sm:inline">{game.date || ''}</span>
        <span className="text-xs text-text-light whitespace-nowrap hidden md:inline">{formatSource(game.source)}</span>
      </div>
      {!selectionMode && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {game.repertoireId && (
            <button
              className={`flex items-center justify-center w-7 h-7 p-0 border-none rounded-sm bg-transparent text-text-muted cursor-pointer transition-colors duration-150 hover:not-disabled:text-primary hover:not-disabled:bg-bg disabled:cursor-default ${reanalyzing ? '[&_svg]:animate-spin' : ''}`}
              onClick={() => onReanalyze(game.analysisId, game.gameIndex, game.repertoireId!)}
              disabled={reanalyzing}
              title="Re-analyze against current repertoire"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.5 2.5v2h-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteClick(game.analysisId, game.gameIndex)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7v5M9.5 7v5M3.5 4l.5 9a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 13l.5-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
    return <p className="text-center text-text-muted py-8">No games yet. Upload a PGN file to get started.</p>;
  }

  const renderGrid = (list: GameSummary[], showNew: boolean) => (
    <div className="rounded-lg border border-border overflow-hidden">
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
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
          <h3 className="text-[0.9375rem] font-semibold text-text my-4 mb-2 flex items-center gap-2 first:mt-0">
            New games
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-semibold">{newGames.length}</span>
          </h3>
          {renderGrid(newGames, true)}
        </>
      )}

      {analyzedGames.length > 0 && (
        <>
          {newGames.length > 0 && (
            <h3 className="text-[0.9375rem] font-semibold text-text my-4 mb-2 flex items-center gap-2">Previously analyzed</h3>
          )}
          {renderGrid(analyzedGames, false)}
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevPage}
            disabled={!hasPrevPage}
          >
            Previous
          </Button>
          <span className="text-sm text-text-muted">
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
