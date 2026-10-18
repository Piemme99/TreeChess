import { useState } from 'react';
import type { LinePosition } from '../domain/line';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import { COLOURS, TONES } from '../workshop/theme';
import { INK, moveTone } from './tone';

export interface PointedMove {
  ply: number;
  san: string;
}

interface WholeLineProps {
  positions: readonly LinePosition[];
  entry: number;
  average: number;
  pointed: PointedMove | null;
  onPoint: (pointed: PointedMove | null) => void;
  onOpen: (path: readonly string[]) => void;
}

/** La ligne entière, une rangée par position partagée selon les coups joués (largeur = parties). */
export function WholeLine({ positions, entry, average, pointed, onPoint, onOpen }: WholeLineProps) {
  const [opponents, setOpponents] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 self-start text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <input type="checkbox" checked={opponents} onChange={(event) => setOpponents(event.target.checked)} />
        show every opponent move
      </label>
      <ol aria-label="Whole line" className="flex flex-col" onMouseLeave={() => onPoint(null)}>
        {positions.map((position) => (
          <ForkRow
            key={position.ply}
            position={position}
            entry={entry}
            average={average}
            last={position.ply === positions.length - 1}
            pointed={pointed}
            onPoint={onPoint}
            onOpen={(san) => onOpen([...position.path, san])}
            foldOpponents={!opponents}
          />
        ))}
      </ol>
    </div>
  );
}

interface ForkRowProps {
  position: LinePosition;
  entry: number;
  average: number;
  last: boolean;
  pointed: PointedMove | null;
  onPoint: (pointed: PointedMove) => void;
  onOpen: (san: string) => void;
  /** Ne garde, sur les rangées adverses, que le coup de la ligne : la carte complète intimide. */
  foldOpponents: boolean;
}

function ForkRow({ position, entry, average, last, pointed, onPoint, onOpen, foldOpponents }: ForkRowProps) {
  const moves = foldOpponents && !position.playerToMove ? position.moves.filter((move) => move.onLine) : position.moves;
  const height = position.playerToMove ? 40 : 24;
  const rest = Math.max(0, position.games - moves.reduce((sum, move) => sum + move.games, 0));

  return (
    <li>
      {position.ply === entry + 1 && (
        <p className="ml-[7.5rem] border-t-2 border-dashed pt-1.5 pb-2 text-[12px] font-semibold" style={{ borderColor: COLOURS.sand, color: COLOURS.leafSoft }}>
          Most played continuation
        </p>
      )}
      <div className={`grid grid-cols-[4rem_3.5rem_1fr] items-center ${position.ply > entry ? 'opacity-75' : ''}`}>
        <span className="pr-2 text-right text-[12px] font-bold tabular-nums" style={{ color: COLOURS.leafSoft }}>
          {formatPercent(position.rate)}
        </span>
        <span className="relative flex h-full items-center justify-center self-stretch">
          {!last && <span className="absolute top-1/2 bottom-[-50%] w-1 rounded-full" style={{ background: COLOURS.sand }} />}
          {position.ply > 0 && <span className="absolute top-[-50%] bottom-1/2 w-1 rounded-full" style={{ background: COLOURS.sand }} />}
          <span
            className="relative z-10 rounded-full"
            style={{
              width: position.playerToMove ? 16 : 11,
              height: position.playerToMove ? 16 : 11,
              background: position.ply === 0 ? COLOURS.leaf : INK[moveTone(position.rate, position.games, average)],
            }}
          />
        </span>
        <div className="my-[3px] flex gap-[3px]" style={{ height }}>
          {moves.length === 0 && (
            <span className="flex flex-1 items-center rounded-lg px-2 text-[12px] font-medium" style={{ background: COLOURS.opponent, color: COLOURS.leafSoft }}>
              {position.games} games, none played 3 times
            </span>
          )}
          {moves.map((move) => {
            const tone = moveTone(move.rate, move.games, average);
            const isPointed = pointed?.ply === position.ply && pointed.san === move.san;
            const width = move.games / position.games;
            const colours = move.onLine
              ? { background: COLOURS.leaf, color: COLOURS.cream }
              : position.playerToMove
                ? { background: TONES[tone].bg, color: TONES[tone].fg }
                : { background: COLOURS.opponent, color: COLOURS.leaf, boxShadow: `inset 0 -3px 0 ${INK[tone]}` };
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
          {rest > 0 && moves.length > 0 && (
            <span
              title={`${position.hidden} moves played fewer than 3 times`}
              className="rounded-lg"
              style={{ flexGrow: rest / position.games, flexBasis: 0, background: `repeating-linear-gradient(135deg, ${COLOURS.sand} 0 4px, transparent 4px 8px)` }}
            />
          )}
        </div>
      </div>
    </li>
  );
}
