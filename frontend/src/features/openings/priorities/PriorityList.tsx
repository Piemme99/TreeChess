import { Info } from 'lucide-react';
import { formatLine } from '../domain/notation';
import type { Priority, PriorityKind } from '../domain/priorities';
import type { Side } from '../domain/playedGame';

const KIND_LABELS: Record<PriorityKind, string> = {
  'weak-line': 'Weak line',
  unsettled: 'No settled reply',
};

const SIDE_LABELS: Record<Side, string> = {
  w: 'White',
  b: 'Black',
};

const POINTS_TO_GAIN_HINT = 'Game points you would have scored on top over these games (win = 1, draw = ½)';

const COLUMNS = 'grid grid-cols-[2rem_4rem_1fr_9rem_5rem_7rem] items-baseline gap-3';

interface PriorityListProps {
  priorities: readonly Priority[];
  isSelected: (priority: Priority) => boolean;
  onSelect: (priority: Priority) => void;
}

export function PriorityList({ priorities, isSelected, onSelect }: PriorityListProps) {
  if (priorities.length === 0) return null;

  return (
    <section aria-labelledby="priorities-title" className="flex flex-col gap-2">
      <h2 id="priorities-title" className="font-display text-lg text-text">Priorities</h2>

      <div className={`${COLUMNS} px-3 text-xs uppercase tracking-wide text-text-muted`}>
        <span>#</span>
        <span>Side</span>
        <span>Line</span>
        <span>Signal</span>
        <span className="text-right">Games</span>
        <span className="flex items-center justify-end gap-1">
          Points to gain
          <span title={POINTS_TO_GAIN_HINT} aria-label={POINTS_TO_GAIN_HINT} role="img" className="cursor-help">
            <Info size={12} aria-hidden />
          </span>
        </span>
      </div>

      <ol className="flex flex-col gap-1">
        {priorities.map((priority, index) => (
          <li key={`${priority.side}:${priority.kind}:${priority.path.join(' ')}`}>
            <button
              type="button"
              onClick={() => onSelect(priority)}
              aria-pressed={isSelected(priority)}
              className={`${COLUMNS} w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                isSelected(priority)
                  ? 'border-primary bg-primary-light'
                  : 'border-border bg-bg-card hover:border-border-dark'
              }`}
            >
              <span className="font-mono text-text-muted">{index + 1}</span>
              <span className="text-text-muted">{SIDE_LABELS[priority.side]}</span>
              <span className="font-mono text-text">{formatLine(priority.path) || 'Start'}</span>
              <span className="text-text-muted">{KIND_LABELS[priority.kind]}</span>
              <span className="text-right font-mono text-text">{priority.games}</span>
              <span className="text-right font-mono text-text">{priority.pointsToGain.toFixed(1)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
