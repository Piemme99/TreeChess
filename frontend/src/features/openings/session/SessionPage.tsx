import { MotionConfig, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BuildSession } from '../checks/BuildSession';
import type { AddedMove } from '../domain/addition';
import { figurineMove } from '../domain/notation';
import { buildOpeningTree, nodeAt, type OpeningNode } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame } from '../domain/playedGame';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import type { SessionStep } from './steps';
import { useReplayedSession } from './useReplayedSession';

const RECENT_MONTHS = 12;
const MAX_PLIES = 24;

export function SessionPage() {
  useWorkshopFont();
  const { replay, known, repertoires, steps, add, ignore } = useReplayedSession();
  // La séance parcourt les positions connues à son ouverture : un ajout peut en régler d'autres en route.
  const [queue] = useState(() => steps.map((step) => step.key));
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [building, setBuilding] = useState<{ keep: boolean } | null>(null);
  const live = new Map(steps.map((step) => [step.key, step]));
  const current = queue.find((key) => !done.has(key) && live.has(key));
  const step = current ? live.get(current) : undefined;
  const habits = useMemo(() => known.filter((game) => game.side === step?.side), [known, step?.side]);

  const finish = (key: string) => {
    setDone((settled) => new Set(settled).add(key));
    setBuilding(null);
  };
  const accept = (moves: AddedMove[]) => {
    if (!step) return;
    add({ side: step.side, addedAt: replay.day, moves });
    finish(step.key);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-20" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <header className="mx-auto flex max-w-[30rem] items-center justify-between px-4 pt-5 text-[15px] font-semibold">
          <Link to="/dev/home" style={{ color: COLOURS.leafSoft }}>
            ← Home
          </Link>
          {step && (
            <span aria-label="Progress" style={{ color: COLOURS.leafSoft }}>
              {queue.indexOf(step.key) + 1} / {queue.length}
            </span>
          )}
        </header>
        {!step ? (
          <Done settled={done.size} />
        ) : building ? (
          <BuildSession
            key={`${step.key} ${building.keep}`}
            checked={step.games[0]}
            games={habits}
            repertoire={repertoires[step.side]}
            keep={building.keep}
            onAccept={accept}
            onCancel={() => setBuilding(null)}
          />
        ) : (
          <Step
            key={step.key}
            step={step}
            known={known}
            day={replay.day}
            onKeep={() => setBuilding({ keep: true })}
            onPrepare={() => setBuilding({ keep: false })}
            onStay={() => {
              step.games.forEach((checked) => ignore(checked.id));
              finish(step.key);
            }}
            onSkip={() => finish(step.key)}
          />
        )}
      </div>
    </MotionConfig>
  );
}

interface StepProps {
  step: SessionStep;
  known: readonly PlayedGame[];
  day: string;
  onKeep: () => void;
  onPrepare: () => void;
  onStay: () => void;
  onSkip: () => void;
}

function Step({ step, known, day, onKeep, onPrepare, onStay, onSkip }: StepProps) {
  const ply = step.path.length + 1;
  const played = figurineMove(step.played, ply);
  const planned = step.planned.map((san) => figurineMove(san, ply)).join(' · ');
  const node = useMemo(() => {
    const recent = gamesOfLastMonths(known, RECENT_MONTHS, new Date(day));
    return nodeAt(buildOpeningTree(recent, step.side, MAX_PLIES), step.path);
  }, [known, day, step.side, step.path]);
  const factOf = (san: string) => node?.children.find((child) => child.san === san);
  const arrows = useMemo(
    (): BoardArrow[] => [
      ...step.planned.map((san): BoardArrow => ({ san, kind: 'repertoire', share: 0.5 })),
      { san: step.played, kind: 'neutral', share: 0.5, emphasis: true },
    ],
    [step],
  );
  const games = step.games.length;
  const left = step.kind === 'left';

  return (
    <main className="mx-auto flex max-w-[30rem] flex-col gap-4 px-4 pt-4">
      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">
        {left ? 'You played' : 'They played'} {played}
        <span className="block text-[15px] font-semibold tracking-normal" style={{ color: COLOURS.leafSoft }}>
          in {games} {games === 1 ? 'game' : 'games'}
          {left ? `, your repertoire has ${planned}` : ', your repertoire does not prepare it'}
        </span>
      </h1>
      <ArrowBoard path={step.path} flipped={step.side === 'b'} arrows={arrows} />
      <ul aria-label="Facts" className="flex flex-col gap-1 px-1 text-[14px]">
        <Fact move={played} node={factOf(step.played)} who={left ? 'you' : 'they'} />
        {left &&
          step.planned.map((san) => (
            <Fact key={san} move={figurineMove(san, ply)} node={factOf(san)} who="you" repertoire />
          ))}
      </ul>
      <div className="flex flex-col gap-2 pt-1">
        {left ? (
          <>
            <Action onClick={onKeep} primary>
              Keep {played}
            </Action>
            <Action onClick={onStay}>Stay on {step.planned.length === 1 ? planned : 'my repertoire'}</Action>
          </>
        ) : (
          <Action onClick={onPrepare} primary>
            Prepare an answer
          </Action>
        )}
        <button type="button" onClick={onSkip} className="self-center px-3 py-1.5 text-[15px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          Skip
        </button>
      </div>
    </main>
  );
}

interface FactProps {
  move: string;
  node: OpeningNode | undefined;
  who: 'you' | 'they';
  repertoire?: boolean;
}

function Fact({ move, node, who, repertoire = false }: FactProps) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-extrabold" style={{ color: repertoire ? REPERTOIRE : undefined }}>
        {move}
      </span>
      {repertoire && (
        <span className="text-[12px] font-bold" style={{ color: REPERTOIRE }}>
          repertoire
        </span>
      )}
      <span style={{ color: COLOURS.leafSoft }}>
        {node
          ? `${node.games} ${node.games === 1 ? 'game' : 'games'} in 12 months · ${who === 'you' ? '' : 'you score '}${Math.round(scoreRate(node) * 100)}%`
          : 'not played in 12 months'}
      </span>
    </li>
  );
}

function Action({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="w-full rounded-2xl px-4 py-3 text-[17px] font-bold"
      style={primary ? raised(true) : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}

function Done({ settled }: { settled: number }) {
  return (
    <main className="mx-auto flex max-w-[30rem] flex-col items-start gap-3 px-4 pt-10">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Done for today</h1>
      <p style={{ color: COLOURS.leafSoft }}>
        {settled} {settled === 1 ? 'position' : 'positions'} gone through.
      </p>
      <Link to="/dev/home" className="rounded-full px-4 py-2 font-bold" style={raised(true)}>
        Home
      </Link>
    </main>
  );
}
