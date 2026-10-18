import { useMemo, useState, type ReactNode } from 'react';
import { PlayableBoard } from '../board/PlayableBoard';
import { draftMoves, type AddedMove } from '../domain/addition';
import type { PlayedGame } from '../domain/playedGame';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import type { BoardArrow } from '../line/ArrowBoard';
import { INK } from '../line/tone';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { BuildPanel } from './BuildPanel';
import type { CheckedGame } from './checkedGame';
import { useBuilder, type Deviation } from './useBuilder';
import { useCandidates } from './useCandidates';

function Swatch({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded" style={{ background: colour }} />
      {children}
    </span>
  );
}

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
  const candidates = useCandidates(builder);
  // Un coup pointé n'a de sens que dans sa position : joué, il serait illégal dans la suivante.
  const [pointedAt, setPointedAt] = useState<{ fen: string; san: string } | null>(null);
  const pointed = pointedAt?.fen === builder.fen ? pointedAt.san : null;
  const engine = builder.playerToMove ? (candidates.here?.san ?? null) : null;
  const atStart = checked.check.kind === 'left' && builder.path.length === builder.start.length;
  // Quand le moteur jouerait le coup de la partie, la flèche est à lui : l'orange dit plus que le rouge.
  const agree = atStart && engine === checked.check.played;
  const suggestions = useMemo(() => candidates.rows.map((row) => row.san), [candidates.rows]);

  const arrows = useMemo((): BoardArrow[] => {
    const shown = repertoireMovesAt(repertoire, builder.fen).map(
      (move): BoardArrow => ({ san: move.san, tone: 'winning', colour: REPERTOIRE, share: 0.5 }),
    );
    // Le coup de la partie reste rouge même s'il est candidat : c'est lui qu'on juge.
    if (atStart && !agree) shown.push({ san: checked.check.played, tone: 'losing', colour: COLOURS.terracotta, share: 0.5 });
    for (const row of candidates.rows) {
      if (shown.some((arrow) => arrow.san === row.san)) continue;
      const colour = row.engine ? COLOURS.kumquatDeep : INK.even;
      shown.push({ san: row.san, tone: 'even', colour, share: Math.max(row.share ?? 0.2, 0.2), emphasis: row.engine || row.san === pointed });
    }
    return shown;
  }, [repertoire, builder.fen, candidates.rows, atStart, agree, checked.check.played, pointed]);

  return (
    <main className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
      <aside aria-label="Position" className="sticky top-6 flex flex-col gap-3 self-start">
        <PlayableBoard path={builder.path} flipped={checked.game.side === 'b'} arrows={arrows} suggestions={suggestions} onMove={builder.play} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] font-semibold" style={{ color: INK.even }}>
          <Swatch colour={REPERTOIRE}>repertoire</Swatch>
          {engine && <Swatch colour={COLOURS.kumquatDeep}>engine{agree && ' · your move'}</Swatch>}
          {atStart && !agree && <Swatch colour={COLOURS.terracotta}>your move</Swatch>}
          <Swatch colour={INK.even}>at your level</Swatch>
        </p>
      </aside>
      <div className="flex min-w-0 flex-col gap-10">
        <BuildPanel
          builder={builder}
          candidates={candidates}
          onPoint={(san) => setPointedAt(san ? { fen: builder.fen, san } : null)}
          onAccept={() => onAccept(draftMoves(builder.draft))}
          onCancel={onCancel}
        />
        {children}
      </div>
    </main>
  );
}
