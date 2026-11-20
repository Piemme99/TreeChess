import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { JUDGEMENT_MARK } from '../domain/judgement';
import { figurine, figurineLine, figurineMove, formatCp } from '../domain/notation';
import { isPlayerMove, type OpeningNode, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import type { Side } from '../domain/playedGame';
import type { Priority } from '../domain/priorities';
import { replayLine } from '../position/replay';
import type { SessionStep } from '../session/steps';
import type { StoppedMove } from '../domain/stopped';
import { COLOURS, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { usePositionFacts, type PositionFacts } from './positionFacts';
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

export interface StoppedActions {
  moves: readonly StoppedMove[];
  onRemove: (move: StoppedMove) => void;
  onKeep: (move: StoppedMove) => void;
  /** Combien d'autres attendent ailleurs, et y aller. */
  others: number;
  onNext?: () => void;
}

export interface PositionPaneProps {
  side: Side;
  /** La ligne jouée sur l'échiquier ; au-delà de `node`, elle a quitté le répertoire. */
  path: readonly string[];
  node: MapNode;
  recent: OpeningTree;
  /** Les étapes de la séance qui tombent sur cette position. */
  steps: readonly SessionStep[];
  priority?: Priority;
  /** Le rang de la priorité montrée : celui de la carte, ou celui de la tâche hors du répertoire. */
  priorityRank?: number;
  /** Combien de priorités en tout, les deux camps ensemble. */
  priorityCount?: number;
  actions: StepActions;
  /** La carte mise en avant quand la position porte une décision et une priorité. */
  lead: 'settle' | 'priority';
  onLead: (lead: 'settle' | 'priority') => void;
  /** En séance, « Skip » remet la position à plus tard. */
  onSkip?: () => void;
  onNextPriority?: () => void;
  /** Construire depuis la position de l'échiquier, dans ou hors du répertoire. */
  onExtend: () => void;
  /** Retirer du répertoire le coup du joueur qui a mené ici, et sa suite. */
  onRemove?: () => void;
  /** L'adresse d'une partie d'entraînement qui part de cette position. */
  practise?: string;
  /** Les coups de cette position que le joueur ne joue plus, proposés au retrait. */
  stopped?: StoppedActions;
  /** Construire depuis une ligne de la priorité : la sienne, ou celle où elle perd ses points. */
  onPrepareFollows?: (line: readonly string[]) => void;
  onMove: (san: string) => void;
  /** Aller à une ligne entière : revenir au répertoire depuis un écart. */
  onJump: (path: readonly string[]) => void;
  onBack?: () => void;
}

// Un écart de score sur moins de parties ne dit rien : on ne recommande pas sur du bruit.
const MIN_GAMES_TO_COMPARE = 5;
const SHOWN_MOVES = 4;

/** Le volet : on y joue comme sur l'explorateur Lichess, et on y tranche ce que la position porte. */
export function PositionPane(props: PositionPaneProps) {
  const { side, path, node, steps, priority, actions, onLead, onSkip, onNextPriority, onExtend, onRemove, onPrepareFollows, onMove, onJump, onBack } = props;
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const facts = usePositionFacts(props);
  const { inRepertoire, ply, arrows, suggestions, prioritised, settling } = facts;
  // Une seule carte par position : la décision passe d'abord, la priorité n'y est qu'une ligne.
  const card = settling || prioritised;

  return (
    <aside aria-label="Position" className="flex flex-col gap-4">
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
      {/* Borné par la hauteur : la carte à trancher reste visible sous l'échiquier sans défiler. */}
      <div className={`order-2 mx-auto w-full ${card || props.stopped?.moves.length ? 'max-w-[max(16rem,min(100%,calc(100dvh_-_36rem)))]' : 'max-w-[max(16rem,min(100%,calc(100dvh_-_28rem)))]'}`}>
        <PlayableBoard path={path} flipped={side === 'b'} arrows={arrows} suggestions={suggestions} onMove={onMove} />
      </div>
      {settling && (
        <div className="order-3">
          <SettleCard steps={steps} facts={facts} actions={actions} onSkip={onSkip} rank={props.priorityRank ?? node.priority} />
        </div>
      )}
      {prioritised && !settling && (
        <div className="order-3">
          <PriorityCard side={side} priority={priority!} rank={props.priorityRank ?? node.priority!} total={props.priorityCount} facts={facts} waiting={steps.length} onLead={onLead} onNextPriority={onNextPriority} onPrepareFollows={onPrepareFollows} />
        </div>
      )}
      {props.stopped && props.stopped.moves.length > 0 && (
        <div className="order-3">
          <StoppedCard stopped={props.stopped} ply={node.path.length + 1} />
        </div>
      )}
      <Repertoire side={side} node={node} inRepertoire={inRepertoire} ply={ply} onMove={onMove} />
      {!inRepertoire ? (
        <div className="order-5">
          <OffRepertoire path={path} node={node} facts={facts} onExtend={onExtend} onJump={onJump} />
        </div>
      ) : (
        !(prioritised && !settling && onPrepareFollows) && (
          <div className="order-5">
            <Action onClick={onExtend}>Extend from here</Action>
          </div>
        )
      )}
      {props.practise && (
        <div className="order-6">
          <PractiseLink href={props.practise} />
        </div>
      )}
      {onRemove && (
        <div className="order-6">
          <RemoveMove path={path} onRemove={onRemove} />
        </div>
      )}
      <p className="order-7 hidden px-1 text-[12px] lg:block" style={{ color: COLOURS.leafSoft }}>
        Play on the board or click the map. Keys: ← back · → main move · ↑ ↓ other moves · Home start · + − fold.
      </p>
    </aside>
  );
}

/** Les décisions de la position : ce qui a été joué, ce que dit le score, et les deux ou trois issues. */
export function SettleCard({ steps, facts, actions, onSkip, rank }: { steps: readonly SessionStep[]; facts: PositionFacts; actions: StepActions; onSkip?: () => void; rank?: number }) {
  const { ply, here, prioritised, average } = facts;
  return (
    <section aria-label="To settle" className="flex flex-col gap-3 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.paper, boxShadow: `inset 0 0 0 1.5px ${COLOURS.terracotta}` }}>
      <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: COLOURS.terracotta }}>
        To settle
      </span>
      {steps.map((step, index) => (
        <Step key={step.key} step={step} ply={ply} here={here} actions={actions} onSkip={index === steps.length - 1 ? onSkip : undefined} />
      ))}
      {prioritised && (
        <p className="border-t pt-2.5 text-[13px]" style={{ borderColor: COLOURS.sand, color: COLOURS.leafSoft }}>
          <strong style={{ color: COLOURS.leaf }}>Also weak opening {rank}:</strong> you score {here ? Math.round(scoreRate(here) * 100) : '—'}% here, {Math.round(average * 100)}% on average.
        </p>
      )}
    </section>
  );
}

