import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { figurineMove, formatLine } from '../domain/notation';
import { nodeAt, type OpeningNode, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import type { Priority } from '../domain/priorities';
import { relevantArrows } from '../position/arrows';
import { replayLine } from '../position/replay';
import type { SessionStep } from '../session/steps';
import { COLOURS, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import type { MapNode } from './repertoireMap';

export interface StepActions {
  onKeep: (step: SessionStep) => void;
  onStay: (step: SessionStep) => void;
  onPrepare: (step: SessionStep) => void;
}

interface PositionPaneProps {
  /** La ligne jouée sur l'échiquier ; au-delà de `node`, elle a quitté le répertoire. */
  path: readonly string[];
  node: MapNode;
  flipped: boolean;
  recent: OpeningTree;
  /** Les étapes de la séance qui tombent sur cette position. */
  steps: readonly SessionStep[];
  priority?: Priority;
  actions: StepActions;
  /** La séance en cours : où l'on en est, et « Skip » qui remet la position à plus tard. */
  session?: { index: number; total: number; onSkip: () => void };
  onNextPriority?: () => void;
  /** Construire depuis la position de l'échiquier, dans ou hors du répertoire. */
  onExtend: () => void;
  onPrepareFollows?: () => void;
  onMove: (san: string) => void;
  onBack?: () => void;
}

/** Le volet : on y joue comme sur l'explorateur Lichess, et on y tranche ce que la position porte. */
export function PositionPane({ path, node, flipped, recent, steps, priority, actions, session, onNextPriority, onExtend, onPrepareFollows, onMove, onBack }: PositionPaneProps) {
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
  const here = useMemo(() => nodeAt(recent, path), [recent, path]);

  return (
    <aside aria-label="Position" className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
      {session && (
        <span aria-label="Progress" className="px-1 text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          Session · {session.index} / {session.total}
        </span>
      )}
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
        <section aria-label="To settle" className="flex flex-col gap-3 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.cream }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>
            {node.toSettle} {node.toSettle === 1 ? 'game' : 'games'} to settle
          </span>
          {steps.map((step) => (
            <Step key={step.key} step={step} ply={ply} here={here} actions={actions} />
          ))}
          {session && (
            <button type="button" onClick={session.onSkip} className="self-center px-3 py-1 text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
              Skip for now
            </button>
          )}
        </section>
      )}
      {inRepertoire && priority && (
        <section aria-label="Priority" className="flex flex-col gap-2 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          <span className="font-bold">Priority {node.priority}</span>
          <span>
            {Math.round(priority.pointsToGain)} points to gain · {priority.games} games in 12 months
          </span>
          {onPrepareFollows && (
            <Action onClick={onPrepareFollows} light>
              Prepare what follows
            </Action>
          )}
          {onNextPriority && (
            <Action onClick={onNextPriority} light>
              Next priority →
            </Action>
          )}
        </section>
      )}
      <Action onClick={onExtend} primary={!inRepertoire}>
        Extend from here
      </Action>
      <p className="px-1 text-[12px]" style={{ color: COLOURS.leafSoft }}>
        Play on the board or click a node; ← and → move along the line, ↑ back to the start.
      </p>
    </aside>
  );
}

function Step({ step, ply, here, actions }: { step: SessionStep; ply: number; here: OpeningNode | undefined; actions: StepActions }) {
  const left = step.kind === 'left';
  const played = figurineMove(step.played, ply);
  const planned = step.planned.map((san) => figurineMove(san, ply)).join(' · ');
  const factOf = (san: string) => here?.children.find((child) => child.san === san);
  return (
    <div className="flex flex-col gap-2">
      <p>
        {left ? 'You' : 'They'} played <strong>{played}</strong> in {step.games.length} {step.games.length === 1 ? 'game' : 'games'}
        {left ? `, your repertoire has ${planned}` : ', your repertoire does not prepare it'}
      </p>
      <ul aria-label="Facts" className="flex flex-col gap-0.5 text-[13px]">
        <Fact move={played} node={factOf(step.played)} who={left ? 'you' : 'they'} />
        {left && step.planned.map((san) => <Fact key={san} move={figurineMove(san, ply)} node={factOf(san)} who="you" repertoire />)}
      </ul>
      <div className="flex flex-col gap-1.5">
        {left ? (
          <>
            <Action onClick={() => actions.onKeep(step)} primary>
              Keep {played}
            </Action>
            <Action onClick={() => actions.onStay(step)}>Stay on {step.planned.length === 1 ? planned : 'my repertoire'}</Action>
          </>
        ) : (
          <Action onClick={() => actions.onPrepare(step)} primary>
            Prepare an answer
          </Action>
        )}
      </div>
    </div>
  );
}

function Fact({ move, node, who, repertoire = false }: { move: string; node: OpeningNode | undefined; who: 'you' | 'they'; repertoire?: boolean }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-extrabold" style={{ color: repertoire ? REPERTOIRE : undefined }}>
        {move}
      </span>
      <span style={{ color: COLOURS.leafSoft }}>
        {node
          ? `${node.games} ${node.games === 1 ? 'game' : 'games'} in 12 months · ${who === 'you' ? '' : 'you score '}${Math.round(scoreRate(node) * 100)}%`
          : 'not played in 12 months'}
      </span>
    </li>
  );
}

function Action({ onClick, primary = false, light = false, children }: { onClick: () => void; primary?: boolean; light?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="w-full rounded-xl px-4 py-2.5 text-[15px] font-bold"
      style={primary ? raised(true) : light ? { background: COLOURS.cream, color: COLOURS.leaf } : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}
