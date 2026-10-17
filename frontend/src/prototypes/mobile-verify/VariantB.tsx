// PROTOTYPE JETABLE — B « Séance » : la notification ouvre directement une pile de positions,
// le contexte de la partie n'est révélé qu'après le coup joué.
import { useMemo, useState } from 'react';
import type { Side } from '../../features/openings/domain/playedGame';
import { useElementWidth } from '../../features/openings/flame/useElementWidth';
import { replayLine } from '../../features/openings/position/replay';
import { StaticBoard } from '../../shared/components/Board';
import { isPlayerTurn, proposePreparation, scoreRate, type MobileData, type MoveStat, type ScenarioKey } from './checks';
import { formatFrom, moveNumber, RESULT_LABEL, SIDE_LABEL, useLineName } from './lineName';
import { LockScreen } from './Phone';
import { PlayMove } from './PlayMove';

export const name = 'Session';

type Card =
  | { kind: 'drill'; tag: string; side: Side; path: string[]; expected: string; reveal?: { played: MoveStat; expected: MoveStat } }
  | { kind: 'proposal'; side: Side; path: string[] };

export function VariantB({ data, scenario }: { data: MobileData; scenario: ScenarioKey }) {
  const initialDeck = useMemo(() => buildDeck(data, scenario), [data, scenario]);
  const [deck, setDeck] = useState(initialDeck);
  const [index, setIndex] = useState(-1);
  const [solved, setSolved] = useState(false);
  const [firstTry, setFirstTry] = useState(0);

  if (index === -1) {
    const fromGame = deck.filter((card) => card.kind === 'proposal' || card.tag !== 'Review').length;
    const body =
      scenario === 'quiet'
        ? `Daily session · ${deck.length} positions`
        : scenario === 'left'
          ? `${fromGame} position from your last game + ${deck.length - fromGame} to review`
          : 'Your last game left all your prep. Proposed prep ready.';
    return <LockScreen notification={{ title: 'Kumquat', body, when: scenario === 'quiet' ? '9:00' : 'now' }} onOpen={() => setIndex(0)} />;
  }

  if (index >= deck.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <span className="font-display text-5xl text-primary">{firstTry}/{deck.filter((c) => c.kind === 'drill').length}</span>
        <span className="text-sm text-text-muted">first try</span>
        <div className="flex gap-3 text-sm">
          <span className="rounded-full bg-primary-light px-3 py-1 text-primary-dark">4-day streak</span>
          <span className="rounded-full bg-bg-card px-3 py-1 text-text-muted ring-1 ring-border">Next · tomorrow</span>
        </div>
      </div>
    );
  }

  const card = deck[index];
  const next = () => {
    setIndex(index + 1);
    setSolved(false);
  };

  return (
    <div className="flex h-full flex-col px-4 pb-6 pt-12">
      <div className="mb-4 flex gap-1">
        {deck.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-primary' : i === index ? 'bg-primary/50' : 'bg-border'}`} />
        ))}
      </div>

      {card.kind === 'proposal' ? (
        <ProposalCard
          data={data}
          card={card}
          onKeep={(drills) => {
            setDeck([...deck.slice(0, index + 1), ...drills, ...deck.slice(index + 1)]);
            next();
          }}
          onSkip={next}
        />
      ) : (
        <DrillCard
          key={index}
          card={card}
          solved={solved}
          onSolved={(first) => {
            setSolved(true);
            if (first) setFirstTry((n) => n + 1);
          }}
          onNext={next}
        />
      )}
    </div>
  );
}

