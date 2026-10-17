import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StaticBoard } from '../../../shared/components/Board/StaticBoard';
import { movesAt, studyLine, type LineStep, type PlayedMove } from '../domain/line';
import { formatMove } from '../domain/notation';
import { isPlayerMove, type OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { formatPercent } from '../flame/format';
import { LineLabel } from '../position/LineLabel';
import { replayLine } from '../position/replay';

const ARROW_COLOUR = 'rgb(230,126,34)';

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
  const { fens, lastMove } = useMemo(() => replayLine(focusPath), [focusPath]);
  const moves = movesAt(tree, focusPath, steps[focus]?.san);
  const playerToMove = isPlayerMove(tree.side, focus + 1);

  return (
    <section aria-label="Line" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 self-start text-sm text-primary hover:underline"
        >
          <ArrowLeft size={14} /> Openings
        </button>
        <h1 className="font-display text-2xl text-text">
          <LineLabel path={path} />
        </h1>
        <p className="text-sm text-text-muted">
          {tree.side === 'w' ? 'White' : 'Black'} · {entryStep?.games ?? 0} games ·{' '}
          <span className="font-mono text-text">{entryStep ? formatPercent(entryStep.rate) : '—'}</span> vs{' '}
          <span className="font-mono">{formatPercent(average)}</span> average · Last 12 months
        </p>
      </header>

      <div className="grid grid-cols-[20rem_1fr] items-start gap-8">
        <div className="flex flex-col gap-3">
          <StaticBoard
            fen={fens[fens.length - 1]}
            orientation={tree.side === 'w' ? 'white' : 'black'}
            arrows={lastMove ? [[lastMove.from, lastMove.to, ARROW_COLOUR]] : []}
          />
          <p className="font-mono text-sm text-text-muted">
            {focus === 0 ? 'Start' : formatMove(steps[focus - 1].san, focus)}
          </p>
        </div>

        <div className="flex flex-col gap-8">
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
    <section aria-labelledby="profile-title" className="flex flex-col gap-2">
      <h2 id="profile-title" className="font-display text-lg text-text">Score along the line</h2>
      <ol className="flex flex-col gap-0.5">
        <li>
          <button
            type="button"
            onClick={() => onFocus(0)}
            aria-pressed={focus === 0}
            className={`w-full rounded px-2 py-1 text-left text-xs text-text-muted ${focus === 0 ? 'bg-primary-light' : 'hover:bg-bg-card'}`}
          >
            Start
          </button>
        </li>
        {steps.map((step) => (
          <li key={step.ply}>
            {step.ply === entry + 1 && (
              <p className="mt-2 border-t border-dashed border-border px-2 pt-2 text-xs text-text-muted">
                Most played continuation
              </p>
            )}
            <button
              type="button"
              onClick={() => onFocus(step.ply)}
              aria-pressed={focus === step.ply}
              className={`grid w-full grid-cols-[5rem_3rem_1fr_3rem] items-center gap-3 rounded px-2 py-1 text-left text-xs ${
                focus === step.ply ? 'bg-primary-light' : 'hover:bg-bg-card'
              } ${step.ply > entry ? 'opacity-70' : ''}`}
            >
              <span className={`font-mono ${step.byPlayer ? 'text-text' : 'text-text-muted'}`}>
                {formatMove(step.san, step.ply)}
              </span>
              <span className="text-right font-mono text-text-muted">{step.games}</span>
              <GapBar rate={step.rate} average={average} />
              <span className="text-right font-mono text-text">{formatPercent(step.rate)}</span>
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
    <section aria-labelledby="moves-title" className="flex flex-col gap-2">
      <h2 id="moves-title" className="font-display text-lg text-text">
        {playerToMove ? 'Your moves here' : 'Opponent moves here'}
      </h2>
      {moves.length === 0 ? (
        <p className="text-sm text-text-muted">None</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {moves.map((move) => (
            <li key={move.san}>
              <button
                type="button"
                onClick={() => (move.onLine ? onFollow() : onOpen(move.san))}
                aria-current={move.onLine ? 'step' : undefined}
                className={`grid w-full grid-cols-[5rem_3rem_3rem_1fr_3rem] items-center gap-3 rounded-md border px-3 py-1.5 text-left text-xs ${
                  move.onLine ? 'border-primary bg-primary-light' : 'border-border bg-bg-card hover:border-border-dark'
                }`}
              >
                <span className="font-mono text-sm text-text">{formatMove(move.san, ply)}</span>
                <span className="text-right font-mono text-text-muted">{move.games}</span>
                <span className="text-right font-mono text-text-muted">{formatPercent(move.share)}</span>
                <GapBar rate={move.rate} average={average} />
                <span className="text-right font-mono text-text">{formatPercent(move.rate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="text-xs text-text-muted">+{hidden} played fewer than 3 times</p>}
    </section>
  );
}

// Part du milieu, la moyenne du joueur : 25 points d'écart remplissent une moitié.
function GapBar({ rate, average }: { rate: number; average: number }) {
  const gap = rate - average;
  const width = Math.min(50, Math.abs(gap) * 200);
  return (
    <span className="relative block h-2.5" aria-hidden="true">
      <span className="absolute left-1/2 top-0 h-full w-px bg-border-dark" />
      <span
        className={`absolute top-0 h-full rounded-sm ${gap < 0 ? 'bg-danger' : 'bg-success'}`}
        style={{ width: `${width}%`, left: gap < 0 ? `${50 - width}%` : '50%' }}
      />
    </span>
  );
}
