import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove, formatLine } from '../domain/notation';
import type { Priority } from '../domain/priorities';
import { replayLine } from '../position/replay';
import { SPRING, COLOURS, raised, ZOOM } from '../workshop/theme';

interface PriorityTicketsProps {
  priorities: readonly Priority[];
  isSelected: (priority: Priority) => boolean;
  onSelect: (priority: Priority) => void;
  onPoint: (priority: Priority | null) => void;
}

export function PriorityTickets({ priorities, isSelected, onSelect, onPoint }: PriorityTicketsProps) {
  const heaviest = Math.max(...priorities.map((priority) => priority.pointsToGain));
  return (
    <section aria-labelledby="priorities-title" className="flex flex-col gap-4">
      <h2 id="priorities-title" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[30px] leading-none font-extrabold tracking-[-0.03em]">
        Priorities
        <span className="text-[14px] font-medium tracking-normal" style={{ color: COLOURS.leafSoft }}>
          where you lose the most points, last 12 months
        </span>
      </h2>
      {priorities.length === 0 ? (
        <p className="text-[15px]" style={{ color: COLOURS.leafSoft }}>
          None
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" onMouseLeave={() => onPoint(null)}>
          {priorities.map((priority, index) => (
            <Ticket
              key={`${priority.side}:${priority.path.join(' ')}`}
              priority={priority}
              rank={index + 1}
              share={priority.pointsToGain / heaviest}
              selected={isSelected(priority)}
              onSelect={() => onSelect(priority)}
              onPoint={() => onPoint(priority)}
            />
          ))}
        </ol>
      )}
      {priorities.length > 0 && (
        <p className="-mt-1 text-[12px]" style={{ color: COLOURS.leafSoft }}>
          The bar: points lost over 12 months, against priority 1. Click a card to see its line below.
        </p>
      )}
    </section>
  );
}

interface TicketProps {
  priority: Priority;
  rank: number;
  share: number;
  selected: boolean;
  onSelect: () => void;
  onPoint: () => void;
}

function Ticket({ priority, rank, share, selected, onSelect, onPoint }: TicketProps) {
  const fens = useMemo(() => replayLine(priority.path).fens, [priority.path]);
  const opening = useOpeningName(fens);
  const last = priority.path.length;
  const impact = Math.round(share * 100);
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: selected ? -10 : -4 }}
      whileTap={{ scale: 0.96 }}
      transition={{ ...SPRING, opacity: { delay: rank * 0.05 } }}
    >
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onPoint}
        onFocus={onPoint}
        aria-pressed={selected}
        className="flex h-full w-full flex-col gap-3 rounded-2xl p-3.5 text-left outline-none transition-shadow duration-200 focus-visible:ring-2"
        style={raised(selected)}
      >
        <span className="flex items-center justify-between">
          <span className="rounded px-1.5 py-0.5 text-[15px] leading-none font-extrabold" style={selected ? { background: COLOURS.cream, color: COLOURS.leaf } : { background: COLOURS.leaf, color: COLOURS.cream }}>
            P{rank}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ opacity: 0.8 }}>
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-full"
              style={{ background: priority.side === 'w' ? 'white' : COLOURS.leaf, boxShadow: `0 0 0 1.5px ${selected ? COLOURS.cream : COLOURS.leaf}` }}
            />
            {priority.side === 'w' ? 'White' : 'Black'}
          </span>
        </span>
        <span className="line-clamp-3 min-h-[2.5em] text-[14px] leading-tight font-semibold">{opening?.name ?? 'Unnamed line'}</span>
        <span className="text-[13px]" style={{ opacity: 0.75 }}>
          {figurineMove(priority.path[last - 1], last)}
        </span>
        <span className="sr-only">{formatLine(priority.path)}</span>
        <span
          role="meter"
          aria-label="Impact"
          aria-valuenow={impact}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-auto h-2 overflow-hidden rounded-full"
          style={{ background: selected ? 'oklch(1 0 0 / 0.15)' : COLOURS.sand }}
        >
          <motion.span
            className="block h-full rounded-full"
            style={{ background: COLOURS.leafSoft }}
            initial={{ width: 0 }}
            animate={{ width: `${impact}%` }}
            transition={{ ...ZOOM, delay: 0.2 + rank * 0.07 }}
          />
        </span>
      </button>
    </motion.li>
  );
}
