// PROTOTYPE JETABLE — A « Debrief » : la notification ouvre la partie, l'exercice vient après le contexte.
import { useState } from 'react';
import type { PlayedGame } from '../../features/openings/domain/playedGame';
import { formatMove } from '../../features/openings/domain/notation';
import {
  proposePreparation,
  scoreRate,
  type GameCheck,
  type MobileData,
  type MoveStat,
  type ScenarioKey,
} from './checks';
import { formatFrom, moveNumber, RESULT_LABEL, SIDE_LABEL, useLineName } from './lineName';
import { AppBar, LockScreen } from './Phone';
import { PlayMove } from './PlayMove';

export const name = 'Debrief';

type Screen = 'lock' | 'game' | 'home' | 'review' | 'done';

export function VariantA({ data, scenario }: { data: MobileData; scenario: ScenarioKey }) {
  const [screen, setScreen] = useState<Screen>('lock');
  const featured = scenario === 'left' ? data.left : data.none;
  const openingName = useLineName(featured.game.moves.slice(0, featured.check.ply));
  const lastGames = scenario === 'quiet' ? data.recent : [featured, ...data.recent.slice(0, 5)];

  if (screen === 'lock') {
    const notification =
      scenario === 'quiet'
        ? { title: 'Kumquat', body: `${data.review.length} positions to review · 2 min`, when: '9:00' }
        : featured.check.kind === 'left-preparation'
          ? {
              title: `${openingName} · ${RESULT_LABEL[featured.game.score]}`,
              body: `Move ${moveNumber(featured.check.ply)}: you played ${featured.check.played.san}, your prep says ${featured.check.expected.san}.`,
              when: 'now',
            }
          : {
              title: `${openingName} · ${RESULT_LABEL[featured.game.score]}`,
              body: `No prep after ${formatMove(featured.game.moves[featured.check.ply - 1], featured.check.ply)}. Proposed prep ready, built from your games.`,
              when: 'now',
            };
    return <LockScreen notification={notification} onOpen={() => setScreen(scenario === 'quiet' ? 'home' : 'game')} />;
  }

  if (screen === 'game') {
    return <GameDebrief data={data} game={featured.game} check={featured.check} onDone={() => setScreen('home')} />;
  }

  if (screen === 'review') {
    return <Review data={data} onDone={() => setScreen('done')} onBack={() => setScreen('home')} />;
  }

  return (
    <>
      <AppBar title="Kumquat" />
      <div className="flex flex-col gap-5 p-4">
        {screen === 'done' ? (
          <p className="rounded-xl bg-success-light p-3 text-sm text-success">✓ Review done · next tomorrow</p>
        ) : (
          <button
            onClick={() => setScreen('review')}
            className="flex items-center justify-between rounded-2xl bg-primary p-4 text-left text-white shadow-md"
          >
            <span className="flex flex-col">
              <span className="font-display text-lg">Review</span>
              <span className="text-sm text-white/80">{data.review.length} positions · 2 min</span>
            </span>
            <span className="text-2xl">›</span>
          </button>
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-text-muted">Last games</h2>
          {lastGames.map(({ game, check }, index) => (
            <RecentGame key={index} game={game} check={check} />
          ))}
        </section>
      </div>
    </>
  );
}

function RecentGame({ game, check }: { game: PlayedGame; check: GameCheck }) {
  const name = useLineName(game.moves.slice(0, 8));
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-bg-card px-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-text">{name}</span>
        <span className="text-xs text-text-muted">
          {SIDE_LABEL[game.side]} · {RESULT_LABEL[game.score]}
        </span>
      </span>
      <CheckBadge game={game} check={check} />
    </div>
  );
}

// Une partie gagnée hors préparation mérite moins l'attention : le badge s'efface.
function CheckBadge({ game, check }: { game: PlayedGame; check: GameCheck }) {
  if (check.kind === 'followed') return <span className="shrink-0 text-xs text-success">In prep</span>;
  const move = formatMove(game.moves[check.ply], check.ply + 1);
  const label = check.kind === 'left-preparation' ? `Off prep · ${move}` : `No prep · ${move}`;
  const tone =
    game.score === 1
      ? 'bg-border/60 text-text-muted'
      : check.kind === 'left-preparation'
        ? 'bg-danger-light text-danger'
        : 'bg-warning-light text-primary-dark';
  return <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs ${tone}`}>{label}</span>;
}

interface GameDebriefProps {
  data: MobileData;
  game: PlayedGame;
  check: MobileData['left']['check'] | MobileData['none']['check'];
  onDone: () => void;
}

function GameDebrief({ data, game, check, onDone }: GameDebriefProps) {
  const [step, setStep] = useState<'read' | 'play' | 'solved'>('read');
  const [kept, setKept] = useState(false);
  const before = game.moves.slice(0, check.ply);
  const name = useLineName(before);
  const proposal = check.kind === 'no-preparation' ? proposePreparation(data.stats, game.side, before) : null;
  const expected = check.kind === 'left-preparation' ? check.expected.san : proposal!.moves[0];

  return (
    <>
      <AppBar title="Last game" onBack={onDone} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col">
          <span className="font-display text-xl text-text">{name}</span>
          <span className="text-sm text-text-muted">
            {SIDE_LABEL[game.side]} · {RESULT_LABEL[game.score]} · Blitz
          </span>
        </div>

        <MoveList moves={game.moves.slice(0, 16)} pivot={check.ply} kind={check.kind} />

        {check.kind === 'left-preparation' ? (
          <div className="grid grid-cols-2 gap-2">
            <MoveTile label="You played" stat={check.played} tone="danger" />
            <MoveTile label="Your prep" stat={check.expected} tone="success" />
          </div>
        ) : (
          <ProposalCard
            proposal={proposal!}
            kept={kept}
            onKeep={() => {
              setKept(true);
              setStep('play');
            }}
          />
        )}

        {step === 'read' && check.kind === 'left-preparation' ? (
          <button onClick={() => setStep('play')} className="rounded-xl bg-primary py-3 font-medium text-white">
            Play it again
          </button>
        ) : null}

        {step !== 'read' ? (
          <PlayMove side={game.side} path={before} expected={expected} onSolved={() => setStep('solved')} />
        ) : null}

        {step === 'solved' ? (
          <button onClick={onDone} className="rounded-xl bg-primary py-3 font-medium text-white">
            Done
          </button>
        ) : null}
      </div>
    </>
  );
}

function MoveList({ moves, pivot, kind }: { moves: string[]; pivot: number; kind: GameCheck['kind'] }) {
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 font-mono text-sm">
      {moves.map((san, index) => {
        const label = index % 2 === 0 ? formatMove(san, index + 1) : san;
        const marked = kind === 'left-preparation' ? pivot : pivot - 1;
        const tone =
          index < marked
            ? 'text-text'
            : index === marked
              ? kind === 'left-preparation'
                ? 'rounded bg-danger-light px-1 text-danger'
                : 'rounded bg-warning-light px-1 text-primary-dark'
              : 'text-text-light/60';
        return (
          <span key={index} className={tone}>
            {label}
          </span>
        );
      })}
    </p>
  );
}

function MoveTile({ label, stat, tone }: { label: string; stat: MoveStat; tone: 'danger' | 'success' }) {
  const colors = tone === 'danger' ? 'border-danger/30 bg-danger-light/50' : 'border-success/30 bg-success-light/60';
  return (
    <div className={`flex flex-col rounded-xl border p-3 ${colors}`}>
      <span className="text-xs uppercase tracking-wide text-text-muted">{label}</span>
      <span className="font-mono text-xl text-text">{stat.san}</span>
      <span className="text-xs text-text-muted">
        {scoreRate(stat)}% score · {stat.games} games
      </span>
    </div>
  );
}

function ProposalCard({
  proposal,
  kept,
  onKeep,
}: {
  proposal: ReturnType<typeof proposePreparation>;
  kept: boolean;
  onKeep: () => void;
}) {
  const line = formatFrom([...proposal.start, ...proposal.moves], proposal.start.length);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary-light p-4">
      <span className="text-xs uppercase tracking-wide text-primary-dark">No prep here · proposed prep</span>
      <span className="font-mono text-sm text-text">{line}</span>
      <span className="text-xs text-text-muted">Your usual moves · covers {proposal.coverage} of your games</span>
      {kept ? (
        <span className="text-sm font-medium text-success">✓ Kept</span>
      ) : (
        <div className="flex gap-2">
          <button onClick={onKeep} className="flex-1 rounded-xl bg-primary py-2.5 font-medium text-white">
            Keep
          </button>
          <button className="flex-1 rounded-xl border border-border py-2.5 text-text-muted">Later</button>
        </div>
      )}
    </div>
  );
}

function Review({ data, onDone, onBack }: { data: MobileData; onDone: () => void; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const card = data.review[index];
  const name = useLineName(card.path);
  const next = () => {
    if (index + 1 >= data.review.length) return onDone();
    setIndex(index + 1);
    setSolved(false);
  };

  return (
    <>
      <AppBar title={`Review ${index + 1}/${data.review.length}`} onBack={onBack} />
      <div className="flex flex-col gap-3 p-4">
        <span className="text-sm text-text-muted">
          {name} · {SIDE_LABEL[card.side]}
        </span>
        <PlayMove key={index} side={card.side} path={card.path} expected={card.expected.san} onSolved={() => setSolved(true)} />
        {solved ? (
          <button onClick={next} className="rounded-xl bg-primary py-3 font-medium text-white">
            Next
          </button>
        ) : null}
      </div>
    </>
  );
}
