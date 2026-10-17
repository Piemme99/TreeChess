import { formatMove } from '../domain/notation';
import type { Priority, Signal } from '../domain/priorities';
import type { Side } from '../domain/playedGame';
import { LineLabel } from '../position/LineLabel';

const SIGNAL_LABELS: Record<Signal, string> = {
  'weak-line': 'Weak line',
  'better-reply': 'Better reply',
};

const SIDE_LABELS: Record<Side, string> = {
  w: 'White',
  b: 'Black',
};

const COLUMNS = 'grid grid-cols-[2rem_4rem_1fr_11rem_5rem_8rem] items-center gap-3';

interface PriorityListProps {
  priorities: readonly Priority[];
  isSelected: (priority: Priority) => boolean;
  onSelect: (priority: Priority) => void;
  onPoint: (priority: Priority | null) => void;
}

export function PriorityList({ priorities, isSelected, onSelect, onPoint }: PriorityListProps) {
  if (priorities.length === 0) {
    return (
      <section aria-labelledby="priorities-title" className="flex flex-col gap-2">
        <h2 id="priorities-title" className="font-display text-lg text-text">Priorities</h2>
        <p className="text-sm text-text-muted">None</p>
      </section>
    );
  }
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

      <ol className="flex flex-col gap-1" onMouseLeave={() => onPoint(null)}>
        {priorities.map((priority, index) => (
          <li key={`${priority.side}:${priority.path.join(' ')}`}>
            <button
              type="button"
              onClick={() => onSelect(priority)}
              onMouseEnter={() => onPoint(priority)}
              onFocus={() => onPoint(priority)}
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
              <Signals priority={priority} />
              <span className="text-right font-mono text-text">{priority.games}</span>
              <ImpactBar share={priority.pointsToGain / heaviest} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Signals({ priority }: { priority: Priority }) {
  return (
    <span className="flex flex-col text-text-muted">
      {priority.signals.map((signal) => (
        <span key={signal}>
          {SIGNAL_LABELS[signal]}
          {signal === 'better-reply' && priority.betterReply && (
            <span className="font-mono"> {formatMove(priority.betterReply, priority.path.length)}</span>
          )}
        </span>
      ))}
    </span>
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
