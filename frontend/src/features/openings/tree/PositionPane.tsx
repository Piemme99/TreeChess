import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { figurineLine, figurineMove } from '../domain/notation';
import { isPlayerMove, nodeAt, type OpeningNode, type OpeningTree } from '../domain/openingTree';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Side } from '../domain/playedGame';
import type { Priority } from '../domain/priorities';
import { relevantArrows } from '../position/arrows';
import { replayLine } from '../position/replay';
import type { SessionStep } from '../session/steps';
import { COLOURS, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import type { MapNode } from './repertoireMap';

export interface StepActions {
  /** Le coup joué entre au répertoire tel quel, en un clic. */
  onAdd: (step: SessionStep) => void;
  /** Le coup joué entre au répertoire, et l'on construit la suite. */
  onBuild: (step: SessionStep) => void;
  /** Le répertoire ne change pas ; ces parties ne reviennent plus. */
  onStay: (step: SessionStep) => void;
  onPrepare: (step: SessionStep) => void;
}

interface PositionPaneProps {
  side: Side;
  /** La ligne jouée sur l'échiquier ; au-delà de `node`, elle a quitté le répertoire. */
  path: readonly string[];
  node: MapNode;
  recent: OpeningTree;
  /** Les étapes de la séance qui tombent sur cette position. */
  steps: readonly SessionStep[];
  priority?: Priority;
  actions: StepActions;
  /** En séance, « Skip » remet la position à plus tard. */
  onSkip?: () => void;
  onNextPriority?: () => void;
  /** Construire depuis la position de l'échiquier, dans ou hors du répertoire. */
  onExtend: () => void;
  onPrepareFollows?: () => void;
  onMove: (san: string) => void;
  onBack?: () => void;
}

// Un écart de score sur moins de parties ne dit rien : on ne recommande pas sur du bruit.
const MIN_GAMES_TO_COMPARE = 5;
const SHOWN_MOVES = 4;

/** Le volet : on y joue comme sur l'explorateur Lichess, et on y tranche ce que la position porte. */
export function PositionPane({ side, path, node, recent, steps, priority, actions, onSkip, onNextPriority, onExtend, onPrepareFollows, onMove, onBack }: PositionPaneProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const inRepertoire = path.length === node.path.length;
  const ply = path.length + 1;
  const arrows = useMemo(() => {
    if (!inRepertoire) return [];
    const deviation = [...steps].sort((a, b) => b.games.length - a.games.length)[0];
    return relevantArrows(node.children.map((child) => ({ san: child.san!, games: child.games })), node.games, deviation?.played);
  }, [inRepertoire, node, steps]);
  // Un point d'atterrissage par flèche, pas par coup du répertoire : dix points sur l'échiquier, c'est dix flèches de plus.
  const suggestions = arrows.filter((arrow) => 'kind' in arrow && arrow.kind === 'repertoire').map((arrow) => arrow.san);
  const here = useMemo(() => nodeAt(recent, path), [recent, path]);
  const average = useMemo(() => playerAverage(recent), [recent]);

  return (
    <aside aria-label="Position" className="flex flex-col gap-4">
      <div className="order-3 mx-auto w-full max-w-[24rem] lg:max-w-[20rem]">
        <PlayableBoard path={path} flipped={side === 'b'} arrows={arrows} suggestions={suggestions} onMove={onMove} />
      </div>
      <div className="order-1 flex items-start gap-3 px-1">
        {onBack && (
          <motion.button
            type="button"
            onClick={onBack}
            aria-label="Back one move"
            title="Back one move (←)"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-bold focus-visible:outline-2"
            style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}
          >
            ←
          </motion.button>
        )}
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">{opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}</h2>
          {path.length > 0 && (
            <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
              {figurineLine(path)}
            </span>
          )}
        </div>
      </div>
      <Repertoire side={side} path={path} node={node} inRepertoire={inRepertoire} ply={ply} />
      {inRepertoire && steps.length > 0 && (
        <section aria-label="To settle" className="order-2 flex flex-col gap-4 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.paper, boxShadow: `inset 0 0 0 1.5px ${COLOURS.terracotta}` }}>
          <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: COLOURS.terracotta }}>
            To settle
          </span>
          {steps.map((step) => (
            <Step key={step.key} step={step} ply={ply} here={here} actions={actions} />
          ))}
          {onSkip && (
            <button type="button" onClick={onSkip} className="self-center rounded-lg px-3 py-1.5 text-[14px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
              Skip for now
            </button>
          )}
        </section>
      )}
      {inRepertoire && priority && (
        <section aria-label="Priority" className="order-2 flex flex-col gap-2.5 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: COLOURS.apricot }}>
            Priority {node.priority}
          </span>
          <PriorityVerdict priority={priority} here={here} average={average} />
          {onPrepareFollows && (
            <Action onClick={onPrepareFollows} tone="light">
              Extend from here
            </Action>
          )}
          {onNextPriority && (
            <button type="button" onClick={onNextPriority} className="self-start rounded-lg py-1 text-[14px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.cream }}>
              Next priority →
            </button>
          )}
        </section>
      )}
      {!(inRepertoire && priority && onPrepareFollows) && (
      <div className="order-5">
        <Action onClick={onExtend} tone={inRepertoire ? 'plain' : 'primary'}>
          {inRepertoire ? 'Extend from here' : 'Add this line to my repertoire'}
        </Action>
      </div>
      )}
      <p className="order-6 hidden px-1 text-[12px] lg:block" style={{ color: COLOURS.leafSoft }}>
        Play on the board or click the map. Keys: ← back · → main move · ↑ ↓ other moves · Home start · + − fold.
      </p>
    </aside>
  );
}

