import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineLine, figurineMove } from '../domain/notation';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import { ArrowBoard } from '../board/ArrowBoard';
import { AnimatedNumber } from '../workshop/AnimatedNumber';
import { Chip } from '../workshop/Chip';
import { SPRING, COLOURS, REPERTOIRE } from '../workshop/theme';
import { relevantArrows } from './arrows';
import { replayLine } from './replay';

interface BoardPanelProps {
  history: OpeningTree;
  recent: OpeningTree;
  path: readonly string[];
  repertoire: Repertoire;
  /** La ligne prévisualisée, ouverte dans l'arbre : c'est là qu'on la travaille. */
  studyHref?: string;
}

export function BoardPanel({ history, recent, path, repertoire, studyHref }: BoardPanelProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const planned = useMemo(() => repertoireMovesAt(repertoire, fens[fens.length - 1]), [repertoire, fens]);
  const arrows = useMemo(() => {
    const here = nodeAt(recent, path);
    const games = (san: string) => here?.children.find((child) => child.san === san)?.games ?? 0;
    return relevantArrows(planned.map((move) => ({ san: move.san, games: games(move.san) })), here?.games ?? 0);
  }, [planned, recent, path]);

  return (
    <aside aria-label="Position" className="mx-auto flex w-full max-w-[26rem] flex-col gap-4 self-start lg:sticky lg:top-6 lg:max-w-none">
      <ArrowBoard path={path} flipped={history.side === 'b'} arrows={arrows} />
      <div className="flex min-w-0 flex-col px-1">
        <span className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">
          {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
        </span>
        {path.length > 0 && (
          <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
            {figurineLine(path)}
          </span>
        )}
      </div>
      <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <span className="font-semibold">{path.length % 2 === (history.side === 'w' ? 0 : 1) ? 'Your repertoire here: ' : 'Replies you prepared: '}</span>
        {planned.length ? (
          <span style={{ color: REPERTOIRE }} className="font-bold">
            {planned.map((move) => figurineMove(move.san, path.length + 1)).join(' · ')}
          </span>
        ) : (
          'nothing yet'
        )}
      </p>
      <div className="flex flex-wrap items-end gap-5 px-1">
        <Period label="All time" tree={history} path={path} />
        <Period label="Last 12 months" tree={recent} path={path} />
      </div>
      {studyHref && (
        <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} transition={SPRING} className="self-start">
          <Link
            to={studyHref}
            className="block rounded-full px-4 py-2 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 6px 14px -6px oklch(0.3 0.06 150 / 0.55)' }}
          >
            Work on it in the tree →
          </Link>
        </motion.span>
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
