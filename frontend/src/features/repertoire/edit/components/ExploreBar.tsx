import { Compass } from 'lucide-react';
import { Button } from '../../../../shared/components/UI';

interface ExploreBarProps {
  exploring: boolean;
  saving: boolean;
  canExplore: boolean;
  hasExploredMoves: boolean;
  onStart: () => void;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * Thin bar above the board. When idle it offers an "Explore" toggle; while
 * exploring it becomes a banner reminding the user that moves aren't saved,
 * with Save / Discard actions. Always rendered at a fixed height so the board
 * never resizes when exploration starts or ends.
 */
export function ExploreBar({
  exploring,
  saving,
  canExplore,
  hasExploredMoves,
  onStart,
  onSave,
  onDiscard,
}: ExploreBarProps) {
  return (
    <div className="h-11 shrink-0 px-3 flex items-center">
      {exploring ? (
        <div className="w-full flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 min-w-0">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Exploring — moves aren&apos;t saved</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              loading={saving}
              disabled={!hasExploredMoves || saving}
              title="Add the explored moves to the repertoire"
            >
              Save to repertoire
            </Button>
            <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving} title="Discard the exploration">
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onStart}
            disabled={!canExplore}
            title="Play moves freely without adding them to the repertoire"
          >
            <Compass className="w-3.5 h-3.5 mr-1" />
            Explore
          </Button>
        </div>
      )}
    </div>
  );
}
