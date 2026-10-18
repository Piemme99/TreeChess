import { useMemo, useState } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { movesAt, studyLine, type LineStep, type PlayedMove } from '../domain/line';
import { formatLine, formatMove } from '../domain/notation';
import { isPlayerMove, type OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { formatPercent } from '../flame/format';
import { replayLine } from '../position/replay';
import { COLOURS, raised, tile } from '../workshop/theme';

interface LineViewProps {
  tree: OpeningTree;
  path: readonly string[];
  onBack: () => void;
  onOpen: (path: readonly string[]) => void;
}

export function LineView({ tree, path, onBack, onOpen }: LineViewProps) {
  const { steps, entry } = useMemo(() => studyLine(tree, path), [tree, path]);
  const [focus, setFocus] = useState(entry);
  const average = playerAverage(tree);
  const entryStep = steps[entry - 1];

  const focusPath = useMemo(() => steps.slice(0, focus).map((step) => step.san), [steps, focus]);
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const moves = movesAt(tree, focusPath, steps[focus]?.san);
  const playerToMove = isPlayerMove(tree.side, focus + 1);

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-full px-3 py-1 text-[13px] font-semibold"
          style={tile(COLOURS.sand)}
        >
          ← Openings
        </button>
        <h1 className="flex flex-col gap-1">
          <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em]">{opening?.name ?? 'Unnamed line'}</span>
          <span className="text-[15px] font-medium" style={{ color: COLOURS.leafSoft }}>
            {formatLine(path)}
          </span>
        </h1>
        <p className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {tree.side === 'w' ? 'White' : 'Black'} · {entryStep?.games ?? 0} games ·{' '}
          <span className="font-bold" style={{ color: COLOURS.leaf }}>
            {entryStep ? formatPercent(entryStep.rate) : '—'}
          </span>{' '}
          vs {formatPercent(average)} average · Last 12 months
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,26rem)_1fr] items-start gap-10">
        <div className="sticky top-6 flex flex-col gap-3">
          <WorkshopBoard path={focusPath} flipped={tree.side === 'b'} />
          <p className="px-1 text-[15px] font-semibold">{focus === 0 ? 'Start' : formatMove(steps[focus - 1].san, focus)}</p>
        </div>

        <div className="flex flex-col gap-10">
          <ScoreProfile steps={steps} entry={entry} average={average} focus={focus} onFocus={setFocus} />
          <MovesHere
            moves={moves.shown}
            hidden={moves.hidden}
            ply={focus + 1}
            playerToMove={playerToMove}
            average={average}
            onFollow={() => setFocus(focus + 1)}
            onOpen={(san) => onOpen([...focusPath, san])}
          />
        </div>
      </div>
    </section>
  );
}

interface ScoreProfileProps {
  steps: readonly LineStep[];
  entry: number;
  average: number;
  focus: number;
  onFocus: (ply: number) => void;
}

function ScoreProfile({ steps, entry, average, focus, onFocus }: ScoreProfileProps) {
  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-3">
      <h2 id="profile-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
        Score along the line
      </h2>
      <ol className="flex flex-col gap-1">
        <li>
          <button
            type="button"
            onClick={() => onFocus(0)}
            aria-pressed={focus === 0}
            className="w-full rounded-xl px-3 py-1.5 text-left text-[13px] font-semibold"
            style={focus === 0 ? raised(true) : undefined}
          >
            Start
          </button>
        </li>
        {steps.map((step) => (
          <li key={step.ply}>
            {step.ply === entry + 1 && (
              <p className="mt-2 border-t-2 border-dashed px-3 pt-2 text-[12px] font-semibold" style={{ borderColor: COLOURS.sand, color: COLOURS.leafSoft }}>
                Most played continuation
              </p>
            )}
            <button
              type="button"
              onClick={() => onFocus(step.ply)}
              aria-pressed={focus === step.ply}
              className={`grid w-full grid-cols-[5rem_3rem_1fr_3rem] items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[13px] ${
                step.ply > entry && focus !== step.ply ? 'opacity-70' : ''
              }`}
              style={focus === step.ply ? raised(true) : undefined}
            >
              <span className={step.byPlayer ? 'font-bold' : 'font-medium opacity-70'}>{formatMove(step.san, step.ply)}</span>
              <span className="text-right tabular-nums opacity-70">{step.games}</span>
              <GapBar rate={step.rate} average={average} />
              <span className="text-right font-bold tabular-nums">{formatPercent(step.rate)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface MovesHereProps {
  moves: readonly PlayedMove[];
  hidden: number;
  ply: number;
  playerToMove: boolean;
  average: number;
  onFollow: () => void;
  onOpen: (san: string) => void;
}

function MovesHere({ moves, hidden, ply, playerToMove, average, onFollow, onOpen }: MovesHereProps) {
  return (
    <section aria-labelledby="moves-title" className="flex flex-col gap-3">
      <h2 id="moves-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
        {playerToMove ? 'Your moves here' : 'Opponent moves here'}
      </h2>
      {moves.length === 0 ? (
        <p className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          None
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {moves.map((move) => (
            <li key={move.san}>
              <button
                type="button"
                onClick={() => (move.onLine ? onFollow() : onOpen(move.san))}
                aria-current={move.onLine ? 'step' : undefined}
                className="grid w-full grid-cols-[5rem_3rem_3rem_1fr_3rem] items-center gap-3 rounded-2xl px-3.5 py-2 text-left text-[13px] transition-transform hover:-translate-y-0.5"
                style={raised(move.onLine)}
              >
                <span className="text-[15px] font-bold">{formatMove(move.san, ply)}</span>
                <span className="text-right tabular-nums opacity-70">{move.games}</span>
                <span className="text-right tabular-nums opacity-70">{formatPercent(move.share)}</span>
                <GapBar rate={move.rate} average={average} />
                <span className="text-right font-bold tabular-nums">{formatPercent(move.rate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <p className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
          +{hidden} played fewer than 3 times
        </p>
      )}
    </section>
  );
}

// Part du milieu, la moyenne du joueur : 25 points d'écart remplissent une moitié.
function GapBar({ rate, average }: { rate: number; average: number }) {
  const gap = rate - average;
  const width = Math.min(50, Math.abs(gap) * 200);
  return (
    <span className="relative block h-2.5 rounded-full" style={{ background: COLOURS.sand }} aria-hidden="true">
      <span className="absolute top-0 left-1/2 h-full w-0.5" style={{ background: COLOURS.leafSoft }} />
      <span
        className="absolute top-0 h-full rounded-full"
        style={{ width: `${width}%`, left: gap < 0 ? `${50 - width}%` : '50%', background: gap < 0 ? COLOURS.terracotta : COLOURS.sage }}
      />
    </span>
  );
}
