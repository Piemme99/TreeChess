import { useMemo, useState, type ReactNode } from 'react';
import { PlayableBoard } from '../board/PlayableBoard';
import { draftMoves, type AddedMove } from '../domain/addition';
import { uciToSan } from '../domain/diagnosis';
import type { PlayedGame } from '../domain/playedGame';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import type { BoardArrow } from '../line/ArrowBoard';
import { useEvaluations } from '../line/engine';
import { INK } from '../line/tone';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { BuildPanel } from './BuildPanel';
import type { CheckedGame } from './checkedGame';
import { useBuilder, type Deviation } from './useBuilder';

const HINT_DEPTH = 16;

interface BuildSessionProps {
  checked: CheckedGame & { check: Deviation };
  /** Les parties du joueur avec ce côté, connues le jour du rejeu : ses habitudes. */
  games: readonly PlayedGame[];
  repertoire: Repertoire;
  onAccept: (moves: AddedMove[]) => void;
  onCancel: () => void;
  children: ReactNode;
}

/** Le joueur construit son ajout en jouant : l'échiquier devient jouable, le panneau le guide. */
export function BuildSession({ checked, games, repertoire, onAccept, onCancel, children }: BuildSessionProps) {
  const builder = useBuilder(checked, games);
  const [hintAt, setHintAt] = useState<string | null>(null);
  const hint = hintAt === builder.fen;
  const hintFens = useMemo(() => (hint ? [builder.fen] : []), [hint, builder.fen]);
  const best = useEvaluations(hintFens, HINT_DEPTH, hint).get(builder.fen)?.best;

  const arrows = useMemo((): BoardArrow[] => {
    const planned = repertoireMovesAt(repertoire, builder.fen).map(
      (move): BoardArrow => ({ san: move.san, tone: 'winning', colour: REPERTOIRE, share: 0.5 }),
    );
    const shown = [...planned];
    if (checked.check.kind === 'left' && builder.path.length === builder.start.length) {
      shown.push({ san: checked.check.played, tone: 'even', colour: INK.even, share: 0.5 });
    }
    const engine = hint ? uciToSan(builder.fen, best) : null;
    if (engine) shown.push({ san: engine, tone: 'winning', colour: COLOURS.kumquatDeep, share: 0.7, emphasis: true });
    return shown;
  }, [repertoire, builder.fen, builder.path.length, builder.start.length, checked.check, hint, best]);

  return (
    <main className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
      <aside aria-label="Position" className="sticky top-6 flex flex-col gap-3 self-start">
        <PlayableBoard path={builder.path} flipped={checked.game.side === 'b'} arrows={arrows} onMove={builder.play} />
        <p className="px-1 text-[14px]" style={{ color: INK.even }}>
          <span className="font-bold" style={{ color: REPERTOIRE }}>green</span> already in your repertoire
          {checked.check.kind === 'left' && builder.path.length === builder.start.length && ' · grey: your move in the game'}
          {hint && (
            <>
              {' '}· <span className="font-bold" style={{ color: COLOURS.kumquatDeep }}>orange</span> the engine move
            </>
          )}
        </p>
      </aside>
      <div className="flex min-w-0 flex-col gap-10">
        <BuildPanel
          builder={builder}
          hint={hint}
          onHint={() => setHintAt(hint ? null : builder.fen)}
          onAccept={() => onAccept(draftMoves(builder.draft))}
          onCancel={onCancel}
        />
        {children}
      </div>
    </main>
  );
}
