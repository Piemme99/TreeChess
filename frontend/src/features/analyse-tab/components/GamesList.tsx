import { useMemo, useState, useCallback, useEffect } from 'react';
import { Button, Loading } from '../../../shared/components/UI';
import type { GameSummary, GameStatus, Color, TimeClass } from '../../../types';
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
  onViewClick: (analysisId: string, gameIndex: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGameReanalyzed?: () => void;
  // When a bulk "re-analyze all" is running, disable per-row reanalyze to avoid
  // firing concurrent duplicate mutations against the same games.
  reanalyzeAllActive?: boolean;
  // Reports whether any per-row reanalyze is in flight so the parent can lock
  // the "re-analyze all" action.
  onReanalyzingChange?: (active: boolean) => void;
}

function StatusBadge({ status }: { status: GameStatus }) {
  const config: Record<GameStatus, { label: string; className: string }> = {
    'in-repertoire': { label: 'In repertoire', className: 'py-1 px-2 rounded-full text-xs font-medium bg-success-light text-success' },
    'error': { label: 'Opening error', className: 'py-1 px-2 rounded-full text-xs font-medium bg-danger-light text-danger' },
    'new-line': { label: 'New line', className: 'py-1 px-2 rounded-full text-xs font-medium bg-info-light text-info' },
    'new-opening': { label: 'New opening', className: 'py-1 px-2 rounded-full text-xs font-medium bg-warning-light text-warning' }
  };

  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}

function TimeClassBadge({ timeClass }: { timeClass?: TimeClass }) {
  if (!timeClass) {
    return <span data-testid="time-class" className="text-xs text-text-muted">—</span>;
  }
  return (
    <span data-testid="time-class" className="py-0.5 px-2 rounded-full text-xs font-medium bg-bg text-text-light capitalize">
      {timeClass}
    </span>
  );
}

const gridCols = 'grid grid-cols-[16px_1fr_64px_80px_70px_36px] md:grid-cols-[16px_1fr_150px_100px_64px_80px_70px_36px] items-center gap-x-3 px-4';

function GameRow({ game, onViewClick, onReanalyze, reanalyzing, reanalyzeDisabled, showNewBadge }: {
  game: GameSummary;
  onViewClick: (analysisId: string, gameIndex: number) => void;
  onReanalyze: (analysisId: string, gameIndex: number, repertoireId: string) => void;
  reanalyzing: boolean;
  reanalyzeDisabled: boolean;
  showNewBadge?: boolean;
}) {
  const outcome = gameOutcome(game.result, game.userColor);
  const dotColor = outcome === 'win' ? 'bg-success' : outcome === 'loss' ? 'bg-danger' : 'bg-text-light';

  return (
    <div
      className={`${gridCols} py-2.5 cursor-pointer transition-colors duration-150 hover:bg-primary-light/30 border-b border-primary/10 last:border-b-0`}
      onClick={() => onViewClick(game.analysisId, game.gameIndex)}
    >
      {/* Result dot */}
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} title={outcome} />

      {/* Players */}
      <div className="flex items-center justify-center gap-1.5 text-sm min-w-0">
        <span className="font-medium truncate">{game.white}</span>
        <span className="text-text-light text-xs">vs</span>
        <span className="font-medium truncate">{game.black}</span>
        <span className="font-mono text-xs text-text-muted ml-1">{game.result}</span>
        {showNewBadge && <span className="inline-block py-px px-2 rounded-sm bg-primary text-white text-[0.6875rem] font-semibold uppercase tracking-wide ml-1">New</span>}
      </div>

      {/* Repertoire */}
      <span className="hidden md:block text-xs text-text-muted truncate text-center">
        {game.repertoireName || '-'}
      </span>

      {/* Status */}
      <div className="hidden md:flex justify-center">
        <StatusBadge status={game.status} />
      </div>

      {/* Time control */}
      <div className="flex justify-center">
        <TimeClassBadge timeClass={game.timeClass} />
      </div>

      {/* Date */}
      <span className="text-xs text-text-muted whitespace-nowrap text-center">{game.date || '-'}</span>

      {/* Source */}
      <span className="text-xs text-text-muted text-center">{formatSource(game.source)}</span>

      {/* Actions */}
      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
        {game.repertoireId && (
          <button
            className={`flex items-center justify-center w-7 h-7 p-0 border-none rounded-sm bg-transparent text-text-muted cursor-pointer transition-colors duration-150 hover:not-disabled:text-primary hover:not-disabled:bg-bg disabled:cursor-default ${reanalyzing ? '[&_svg]:animate-spin' : ''}`}
            onClick={() => onReanalyze(game.analysisId, game.gameIndex, game.repertoireId!)}
            disabled={reanalyzing || reanalyzeDisabled}
            title="Re-analyze against current repertoire"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.5 2.5v2h-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function GamesList({
  games,
  loading,
  onViewClick,
  hasNextPage,
  hasPrevPage,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  onGameReanalyzed,
  reanalyzeAllActive = false,
  onReanalyzingChange
}: GamesListProps) {
  const [reanalyzingKeys, setReanalyzingKeys] = useState<Set<GameKey>>(new Set());

  // Report per-row reanalyze activity so the parent can lock the bulk action.
  useEffect(() => {
    onReanalyzingChange?.(reanalyzingKeys.size > 0);
  }, [reanalyzingKeys, onReanalyzingChange]);

  const handleReanalyze = useCallback(async (analysisId: string, gameIndex: number, repertoireId: string) => {
    if (reanalyzeAllActive) return;
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
  }, [onGameReanalyzed, reanalyzeAllActive]);

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
    <div className="rounded-2xl border border-primary/10 overflow-x-auto">
      {/* Table header */}
      <div className={`${gridCols} py-2 border-b border-primary/10 text-[11px] font-semibold text-text-light uppercase tracking-wide`}>
        <span></span>
        <span className="text-center">Players</span>
        <span className="hidden md:block text-center">Repertoire</span>
        <span className="hidden md:block text-center">Status</span>
        <span className="text-center">Time</span>
        <span className="text-center">Date</span>
        <span className="text-center">Source</span>
        <span></span>
      </div>
      {list.map((game) => {
        const key = toKey(game.analysisId, game.gameIndex);
        return (
          <GameRow
            key={key}
            game={game}
            onViewClick={onViewClick}
            onReanalyze={handleReanalyze}
            reanalyzing={reanalyzingKeys.has(key)}
            reanalyzeDisabled={reanalyzeAllActive}
            showNewBadge={showNew}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
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
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-primary/10">
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
