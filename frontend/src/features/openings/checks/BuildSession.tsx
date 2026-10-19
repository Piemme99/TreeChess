import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PlayableBoard } from '../board/PlayableBoard';
import { draftLines, draftMoves, type AddedMove } from '../domain/addition';
import type { PlayedGame } from '../domain/playedGame';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import type { BoardArrow } from '../line/ArrowBoard';
import { ARROW } from '../workshop/theme';
import { BuildPanel } from './BuildPanel';
import { useBuilder, type BuildOrigin } from './useBuilder';
import { useCandidates } from './useCandidates';

const KEYS = { ArrowLeft: 'back', ArrowRight: 'forward', ArrowUp: 'start', ArrowDown: 'end' } as const;

function useArrowKeys(navigate: (direction: (typeof KEYS)[keyof typeof KEYS]) => void) {
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const direction = KEYS[event.key as keyof typeof KEYS];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
      event.preventDefault();
      navigate(direction);
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [navigate]);
}

function Swatch({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded" style={{ background: colour }} />
      {children}
    </span>
  );
}

interface BuildSessionProps {
  origin: BuildOrigin;
  /** Les parties du joueur avec ce côté, connues le jour du rejeu : ses habitudes. */
  games: readonly PlayedGame[];
  repertoire: Repertoire;
  /** Les coups acceptés, et les lignes du brouillon jusqu'à leur dernier coup. */
  onAccept: (moves: AddedMove[], lines: (readonly string[])[]) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Le joueur construit son ajout en jouant : l'échiquier devient jouable, le panneau le guide. */
export function BuildSession({ origin, games, repertoire, onAccept, onCancel, children }: BuildSessionProps) {
  const builder = useBuilder(origin, games);
  const candidates = useCandidates(builder);
  useArrowKeys(builder.navigate);
  // Un coup pointé n'a de sens que dans sa position : joué, il serait illégal dans la suivante.
  const [pointedAt, setPointedAt] = useState<{ fen: string; san: string } | null>(null);
  const pointed = pointedAt?.fen === builder.fen ? pointedAt.san : null;
  const engine = builder.playerToMove ? (candidates.here?.san ?? null) : null;
  const atStart = origin.played !== undefined && builder.path.length === builder.start.length;
  // Quand le moteur jouerait le coup de la partie, la flèche est à lui : l'orange dit plus que le rouge.
  const agree = atStart && engine === origin.played;
  const suggestions = useMemo(() => candidates.rows.map((row) => row.san), [candidates.rows]);

  const arrows = useMemo((): BoardArrow[] => {
    const shown = repertoireMovesAt(repertoire, builder.fen).map(
      (move): BoardArrow => ({ san: move.san, kind: 'repertoire', share: 0.5 }),
    );
    // Le coup de la partie reste rouge même s'il est candidat : c'est lui qu'on juge.
    if (atStart && !agree) shown.push({ san: origin.played!, kind: 'costly', share: 0.5 });
    for (const row of candidates.rows) {
      if (shown.some((arrow) => arrow.san === row.san)) continue;
      shown.push({ san: row.san, kind: row.engine ? 'engine' : 'neutral', share: Math.max(row.share ?? 0.2, 0.2), emphasis: row.engine || row.san === pointed });
    }
    return shown;
  }, [repertoire, builder.fen, candidates.rows, atStart, agree, origin.played, pointed]);

  return (
    <main className="mx-auto flex max-w-[84rem] flex-col gap-6 px-4 pt-6 lg:grid lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-10 lg:px-8 lg:pt-8">
      <aside aria-label="Position" className="flex flex-col gap-3 self-start lg:sticky lg:top-6">
        <PlayableBoard path={builder.path} flipped={origin.side === 'b'} arrows={arrows} suggestions={suggestions} onMove={builder.play} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] font-semibold" style={{ color: ARROW.neutral.colour }}>
          <Swatch colour={ARROW.repertoire.colour}>repertoire</Swatch>
          {engine && <Swatch colour={ARROW.engine.colour}>engine{agree && ' · your move'}</Swatch>}
          {atStart && !agree && <Swatch colour={ARROW.costly.colour}>your move</Swatch>}
          {arrows.some((arrow) => 'kind' in arrow && arrow.kind === 'neutral') && <Swatch colour={ARROW.neutral.colour}>at your level</Swatch>}
        </p>
      </aside>
      <div className="flex min-w-0 flex-col gap-6 lg:gap-10">
        <BuildPanel
          builder={builder}
          candidates={candidates}
          onPoint={(san) => setPointedAt(san ? { fen: builder.fen, san } : null)}
          onAccept={() => onAccept(draftMoves(builder.draft), draftLines(builder.draft))}
          onCancel={onCancel}
        />
        {children}
      </div>
    </main>
  );
}