function Repertoire({ side, path, node, inRepertoire, ply }: { side: Side; path: readonly string[]; node: MapNode; inRepertoire: boolean; ply: number }) {
  const mine = isPlayerMove(side, ply);
  if (!inRepertoire) {
    return (
      <p className="order-4 px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <strong style={{ color: COLOURS.terracotta }}>Off your repertoire</strong> since {figurineMove(path[node.path.length], node.path.length + 1)}
      </p>
    );
  }
  const moves = [...node.children].sort((a, b) => b.games - a.games);
  const shown = moves.slice(0, SHOWN_MOVES);
  return (
    <div className="order-4 flex flex-col gap-1 px-1 text-[14px]">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {mine ? 'Your move here' : 'Their replies you have prepared'}
        {node.games > 0 && ` · ${node.games} ${node.games === 1 ? 'game' : 'games'} reached this in 12 months`}
      </span>
      {moves.length ? (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-bold" style={{ color: mine ? REPERTOIRE : COLOURS.leaf }}>
          {shown.map((child) => (
            <span key={child.key} className="whitespace-nowrap">
              {figurineMove(child.san!, ply)}
            </span>
          ))}
          {moves.length > shown.length && <span style={{ color: COLOURS.leafSoft }}>+{moves.length - shown.length} more</span>}
        </span>
      ) : (
        <span style={{ color: COLOURS.leafSoft }}>{mine ? 'Your repertoire stops here.' : 'No reply prepared yet.'}</span>
      )}
    </div>
  );
}

function PriorityVerdict({ priority, here, average }: { priority: Priority; here: OpeningNode | undefined; average: number }) {
  const lost = Math.round(priority.pointsToGain);
  return (
    <>
      <span className="text-[15px] leading-snug">
        You score <strong>{here ? Math.round(scoreRate(here) * 100) : '—'}%</strong> here, against <strong>{Math.round(average * 100)}%</strong> on average.
      </span>
      <span className="text-[13px]" style={{ opacity: 0.8 }}>
        About {lost} {lost === 1 ? 'point' : 'points'} (a win = 1) lost over {priority.games} games in 12 months.
      </span>
    </>
  );
}