export function PriorityCard({ side, priority, rank, total, facts, waiting, onLead, onNextPriority, onPrepareFollows }: {
  side: Side;
  priority: Priority;
  rank: number;
  total?: number;
  facts: PositionFacts;
  /** Les décisions qui attendent sur la même position. */
  waiting: number;
  onLead: (lead: 'settle' | 'priority') => void;
  onNextPriority?: () => void;
  onPrepareFollows?: (line: readonly string[]) => void;
}) {
  const { average, leak } = facts;
  return (
    <section aria-label="Weak opening" className="flex flex-col gap-2.5 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: COLOURS.apricot }}>
          Weak opening {rank}
          {total ? ` of ${total}` : ''}
        </span>
        {onNextPriority && (
          <button type="button" onClick={onNextPriority} className="-my-1 rounded-lg px-1 py-1 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2">
            Next weak opening →
          </button>
        )}
      </span>
      <PriorityVerdict priority={priority} average={average} leak={leak} />
      {onPrepareFollows && (
        <Action onClick={() => onPrepareFollows(leak ? [...priority.path, leak.san!] : priority.path)} tone="light">
          {leak
            ? `Prepare my moves after ${figurineMove(leak.san!, priority.path.length + 1)}`
            : isPlayerMove(side, priority.path.length + 1)
              ? `Prepare my moves after ${figurineMove(priority.path[priority.path.length - 1], priority.path.length)}`
              : `Prepare against their replies after ${figurineMove(priority.path[priority.path.length - 1], priority.path.length)}`}
        </Action>
      )}
      {waiting > 0 && (
        <button type="button" onClick={() => onLead('settle')} className="self-start rounded-lg py-1 text-[14px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.apricot }}>
          Also {waiting} to settle here →
        </button>
      )}
    </section>
  );
}

