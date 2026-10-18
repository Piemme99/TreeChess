import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { formatLine } from '../domain/notation';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { AnimatedNumber } from '../workshop/AnimatedNumber';
import { Chip } from '../workshop/Chip';
import { BOUNCE, COLOURS } from '../workshop/theme';
import { replayLine } from './replay';

interface BoardPanelProps {
  history: OpeningTree;
  recent: OpeningTree;
  path: readonly string[];
  onStudy?: () => void;
}

export function BoardPanel({ history, recent, path, onStudy }: BoardPanelProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);

  return (
    <aside aria-label="Position" className="sticky top-6 flex flex-col gap-4 self-start">
      <WorkshopBoard path={path} flipped={history.side === 'b'} />
      <div className="flex min-w-0 flex-col px-1">
        <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">
          {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
        </span>
        <span className="truncate text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {formatLine(path) || '—'}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-5 px-1">
        <Period label="All time" tree={history} path={path} />
        <Period label="Last 12 months" tree={recent} path={path} />
      </div>
      {onStudy && (
        <motion.button
          type="button"
          onClick={onStudy}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={BOUNCE}
          className="self-start rounded-full px-4 py-2 text-[15px] font-bold"
          style={{ background: COLOURS.kumquat, color: COLOURS.leaf, boxShadow: '0 6px 14px -6px oklch(0.6 0.17 45 / 0.6)' }}
        >
          Study this line →
        </motion.button>
      )}
    </aside>
  );
}

function Period({ label, tree, path }: { label: string; tree: OpeningTree; path: readonly string[] }) {
  const node = nodeAt(tree, path);
  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {label}
      </span>
      <span className="flex gap-2">
        <Chip label="games">
          <AnimatedNumber value={node?.games ?? 0} />
        </Chip>
        <Chip label="score">{node ? <AnimatedNumber value={scoreRate(node) * 100} format={(v) => `${Math.round(v)}%`} /> : '—'}</Chip>
      </span>
    </section>
  );
}