function Step({ step, ply, here, actions }: { step: SessionStep; ply: number; here: OpeningNode | undefined; actions: StepActions }) {
  const left = step.kind === 'left';
  const played = figurineMove(step.played, ply);
  const planned = step.planned.map((san) => figurineMove(san, ply)).join(' · ');
  const factOf = (san: string) => here?.children.find((child) => child.san === san);
  const games = step.games.length;
  const playedFact = factOf(step.played);
  const best = left ? betterMove(step, factOf) : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[15px] leading-snug">
        {left ? 'You played' : 'They played'} <strong>{played}</strong> in {games} recent {games === 1 ? 'game' : 'games'}
        {left ? (
          <>
            ; your repertoire has <strong style={{ color: REPERTOIRE }}>{planned}</strong>.
          </>
        ) : (
          '; your repertoire has no answer yet.'
        )}
      </p>
      <ul aria-label="Facts" className="flex flex-col gap-1 text-[13px]">
        <Fact move={played} node={playedFact} who={left ? 'you' : 'they'} best={best === step.played} />
        {left && step.planned.map((san) => <Fact key={san} move={figurineMove(san, ply)} node={factOf(san)} who="you" repertoire best={best === san} />)}
      </ul>
      {left ? (
        <div className="flex flex-col gap-1.5">
          <Action onClick={() => actions.onAdd(step)} tone={best === step.played ? 'primary' : 'plain'}>
            Add {played} {step.planned.length ? 'as another choice' : 'to my repertoire'}
          </Action>
          <Action onClick={() => actions.onStay(step)} tone={best && best !== step.played ? 'primary' : 'plain'}>
            Stay on {step.planned.length === 1 ? planned : 'my repertoire'}
          </Action>
          <button type="button" onClick={() => actions.onBuild(step)} className="self-start rounded-lg py-1 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
            Add {played} and prepare what follows →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Action onClick={() => actions.onPrepare(step)} tone="primary">
            Prepare an answer to {played}
          </Action>
          <Action onClick={() => actions.onStay(step)}>Not worth preparing</Action>
        </div>
      )}
    </div>
  );
}

/** Le coup qui score nettement mieux, s'il y en a un et que les parties suffisent à le dire. */
function betterMove(step: SessionStep, factOf: (san: string) => OpeningNode | undefined): string | undefined {
  const scored = [step.played, ...step.planned]
    .map((san) => ({ san, node: factOf(san) }))
    .filter((entry): entry is { san: string; node: OpeningNode } => entry.node !== undefined && entry.node.games >= MIN_GAMES_TO_COMPARE)
    .sort((a, b) => scoreRate(b.node) - scoreRate(a.node));
  if (scored.length < 2) return undefined;
  return scoreRate(scored[0].node) - scoreRate(scored[1].node) >= 0.05 ? scored[0].san : undefined;
}

function Fact({ move, node, who, repertoire = false, best = false }: { move: string; node: OpeningNode | undefined; who: 'you' | 'they'; repertoire?: boolean; best?: boolean }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="min-w-12 font-extrabold" style={{ color: repertoire ? REPERTOIRE : undefined }}>
        {move}
      </span>
      <span style={{ color: COLOURS.leafSoft }}>
        {node ? (
          <>
            {node.games} {node.games === 1 ? 'game' : 'games'} in 12 months · {who === 'they' && 'you score '}
            <strong style={{ color: COLOURS.leaf }}>{Math.round(scoreRate(node) * 100)}%</strong>
          </>
        ) : (
          'not played in 12 months'
        )}
      </span>
      {best && (
        <span className="rounded-full px-2 text-[11px] font-bold" style={{ background: COLOURS.sage, color: COLOURS.leaf }}>
          scores better
        </span>
      )}
    </li>
  );
}

function Action({ onClick, tone = 'plain', children }: { onClick: () => void; tone?: 'primary' | 'plain' | 'light'; children: ReactNode }) {
  const style = tone === 'primary' ? raised(true) : tone === 'light' ? { background: COLOURS.cream, color: COLOURS.leaf } : { ...tile(COLOURS.sand), color: COLOURS.leaf };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="w-full rounded-xl px-4 py-2.5 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={style}
    >
      {children}
    </motion.button>
  );
}
