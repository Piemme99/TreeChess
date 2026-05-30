import { useMemo, useState } from 'react';
import type { GameSummary, GameStatus } from '../../../types';

export interface SessionNavigationProps {
  /** Ordered list of "New" games the session steps through (across imports). */
  sessionGames: GameSummary[];
  currentAnalysisId?: string;
  currentGameIndex: number;
  onSelect: (analysisId: string, gameIndex: number) => void;
  movesAddedThisSession: number;
}

const navBtnClass =
  'w-9 h-9 flex items-center justify-center rounded-xl text-lg text-text-muted bg-transparent border border-primary/10 cursor-pointer transition-all duration-150 hover:not-disabled:bg-primary-light/50 hover:not-disabled:text-text disabled:opacity-30 disabled:cursor-default';

const STATUS_META: Record<GameStatus, { label: string; dot: string }> = {
  'in-repertoire': { label: 'In repertoire', dot: 'bg-success' },
  error: { label: 'Opening error', dot: 'bg-danger' },
  'new-line': { label: 'New line', dot: 'bg-info' },
  'new-opening': { label: 'New opening', dot: 'bg-warning' },
};

export function SessionNavigation({
  sessionGames,
  currentAnalysisId,
  currentGameIndex,
  onSelect,
  movesAddedThisSession,
}: SessionNavigationProps) {
  const [open, setOpen] = useState(false);

  const currentIndex = useMemo(
    () =>
      sessionGames.findIndex(
        (g) => g.analysisId === currentAnalysisId && g.gameIndex === currentGameIndex
      ),
    [sessionGames, currentAnalysisId, currentGameIndex]
  );

  // Nothing to navigate, or the current game isn't part of the New-games session.
  if (sessionGames.length <= 1 || currentIndex === -1) return null;

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= sessionGames.length - 1;

  const go = (index: number) => {
    setOpen(false);
    const target = sessionGames[index];
    if (target && index !== currentIndex) {
      onSelect(target.analysisId, target.gameIndex);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 py-3 border-b border-primary/10 mb-4">
      <div className="flex items-center justify-center gap-2">
        <button
          className={navBtnClass}
          onClick={() => go(currentIndex - 1)}
          disabled={isFirst}
          aria-label="Previous game"
        >
          ‹
        </button>

        <div className="relative">
          <button
            className="px-3 h-9 flex items-center gap-2 rounded-xl text-sm font-mono text-text-muted bg-transparent border border-primary/10 cursor-pointer transition-colors duration-150 hover:bg-primary-light/50 hover:text-text"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            New game {currentIndex + 1} / {sessionGames.length}
            <span className="text-xs">▾</span>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <ul
                role="listbox"
                className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-80 max-h-80 overflow-y-auto bg-bg-card rounded-2xl border border-primary/10 shadow-md shadow-primary/5 py-1"
              >
                {sessionGames.map((game, index) => {
                  const selected = index === currentIndex;
                  const meta = STATUS_META[game.status];
                  return (
                    <li key={`${game.analysisId}-${game.gameIndex}`}>
                      <button
                        role="option"
                        aria-selected={selected}
                        onClick={() => go(index)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-primary-light/40 ${selected ? 'bg-primary-light/30 text-text font-medium' : 'text-text-muted'}`}
                      >
                        <span className="truncate">
                          {index + 1}. {game.white} vs {game.black}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs">
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <button
          className={navBtnClass}
          onClick={() => go(currentIndex + 1)}
          disabled={isLast}
          aria-label="Next game"
        >
          ›
        </button>
      </div>

      {isLast && (
        <p className="text-xs text-text-muted">
          End of new games · {sessionGames.length} total
          {movesAddedThisSession > 0 && ` · ${movesAddedThisSession} move${movesAddedThisSession === 1 ? '' : 's'} added`}
        </p>
      )}
    </div>
  );
}
