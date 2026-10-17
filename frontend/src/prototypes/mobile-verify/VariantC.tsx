// PROTOTYPE JETABLE — C « Ligne » : l'unité de travail est la ligne entière, rejouée depuis le
// premier coup ; l'écart de la partie n'est qu'un point marqué sur la ligne.
import { useEffect, useMemo, useState } from 'react';
import type { Side } from '../../features/openings/domain/playedGame';
import { useElementWidth } from '../../features/openings/flame/useElementWidth';
import { replayLine } from '../../features/openings/position/replay';
import { ChessBoard } from '../../shared/components/Board';
import { isPlayerTurn, preparedContinuation, proposePreparation, type MobileData, type ScenarioKey } from './checks';
import { moveNumber, SIDE_LABEL, useLineName } from './lineName';
import { AppBar, LockScreen } from './Phone';
import { PlayMove } from './PlayMove';

export const name = 'Line';

interface Line {
  side: Side;
  moves: string[];
  marked: number | null;
  draft: boolean;
}

export function VariantC({ data, scenario }: { data: MobileData; scenario: ScenarioKey }) {
  const featured = useMemo(() => featuredLine(data, scenario), [data, scenario]);
  const due = useMemo(
    () =>
      data.review.slice(0, 3).map<Line>((card) => ({
        side: card.side,
        moves: preparedContinuation(data.stats, card.side, [...card.path, card.expected.san]),
        marked: null,
        draft: false,
      })),
    [data],
  );
  const [open, setOpen] = useState<Line | null | 'lock'>('lock');
  const featuredName = useLineName(featured?.moves.slice(0, 8) ?? []);

  if (open === 'lock') {
    const body = !featured
      ? `${due.length} lines due today`
      : featured.draft
        ? `New line in your last game. Draft ready from your moves.`
        : `Lost after leaving your line at move ${moveNumber(featured.marked!)}. Replay it.`;
    return (
      <LockScreen
        notification={{ title: featured ? featuredName : 'Kumquat', body, when: featured ? 'now' : '9:00' }}
        onOpen={() => setOpen(featured)}
      />
    );
  }

  if (open) return <LineReplay line={open} onClose={() => setOpen(null)} />;

  return (
    <>
      <AppBar title="Lines" />
      <div className="flex flex-col gap-2 p-4">
        <h2 className="text-xs uppercase tracking-wide text-text-muted">Due today</h2>
        {[...(featured ? [featured] : []), ...due].map((line, index) => (
          <LineRow key={index} line={line} onOpen={() => setOpen(line)} />
        ))}
      </div>
    </>
  );
}

function featuredLine(data: MobileData, scenario: ScenarioKey): Line | null {
  if (scenario === 'left') {
    const { game, check } = data.left;
    const start = [...game.moves.slice(0, check.ply), check.expected.san];
    return { side: game.side, moves: preparedContinuation(data.stats, game.side, start), marked: check.ply, draft: false };
  }
  if (scenario === 'none') {
    const { game, check } = data.none;
    const before = game.moves.slice(0, check.ply);
    const proposal = proposePreparation(data.stats, game.side, before);
    return { side: game.side, moves: [...before, ...proposal.moves], marked: check.ply, draft: true };
  }
  return null;
}