function buildDeck(data: MobileData, scenario: ScenarioKey): Card[] {
  const review: Card[] = data.review.map((card) => ({
    kind: 'drill',
    tag: 'Review',
    side: card.side,
    path: card.path,
    expected: card.expected.san,
  }));
  if (scenario === 'quiet') return review;
  if (scenario === 'left') {
    const { game, check } = data.left;
    return [
      {
        kind: 'drill',
        tag: `Last game · ${RESULT_LABEL[game.score]}`,
        side: game.side,
        path: game.moves.slice(0, check.ply),
        expected: check.expected.san,
        reveal: { played: check.played, expected: check.expected },
      },
      ...review.slice(0, 4),
    ];
  }
  const { game, check } = data.none;
  return [{ kind: 'proposal', side: game.side, path: game.moves.slice(0, check.ply) }, ...review.slice(0, 3)];
}

function DrillCard({
  card,
  solved,
  onSolved,
  onNext,
}: {
  card: Extract<Card, { kind: 'drill' }>;
  solved: boolean;
  onSolved: (firstTry: boolean) => void;
  onNext: () => void;
}) {
  const name = useLineName(card.path);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <span className="self-start rounded-full bg-primary-light px-2.5 py-0.5 text-xs text-primary-dark">{card.tag}</span>
      <span className="flex flex-col">
        <span className="font-display text-xl text-text">Your prep move?</span>
        <span className="text-sm text-text-muted">
          {name} · {SIDE_LABEL[card.side]}
        </span>
      </span>
      <PlayMove side={card.side} path={card.path} expected={card.expected} onSolved={onSolved} />
      {solved && card.reveal ? (
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 rounded-xl bg-bg-card p-3 text-sm ring-1 ring-border">
          <span className="text-text-muted">In your game</span>
          <span className="font-mono text-danger">{card.reveal.played.san}</span>
          <span className="text-right text-text-muted">{scoreRate(card.reveal.played)}% score</span>
          <span className="text-text-muted">Your prep</span>
          <span className="font-mono text-success">{card.reveal.expected.san}</span>
          <span className="text-right text-text-muted">{scoreRate(card.reveal.expected)}% score</span>
        </div>
      ) : null}
      {solved ? (
        <button onClick={onNext} className="mt-auto rounded-2xl bg-primary py-3.5 font-medium text-white">
          Continue
        </button>
      ) : null}
    </div>
  );
}

function ProposalCard({
  data,
  card,
  onKeep,
  onSkip,
}: {
  data: MobileData;
  card: Extract<Card, { kind: 'proposal' }>;
  onKeep: (drills: Card[]) => void;
  onSkip: () => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const name = useLineName(card.path);
  const proposal = useMemo(() => proposePreparation(data.stats, card.side, card.path), [data, card]);
  const fens = useMemo(() => replayLine(card.path).fens, [card.path]);
  const line = [...card.path, ...proposal.moves];

  const keep = () => {
    const drills: Card[] = [];
    for (let ply = card.path.length; ply < line.length; ply++) {
      if (!isPlayerTurn(card.side, ply)) continue;
      drills.push({ kind: 'drill', tag: 'New line', side: card.side, path: line.slice(0, ply), expected: line[ply] });
    }
    onKeep(drills);
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <span className="self-start rounded-full bg-warning-light px-2.5 py-0.5 text-xs text-primary-dark">
        No prep · move {moveNumber(card.path.length)}
      </span>
      <span className="font-display text-lg text-text">{name}</span>
      <div ref={ref} style={{ height: width }}>
        <StaticBoard fen={fens[fens.length - 1]} orientation={card.side === 'w' ? 'white' : 'black'} />
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-bg-card p-3">
        <span className="text-xs uppercase tracking-wide text-text-muted">Proposed prep · your usual moves</span>
        <span className="font-mono text-sm text-text">{formatFrom(line, card.path.length)}</span>
        <span className="text-xs text-text-muted">Covers {proposal.coverage} of your games</span>
      </div>
      <div className="mt-auto flex gap-2">
        <button onClick={onSkip} className="flex-1 rounded-2xl border border-border py-3.5 text-text-muted">
          Later
        </button>
        <button onClick={keep} className="flex-[2] rounded-2xl bg-primary py-3.5 font-medium text-white">
          Keep & learn
        </button>
      </div>
    </div>
  );
}
