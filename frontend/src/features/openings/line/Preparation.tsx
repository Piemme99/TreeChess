import type { ReactNode } from 'react';
import { figurineMove } from '../domain/notation';
import { countDropped, preparedDepth, type MoveSource, type PreparedMove } from '../domain/preparation';
import { formatPercent } from '../flame/format';
import { COLOURS, REPERTOIRE, tile } from '../workshop/theme';
import { hasExplorer } from './explorer';
import type { Preparation as PreparationState } from './useLineDiagnosis';

export interface PointedPreparation {
  /** Coups joués jusqu'à la position où se joue le coup montré. */
  path: readonly string[];
  move: PreparedMove;
}

const SOURCES: Record<MoveSource, { background: string; label: string }> = {
  habit: { background: 'oklch(0.88 0.045 145)', label: 'your habit' },
  level: { background: COLOURS.apricot, label: 'new: most played at your level' },
  engine: { background: COLOURS.kumquat, label: 'new: engine move' },
};

interface PreparationProps {
  preparation: PreparationState;
  keyPath: readonly string[];
  onPoint: (pointed: PointedPreparation | null) => void;
}

export function Preparation({ preparation, keyPath, onPoint }: PreparationProps) {
  if (!hasExplorer()) {
    return <Note>Needs a Lichess token (VITE_LICHESS_TOKEN in frontend/.env.local).</Note>;
  }
  if (preparation.done && preparation.moves.length === 0) {
    return <Note>Not enough games at your level from this position.</Note>;
  }
  const dropped = countDropped(preparation.moves);
  return (
    <div className="flex flex-col gap-3">
      {preparation.done ? (
        <Note>
          Up to move {Math.ceil(preparedDepth(preparation.moves) / 2)} · your habits where you have some, otherwise the move most played at
          your level that the engine approves{dropped > 0 && ` · ${dropped} habit${dropped > 1 ? 's' : ''} to drop`}
        </Note>
      ) : (
        <Note>Looking at what players of your level play, and asking the engine… {preparation.steps} positions</Note>
      )}
      <p className="flex flex-wrap gap-3 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {Object.values(SOURCES).map((source) => (
          <span key={source.label} className="flex items-center gap-1.5">
            <span className="size-3 rounded" style={{ background: source.background }} />
            {source.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded" style={{ background: COLOURS.opponent }} />
          opponent · share at your level
        </span>
      </p>
      <ul aria-label="Proposed preparation" className="flex flex-col gap-1.5" onMouseLeave={() => onPoint(null)}>
        {preparation.moves.map((move) => (
          <Branch key={move.san} move={move} path={keyPath} onPoint={onPoint} />
        ))}
      </ul>
      <button
        type="button"
        disabled
        title="Comes with Verify: your preparation, replayed on your phone"
        className="self-start rounded-full px-4 py-1.5 text-[14px] font-bold opacity-50"
        style={tile(COLOURS.sand)}
      >
        Add to my preparation
      </button>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
      {children}
    </p>
  );
}

// Un coup adverse et la réponse préparée tiennent sur une rangée ; les autres réponses adverses s'indentent dessous.
function Branch({ move, path, onPoint }: { move: PreparedMove; path: readonly string[]; onPoint: (pointed: PointedPreparation | null) => void }) {
  const chain = [{ move, path }];
  let last = move;
  let after = [...path, move.san];
  while (last.next.length === 1 && last.next[0].byPlayer) {
    chain.push({ move: last.next[0], path: after });
    after = [...after, last.next[0].san];
    last = last.next[0];
  }
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {chain.map((link) => (
          <Chip key={link.move.ply} move={link.move} onPoint={() => onPoint({ path: link.path, move: link.move })} />
        ))}
      </div>
      {last.next.length > 0 && (
        <ul className="ml-3 flex flex-col gap-1.5 border-l-2 pl-3" style={{ borderColor: COLOURS.sand }}>
          {last.next.map((next) => (
            <Branch key={next.san} move={next} path={after} onPoint={onPoint} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Chip({ move, onPoint }: { move: PreparedMove; onPoint: () => void }) {
  if (!move.byPlayer) {
    return (
      <span onMouseEnter={onPoint} className="rounded-lg px-2 py-0.5 text-[13px] font-semibold" style={{ background: COLOURS.opponent }}>
        {figurineMove(move.san, move.ply)}{' '}
        <span className="text-[11px] opacity-60">{move.share ? formatPercent(move.share) : `${move.mine} of yours`}</span>
      </span>
    );
  }
  return (
    <span onMouseEnter={onPoint} className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[14px]" style={tile(SOURCES[move.source ?? 'engine'].background)}>
      {move.dropped && <span className="font-semibold line-through opacity-60">{figurineMove(move.dropped.san, move.ply)}</span>}
      <span className="font-extrabold">{figurineMove(move.san, move.ply)}</span>
    </span>
  );
}

export function PreparedCaption({ move }: { move: PreparedMove }) {
  if (!move.byPlayer) {
    return (
      <>
        {figurineMove(move.san, move.ply)} · {move.share ? formatPercent(move.share) : '—'} at your level · {move.mine} of your games
      </>
    );
  }
  return (
    <>
      {move.dropped && (
        <>
          <span style={{ color: COLOURS.terracotta }}>{figurineMove(move.dropped.san, move.ply)}</span> costs {Math.round(move.dropped.loss * 100)} pts ·{' '}
        </>
      )}
      <span style={{ color: REPERTOIRE }}>{figurineMove(move.san, move.ply)}</span> · {SOURCES[move.source ?? 'engine'].label}
      {move.share ? ` · ${formatPercent(move.share)} at your level` : ''}
    </>
  );
}
