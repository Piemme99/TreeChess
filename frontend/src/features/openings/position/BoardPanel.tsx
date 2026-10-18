import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove, formatLine } from '../domain/notation';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { positionKey, repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import type { CheckedGame } from '../checks/checkedGame';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { AnimatedNumber } from '../workshop/AnimatedNumber';
import { Chip } from '../workshop/Chip';
import { SPRING, COLOURS, REPERTOIRE } from '../workshop/theme';
import { movesHere, type MoveHere } from './movesHere';
import { replayLine } from './replay';

interface BoardPanelProps {
  history: OpeningTree;
  recent: OpeningTree;
  path: readonly string[];
  repertoire: Repertoire;
  /** Les parties qui attendent une décision, toutes positions confondues : le panneau garde celles de la sienne. */
  toDecide: readonly CheckedGame[];
  onStudy?: () => void;
}

export function BoardPanel({ history, recent, path, repertoire, toDecide, onStudy }: BoardPanelProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const moves = useMemo(() => {
    const fen = fens[fens.length - 1];
    const position = positionKey(fen);
    const planned = repertoireMovesAt(repertoire, fen).map((move) => move.san);
    const here = toDecide.filter(({ game, check }) => game.side === history.side && check.kind !== 'followed' && check.position === position);
    return movesHere(nodeAt(recent, path), planned, here);
  }, [fens, repertoire, toDecide, history.side, recent, path]);
  const arrows = useMemo(
    () =>
      moves
        .filter((move) => move.inRepertoire || move.toDecide > 0)
        .map((move): BoardArrow => ({ san: move.san, kind: move.inRepertoire ? 'repertoire' : 'neutral', share: 0.5 })),
    [moves],
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
      <MovesHere moves={moves} ply={path.length + 1} />
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

function MovesHere({ moves, ply }: { moves: readonly MoveHere[]; ply: number }) {
  if (!moves.length) {
    return (
      <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        Nothing played or planned here
      </p>
    );
  }
  return (
    <table aria-label="Moves here" className="mx-1 border-collapse text-[14px]">
      <thead className="text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <tr className="text-left">
          <th className="pb-1 pr-3 font-semibold">Move</th>
          <th className="pb-1 px-3 text-right font-semibold">12 months</th>
          <th className="pb-1 px-3 text-right font-semibold">score</th>
          <th className="pb-1 pl-3 font-semibold" />
        </tr>
      </thead>
      <tbody>
        {moves.map((move) => (
          <tr key={move.san} style={{ borderTop: `1px solid ${COLOURS.sand}` }}>
            <td
              className="whitespace-nowrap py-1.5 pr-3 text-[15px] font-extrabold"
              style={{ color: move.inRepertoire ? REPERTOIRE : undefined }}
            >
              {figurineMove(move.san, ply)}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">{move.games || '—'}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{move.score === null ? '—' : `${Math.round(move.score * 100)}%`}</td>
            <td className="whitespace-nowrap py-1.5 pl-3">
              {move.inRepertoire && <Tag colour={REPERTOIRE}>repertoire</Tag>}
              {move.toDecide > 0 && <Tag colour={COLOURS.kumquatDeep}>{move.toDecide} to decide</Tag>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tag({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ color: COLOURS.cream, background: colour }}>
      {children}
    </span>
  );
}
