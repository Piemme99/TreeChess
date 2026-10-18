// PROTOTYPE — variante B : toute la ligne d'un coup d'œil, chaque position est une rangée qui se divise
// selon les coups joués ; le plateau suit le survol.
import { useState } from 'react';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import type { LineSlotProps } from '../OpeningsPage';
import { COLOURS, TONES } from '../workshop/theme';
import { ArrowBoard, LineHeader } from './parts';
import { INK } from './ui';
import { toneOf, useLineStudy, type LineStudy, type Position } from './study';

interface Pointed {
  ply: number;
  san: string | null;
}

export function ForkMapLine({ tree, path, onBack, onOpen }: LineSlotProps) {
  const study = useLineStudy(tree, path);
  const resting: Pointed = { ply: study.drop ?? study.entry, san: null };
  const [pointed, setPointed] = useState<Pointed | null>(null);
  const shown = pointed ?? resting;
  const position = study.positions[shown.ply];
  const move = shown.san ? position.moves.find((candidate) => candidate.san === shown.san) : undefined;
  const arrows = (move ? [move] : position.moves.slice(0, 6)).map((candidate) => ({
    san: candidate.san,
    tone: toneOf(candidate.rate, candidate.games, study.average),
    share: move ? 0.8 : candidate.share,
    emphasis: candidate.onLine,
  }));

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <LineHeader study={study} path={path} side={tree.side} onBack={onBack} />
      <div className="grid grid-cols-[minmax(0,26rem)_1fr] items-start gap-10">
        <div className="sticky top-6 flex flex-col gap-3">
          <ArrowBoard path={position.path} flipped={tree.side === 'b'} arrows={arrows} />
          <p className="px-1 text-[15px] font-semibold">
            {move ? (
              <>
                {figurineMove(move.san, position.ply + 1)} · {move.games} games ·{' '}
                <span style={{ color: INK[toneOf(move.rate, move.games, study.average)] }}>{formatPercent(move.rate)}</span>
              </>
            ) : (
              <>
                {position.ply === 0 ? 'Start' : `After ${figurineMove(study.steps[position.ply - 1].san, position.ply)}`} · {position.games} games
              </>
            )}
          </p>
        </div>
        <ol className="flex flex-col" onMouseLeave={() => setPointed(null)}>
          {study.positions.map((row) => (
            <ForkRow
              key={row.ply}
              study={study}
              position={row}
              pointed={pointed}
              onPoint={setPointed}
              onOpen={(san) => onOpen([...row.path, san])}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

interface ForkRowProps {
  study: LineStudy;
  position: Position;
  pointed: Pointed | null;
  onPoint: (pointed: Pointed) => void;
  onOpen: (san: string) => void;
}

function ForkRow({ study, position, pointed, onPoint, onOpen }: ForkRowProps) {
  const { average, entry, drop } = study;
  const tone = toneOf(position.rate, position.games, average);
  const height = position.playerToMove ? 40 : 24;
  const shownGames = position.moves.reduce((sum, move) => sum + move.games, 0);
  const rest = Math.max(0, position.games - shownGames);
  const isDrop = position.ply === drop;
  const last = position.ply === study.positions.length - 1;

  return (
    <li>
      {position.ply === entry + 1 && (
        <p className="ml-[7.5rem] border-t-2 border-dashed pt-1.5 pb-2 text-[12px] font-semibold" style={{ borderColor: COLOURS.sand, color: COLOURS.leafSoft }}>
          Most played continuation
        </p>
      )}
      <div className={`grid grid-cols-[4rem_3.5rem_1fr] items-center gap-0 ${position.ply > entry ? 'opacity-75' : ''}`}>
        <span className="pr-2 text-right text-[12px] font-bold tabular-nums" style={{ color: isDrop ? COLOURS.terracotta : COLOURS.leafSoft }}>
          {isDrop ? `−${Math.round((study.positions[position.ply - 1].rate - position.rate) * 100)} pts` : formatPercent(position.rate)}
        </span>
        <span className="relative flex h-full items-center justify-center self-stretch">
          {!last && <span className="absolute top-1/2 bottom-[-50%] w-1 rounded-full" style={{ background: COLOURS.sand }} />}
          {position.ply > 0 && <span className="absolute top-[-50%] bottom-1/2 w-1 rounded-full" style={{ background: COLOURS.sand }} />}
          <span
            className="relative z-10 rounded-full"
            style={{
              width: position.playerToMove ? 16 : 11,
              height: position.playerToMove ? 16 : 11,
              background: position.ply === 0 ? COLOURS.leaf : INK[tone],
              boxShadow: isDrop ? `0 0 0 4px oklch(0.60 0.155 35 / 0.25)` : undefined,
            }}
          />
        </span>
        <div className="my-[3px] flex gap-[3px]" style={{ height }}>
          {position.moves.length === 0 && (
            <span className="flex flex-1 items-center rounded-lg px-2 text-[12px] font-medium" style={{ background: COLOURS.opponent, color: COLOURS.leafSoft }}>
              {position.games} games, none played 3 times
            </span>
          )}
          {position.moves.map((move) => {
            const moveTone = toneOf(move.rate, move.games, average);
            const isPointed = pointed?.ply === position.ply && pointed.san === move.san;
            const width = move.games / position.games;
            const colours = move.onLine
              ? { background: COLOURS.leaf, color: COLOURS.cream }
              : position.playerToMove
                ? { background: TONES[moveTone].bg, color: TONES[moveTone].fg }
                : { background: COLOURS.opponent, color: COLOURS.leaf, boxShadow: `inset 0 -3px 0 ${INK[moveTone]}` };
            return (
              <button
                key={move.san}
                type="button"
                onMouseEnter={() => onPoint({ ply: position.ply, san: move.san })}
                onFocus={() => onPoint({ ply: position.ply, san: move.san })}
                onClick={() => !move.onLine && onOpen(move.san)}
                title={`${figurineMove(move.san, position.ply + 1)} · ${move.games} games · ${formatPercent(move.rate)}`}
                className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-2 text-left whitespace-nowrap transition-transform"
                style={{
                  flexGrow: width,
                  flexBasis: 0,
                  ...colours,
                  outline: isPointed ? `2px solid ${COLOURS.kumquatDeep}` : undefined,
                  transform: isPointed ? 'translateY(-1px)' : undefined,
                }}
              >
                {width > 0.06 && (
                  <span className={position.playerToMove ? 'text-[14px] font-extrabold' : 'text-[12px] font-bold'}>
                    {figurineMove(move.san, position.ply + 1)}
                  </span>
                )}
                {width > 0.16 && (
                  <span className="text-[11px] font-semibold tabular-nums opacity-80">
                    {move.games} · {formatPercent(move.rate)}
                  </span>
                )}
              </button>
            );
          })}
          {rest > 0 && position.moves.length > 0 && (
            <span
              title={`${position.hidden} moves played fewer than 3 times`}
              className="rounded-lg"
              style={{
                flexGrow: rest / position.games,
                flexBasis: 0,
                background: `repeating-linear-gradient(135deg, ${COLOURS.sand} 0 4px, transparent 4px 8px)`,
              }}
            />
          )}
        </div>
      </div>
    </li>
  );
}
