import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove, formatLine } from '../domain/notation';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { AnimatedNumber } from '../workshop/AnimatedNumber';
import { Chip } from '../workshop/Chip';
import { SPRING, COLOURS, REPERTOIRE } from '../workshop/theme';
import { replayLine } from './replay';

interface BoardPanelProps {
  history: OpeningTree;
  recent: OpeningTree;
  path: readonly string[];
  repertoire: Repertoire;
  onStudy?: () => void;
}

export function BoardPanel({ history, recent, path, repertoire, onStudy }: BoardPanelProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const planned = useMemo(() => repertoireMovesAt(repertoire, fens[fens.length - 1]), [repertoire, fens]);
  const arrows = useMemo(
    () => planned.map((move): BoardArrow => ({ san: move.san, kind: 'repertoire', share: 0.5 })),
    [planned],
  );

  return (
    <aside aria-label="Position" className="sticky top-6 flex flex-col gap-4 self-start">
      <ArrowBoard path={path} flipped={history.side === 'b'} arrows={arrows} />
      <div className="flex min-w-0 flex-col px-1">
        <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">
          {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
        </span>
        <span className="truncate text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {formatLine(path) || '—'}
        </span>
      </div>
      <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <span className="font-semibold">Repertoire </span>
        {planned.length ? (
          <span style={{ color: REPERTOIRE }} className="font-bold">
            {planned.map((move) => figurineMove(move.san, path.length + 1)).join(' · ')}
          </span>
        ) : (
          'nothing planned here'
        )}
      </p>
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
          transition={SPRING}
          className="self-start rounded-full px-4 py-2 text-[15px] font-bold"
          style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 6px 14px -6px oklch(0.3 0.06 150 / 0.55)' }}
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