/** Hors du répertoire : où il s'arrête, ce que la position a donné, et comment y revenir ou l'étendre. */
export function OffRepertoire({ path, node, facts, onExtend, onJump }: { path: readonly string[]; node: MapNode; facts: PositionFacts; onExtend: () => void; onJump: (path: readonly string[]) => void }) {
  const { here, leftByPlayer, usual } = facts;
  const left = figurineMove(path[node.path.length], node.path.length + 1);
  return (
    <section aria-label="Off your repertoire" className="flex flex-col gap-2.5 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.paper }}>
      <p className="leading-snug">
        <strong style={{ color: COLOURS.terracotta }}>Off your repertoire</strong> since {left}.{' '}
        <span style={{ color: COLOURS.leafSoft }}>
          {here ? `${here.games} ${here.games === 1 ? 'game' : 'games'} here in 12 months, you score ${Math.round(scoreRate(here) * 100)}%.` : 'Not reached in your last 12 months.'}
        </span>
      </p>
      {leftByPlayer && usual ? (
        // Le joueur a quitté son propre répertoire : on propose d'abord d'y revenir, l'ajout reste possible.
        <span className="flex flex-col gap-1.5">
          <Action onClick={() => onJump([...node.path, usual.san!])} tone="primary">
            Back to {figurineMove(usual.san!, node.path.length + 1)}
          </Action>
          <Action onClick={onExtend}>Add {left} too</Action>
        </span>
      ) : (
        <Action onClick={onExtend} tone="primary">
          Prepare this line
        </Action>
      )}
    </section>
  );
}

