import type { Priority, PriorityKind } from '../domain/priorities';
import type { Side } from '../domain/playedGame';
import { LineLabel } from './LineLabel';

const KIND_LABELS: Record<PriorityKind, string> = {
  'weak-line': 'Weak line',
  unsettled: 'No settled reply',
};

const SIDE_LABELS: Record<Side, string> = {
  w: 'White',
  b: 'Black',
};

const COLUMNS = 'grid grid-cols-[2rem_4rem_1fr_9rem_5rem_8rem] items-center gap-3';

interface PriorityListProps {
  priorities: readonly Priority[];
  isSelected: (priority: Priority) => boolean;
  onSelect: (priority: Priority) => void;
}

export function PriorityList({ priorities, isSelected, onSelect }: PriorityListProps) {
  if (priorities.length === 0) return null;
  const heaviest = Math.max(...priorities.map((priority) => priority.pointsToGain));

  return (
    <section aria-labelledby="priorities-title" className="flex flex-col gap-2">
      <h2 id="priorities-title" className="font-display text-lg text-text">Priorities</h2>

      <div className={`${COLUMNS} px-3 text-xs uppercase tracking-wide text-text-muted`}>
        <span>#</span>
        <span>Side</span>
        <span>Line</span>
        <span>Signal</span>
        <span className="text-right">Games</span>
        <span>Impact</span>
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
              <LineLabel path={priority.path} />
              <span className="text-text-muted">{KIND_LABELS[priority.kind]}</span>
              <span className="text-right font-mono text-text">{priority.games}</span>
              <ImpactBar share={priority.pointsToGain / heaviest} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ImpactBar({ share }: { share: number }) {
  const percent = Math.round(share * 100);
  return (
    <span
      role="meter"
      aria-label="Impact"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="block h-2 overflow-hidden rounded-full bg-border"
    >
      <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </span>
  );
}
