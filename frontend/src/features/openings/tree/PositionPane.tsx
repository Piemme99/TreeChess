import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { figurineMove, formatLine } from '../domain/notation';
import type { Priority } from '../domain/priorities';
import { relevantArrows } from '../position/arrows';
import { replayLine } from '../position/replay';
import type { SessionStep } from '../session/steps';
import { COLOURS, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import type { MapNode } from './repertoireMap';

interface PositionPaneProps {
  /** La ligne jouée sur l'échiquier ; au-delà de `node`, elle a quitté le répertoire. */
  path: readonly string[];
  node: MapNode;
  flipped: boolean;
  /** Les étapes de la séance qui tombent sur cette position. */
  steps: readonly SessionStep[];
  priority?: Priority;
  onMove: (san: string) => void;
  onBack?: () => void;
}

/** Le volet de la brique 1 : on y joue comme sur l'explorateur Lichess, sans encore y décider. */
export function PositionPane({ path, node, flipped, steps, priority, onMove, onBack }: PositionPaneProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const inRepertoire = path.length === node.path.length;
  const ply = path.length + 1;
  const planned = inRepertoire ? node.children.map((child) => child.san!) : [];
  const arrows = useMemo(() => {
    if (!inRepertoire) return [];
    const deviation = [...steps].sort((a, b) => b.games.length - a.games.length)[0];
    return relevantArrows(node.children.map((child) => ({ san: child.san!, games: child.games })), node.games, deviation?.played);
  }, [inRepertoire, node, steps]);
  // Un point d'atterrissage par flèche, pas par coup du répertoire : dix points sur l'échiquier, c'est dix flèches de plus.
  const suggestions = arrows.filter((arrow) => 'kind' in arrow && arrow.kind === 'repertoire').map((arrow) => arrow.san);

  return (
    <aside aria-label="Position" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
      <PlayableBoard path={path} flipped={flipped} arrows={arrows} suggestions={suggestions} onMove={onMove} />
      <div className="flex items-start gap-3 px-1">
        {onBack && (
          <motion.button
            type="button"
            onClick={onBack}
            aria-label="Back one move"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="shrink-0 rounded-full px-3 py-1 text-[15px] font-bold"
            style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}
          >
            ←
          </motion.button>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">
            {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
          </span>
          <span className="truncate text-[14px]" style={{ color: COLOURS.leafSoft }}>
            {formatLine(path) || '—'}
          </span>
        </div>
      </div>
      <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <span className="font-semibold">Repertoire </span>
        {!inRepertoire ? (
          <span>left at {figurineMove(path[node.path.length], node.path.length + 1)}: not in your repertoire</span>
        ) : planned.length ? (
          <span style={{ color: REPERTOIRE }} className="font-bold">
            {planned.map((san) => figurineMove(san, ply)).join(' · ')}
          </span>
        ) : (
          'nothing planned here'
        )}
        {inRepertoire && node.games > 0 && <span> · {node.games} games in 12 months</span>}
      </p>
      {inRepertoire && steps.length > 0 && (
        <section aria-label="To settle" className="flex flex-col gap-1 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.cream }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>
            {node.toSettle} {node.toSettle === 1 ? 'game' : 'games'} to settle
          </span>
          {steps.map((step) => (
            <span key={step.key}>
              {step.kind === 'left' ? 'You' : 'They'} played <strong>{figurineMove(step.played, ply)}</strong> in {step.games.length}{' '}
              {step.games.length === 1 ? 'game' : 'games'}
            </span>
          ))}
        </section>
      )}
      {inRepertoire && priority && (
        <section aria-label="Priority" className="flex flex-col gap-1 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          <span className="font-bold">Priority {node.priority}</span>
          <span>
            {Math.round(priority.pointsToGain)} points to gain · {priority.games} games in 12 months
          </span>
        </section>
      )}
      <p className="px-1 text-[12px]" style={{ color: COLOURS.leafSoft }}>
        Play on the board or click a node; ← and → move along the line, ↑ back to the start.
        {!inRepertoire && ' “Extend from here” comes with brick 3.'}
      </p>
    </aside>
  );
}