/** Un coup que le joueur ne joue plus : le retirer, ou le garder (il revient à la révision). */
export function StoppedCard({ stopped, ply }: { stopped: StoppedActions; ply: number }) {
  return (
    <section aria-label="No longer played" className="flex flex-col gap-3 rounded-2xl px-4 py-3.5 text-[14px]" style={{ background: COLOURS.paper, boxShadow: `inset 0 0 0 1.5px ${COLOURS.terracotta}` }}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: COLOURS.terracotta }}>
          No longer played
        </span>
        {stopped.onNext && (
          <button type="button" onClick={stopped.onNext} className="-my-1 rounded-lg px-1 py-1 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2">
            {stopped.others} more →
          </button>
        )}
      </span>
      {stopped.moves.map((move) => {
        const mine = figurineMove(move.san, ply);
        return (
          <div key={move.san} className="flex flex-col gap-2.5">
            <p className="text-[16px] leading-snug">
              You no longer play <strong>{mine}</strong>
            </p>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
                Your last {move.playedInstead.length} games here
              </span>
              <ul aria-label={`Your last ${move.playedInstead.length} games here`} className="flex flex-wrap gap-1.5">
                {move.playedInstead.map((san, index) => (
                  <li key={index} className="rounded-full px-2.5 py-0.5 text-[15px] font-bold" style={{ background: COLOURS.sand }}>
                    {figurine(san)}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
              Out of your review until you decide.
            </p>
            <span className="flex gap-2">
              <Action onClick={() => stopped.onRemove(move)} tone="primary">
                Remove {mine}
              </Action>
              <Action onClick={() => stopped.onKeep(move)}>Keep it</Action>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** S'entraîner depuis la position : une partie contre les coups de son niveau, comme depuis Home. */
export function PractiseLink({ href }: { href: string }) {
  return (
    <Link to={href} className="grid min-h-11 place-items-center rounded-xl px-3 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>
      Practise from here
    </Link>
  );
}

/** Discret : on retire rarement, et l'annulation suit dans le toast. */
export function RemoveMove({ path, onRemove }: { path: readonly string[]; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} className="self-start rounded px-1 py-1 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
      I no longer play {figurineMove(path[path.length - 1], path.length)}: remove it
    </button>
  );
}

function Repertoire({ side, node, inRepertoire, ply, onMove }: { side: Side; node: MapNode; inRepertoire: boolean; ply: number; onMove: (san: string) => void }) {
  const mine = isPlayerMove(side, ply);
  const [all, setAll] = useState(false);
  if (!inRepertoire) return null;
  const moves = [...node.children].sort((a, b) => b.games - a.games);
  const shown = all ? moves : moves.slice(0, SHOWN_MOVES);
  return (
    <div className="order-4 flex flex-col gap-1 px-1 text-[14px]">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {mine ? 'Your move here' : 'Their replies you have prepared'}
        {node.games > 0 && ` · ${node.games} ${node.games === 1 ? 'game' : 'games'} reached this in 12 months`}
      </span>
      {moves.length ? (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-bold" style={{ color: mine ? REPERTOIRE : COLOURS.leaf }}>
          {shown.map((child) => (
            <button key={child.key} type="button" onClick={() => onMove(child.san!)} title="Go to this move" className="whitespace-nowrap rounded px-0.5 underline-offset-4 hover:underline focus-visible:outline-2">
              {figurineMove(child.san!, ply)}
            </button>
          ))}
          {moves.length > shown.length && (
            <button type="button" onClick={() => setAll(true)} className="rounded px-0.5 underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
              +{moves.length - shown.length} more
            </button>
          )}
        </span>
      ) : (
        <span style={{ color: COLOURS.leafSoft }}>{mine ? 'Your repertoire stops here.' : 'No reply prepared yet.'}</span>
      )}
    </div>
  );
}

function PriorityVerdict({ priority, average, leak }: { priority: Priority; average: number; leak: OpeningNode | undefined }) {
  const ply = priority.path.length + 1;
  return (
    <>
      <span className="text-[15px] leading-snug">
        You score <strong>{Math.round(priority.score * 100)}%</strong> after {figurineMove(priority.path[ply - 2], ply - 1)}, <strong>{Math.round(average * 100)}%</strong> on average, over {priority.games} games this year.
      </span>
      {leak && (
        <span className="text-[14px] leading-snug">
          Worst reply: <strong>{figurineMove(leak.san!, ply)}</strong>, {Math.round(scoreRate(leak) * 100)}% in {leak.games} games.
        </span>
      )}
    </>
  );
}

function Step({ step, ply, here, actions, onSkip }: { step: SessionStep; ply: number; here: OpeningNode | undefined; actions: StepActions; onSkip?: () => void }) {
  const left = step.kind === 'left';
  const played = figurineMove(step.played, ply);
  const planned = step.planned.map((san) => figurineMove(san, ply)).join(' · ');
  const factOf = (san: string) => here?.children.find((child) => child.san === san);
  const verdict = step.verdict;
  // Une étape jugée est une erreur : on garde le répertoire. Sans moteur, le score du joueur quand ses parties suffisent.
  const best = !left ? undefined : verdict ? verdict.best : betterMove(step, factOf);
  const judgement = verdict?.judgement;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[15px] leading-snug">
        {left ? 'You played' : 'They played'}{' '}
        <strong>
          {played}
          {judgement && (
            <span title={judgement} style={{ color: COLOURS.terracotta }}>
              {JUDGEMENT_MARK[judgement]}
            </span>
          )}
        </strong>
        {left ? (
          <>
            , not <strong style={{ color: REPERTOIRE }}>{planned}</strong>.
          </>
        ) : (
          ': no answer yet.'
        )}
      </p>
      {/* Sans coup du répertoire à mettre en face, le tableau répéterait la phrase. */}
      {left && (
        <table aria-label="Facts" className="w-full text-[13px]">
          <thead className="text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            <tr>
              <th className="sr-only">Move</th>
              <th className="pb-1 pr-2 text-right font-semibold" colSpan={2}>
                12 months · your score
              </th>
              <th className="pb-1 text-right font-semibold">Engine</th>
            </tr>
          </thead>
          <tbody>
            <Fact move={played} node={factOf(step.played)} cp={verdict?.cp.get(step.played)} />
            {step.planned.map((san) => <Fact key={san} move={figurineMove(san, ply)} node={factOf(san)} cp={verdict?.cp.get(san)} repertoire />)}
          </tbody>
        </table>
      )}
      {left ? (
        <div className="flex flex-col gap-1.5">
          <span className="grid grid-cols-2 gap-1.5">
            <Action onClick={() => actions.onAdd(step)} tone={best === step.played ? 'primary' : 'plain'}>
              Add {played}
            </Action>
            <Action onClick={() => actions.onStay(step)} tone={best && best !== step.played ? 'primary' : 'plain'}>
              Keep {step.planned.length === 1 ? planned : 'mine'}
            </Action>
          </span>
          <span className="flex flex-wrap items-center justify-between gap-x-3">
            <button type="button" onClick={() => actions.onBuild(step)} className="rounded-lg py-1.5 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
              Add it and prepare what follows →
            </button>
            {onSkip && <Skip onSkip={onSkip} />}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="grid grid-cols-2 gap-1.5">
            <Action onClick={() => actions.onPrepare(step)} tone="primary">
              Prepare a reply
            </Action>
            <Action onClick={() => actions.onStay(step)}>Not worth it</Action>
          </span>
          {onSkip && (
            <span className="flex justify-end">
              <Skip onSkip={onSkip} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Skip({ onSkip }: { onSkip: () => void }) {
  return (
    <button type="button" onClick={onSkip} className="rounded-lg px-2 py-1.5 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
      Skip for now
    </button>
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

function Fact({ move, node, cp, repertoire = false }: { move: string; node: OpeningNode | undefined; cp: number | undefined; repertoire?: boolean }) {
  // Sous ce nombre de parties, le score ne dit rien : on le grise plutôt que de l'expliquer.
  const thin = !node || node.games < MIN_GAMES_TO_COMPARE;
  return (
    <tr style={{ borderTop: `1px solid ${COLOURS.sand}` }}>
      <td className="py-1 pr-2 font-extrabold" style={{ color: repertoire ? REPERTOIRE : undefined }}>
        {move}
      </td>
      <td className="py-1 pr-2 text-right tabular-nums" style={{ color: COLOURS.leafSoft }}>
        {node ? `${node.games} ${node.games === 1 ? 'game' : 'games'}` : 'not played'}
      </td>
      <td className="w-14 py-1 pr-2 text-right font-bold tabular-nums" style={{ opacity: thin ? 0.45 : 1 }} title={thin ? `Fewer than ${MIN_GAMES_TO_COMPARE} games: too few to compare` : 'Your score'}>
        {node ? `${Math.round(scoreRate(node) * 100)}%` : '—'}
      </td>
      <td className="w-14 py-1 text-right font-bold tabular-nums" title="Engine, for you, after this move">
        {cp === undefined ? '—' : formatCp(cp)}
      </td>
    </tr>
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
      className="w-full rounded-xl px-3 py-2.5 text-[15px] font-bold leading-tight focus-visible:outline-2 focus-visible:outline-offset-2"
      style={style}
    >
      {children}
    </motion.button>
  );
}