function LineRow({ line, onOpen }: { line: Line; onOpen: () => void }) {
  const name = useLineName(line.moves);
  const yourMoves = line.moves.filter((_, ply) => isPlayerTurn(line.side, ply)).length;
  return (
    <button onClick={onOpen} className="flex items-center justify-between rounded-xl border border-border bg-bg-card px-3 py-3 text-left">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-text">{name}</span>
        <span className="text-xs text-text-muted">
          {SIDE_LABEL[line.side]} · {yourMoves} moves
        </span>
      </span>
      {line.draft ? <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs text-primary-dark">Draft</span> : null}
      {line.marked !== null && !line.draft ? <span className="rounded-full bg-danger-light px-2 py-0.5 text-xs text-danger">Last game</span> : null}
    </button>
  );
}

function LineReplay({ line, onClose }: { line: Line; onClose: () => void }) {
  const [ply, setPly] = useState(0);
  const [slips, setSlips] = useState<Set<number>>(new Set());
  const [kept, setKept] = useState<boolean | null>(null);
  const name = useLineName(line.moves);
  const finished = ply >= line.moves.length;
  const opponentToMove = !finished && !isPlayerTurn(line.side, ply);

  useEffect(() => {
    if (!opponentToMove) return;
    const timer = setTimeout(() => setPly((p) => p + 1), 450);
    return () => clearTimeout(timer);
  }, [opponentToMove, ply]);

  const playerPlies = line.moves.map((_, p) => p).filter((p) => isPlayerTurn(line.side, p));

  return (
    <>
      <AppBar title={name} onBack={onClose} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-1.5">
          {playerPlies.map((p) => (
            <span
              key={p}
              className={`h-3 w-3 rounded-full ${
                slips.has(p) ? 'bg-danger' : p < ply ? 'bg-success' : p === ply ? 'bg-primary' : 'bg-border'
              } ${p === line.marked ? 'ring-2 ring-danger/50 ring-offset-1' : ''}`}
            />
          ))}
          {line.draft ? <span className="ml-auto rounded-full bg-warning-light px-2 py-0.5 text-xs text-primary-dark">Draft</span> : null}
        </div>

        {ply === line.marked && !finished ? (
          <p className="text-sm font-medium text-danger">{line.draft ? 'Your game left the book here' : 'You left your line here last game'}</p>
        ) : null}

        {finished ? (
          <FinalBoard line={line} />
        ) : opponentToMove ? (
          <OpponentBoard line={line} ply={ply} />
        ) : (
          <PlayMove
            key={ply}
            side={line.side}
            path={line.moves.slice(0, ply)}
            expected={line.moves[ply]}
            onSolved={(firstTry) => {
              if (!firstTry) setSlips((s) => new Set(s).add(ply));
              setTimeout(() => setPly(ply + 1), 400);
            }}
          />
        )}

        {finished ? (
          <div className="flex flex-col gap-3">
            <p className="text-center font-display text-2xl text-text">
              {playerPlies.length - slips.size}/{playerPlies.length}
            </p>
            <p className="text-center text-sm text-text-muted">{slips.size === 0 ? 'Next · in 3 days' : 'Again · tomorrow'}</p>
            {line.draft && kept === null ? (
              <div className="flex gap-2">
                <button onClick={() => setKept(false)} className="flex-1 rounded-xl border border-border py-3 text-text-muted">
                  Discard
                </button>
                <button onClick={() => setKept(true)} className="flex-[2] rounded-xl bg-primary py-3 font-medium text-white">
                  Keep line
                </button>
              </div>
            ) : null}
            {kept !== null ? <p className="text-center text-sm text-success">{kept ? '✓ Added to your preparation' : 'Discarded'}</p> : null}
            <button onClick={onClose} className="rounded-xl border border-border py-3 text-text">
              Done
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function OpponentBoard({ line, ply }: { line: Line; ply: number }) {
  return <StillBoard line={line} plies={ply} label="…" />;
}

function FinalBoard({ line }: { line: Line }) {
  return <StillBoard line={line} plies={line.moves.length} label="End of line" />;
}

function StillBoard({ line, plies, label }: { line: Line; plies: number; label: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const replayed = useMemo(() => replayLine(line.moves.slice(0, plies)), [line, plies]);
  return (
    <div ref={ref} className="flex flex-col gap-2">
      {width > 0 ? (
        <ChessBoard
          fen={replayed.fens[replayed.fens.length - 1]}
          orientation={line.side === 'w' ? 'white' : 'black'}
          interactive={false}
          lastMove={replayed.lastMove}
          width={width}
        />
      ) : null}
      <span className="flex min-h-9 items-center text-sm text-text-muted">{label}</span>
    </div>
  );
}
