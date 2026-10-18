import { useEffect, useMemo, useState } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove } from '../domain/notation';
import { gamesIn } from '../domain/preparation';
import { formatPercent } from '../flame/format';
import { COLOURS, tile } from '../workshop/theme';
import { explore, type ExplorerResult } from './explorer';
import { lichessPuzzles, lichessVsComputer } from './lichess';
import { BEST } from './tone';

const MASTER_MOVES = 3;
const MASTER_GAMES = 3;

interface PracticeProps {
  /** Positions de la ligne jusqu'à la position clé. */
  fens: readonly string[];
  /** Le coup habituel du joueur à la position clé, quand c'est à lui de jouer. */
  habit: string | null;
}

export function Practice({ fens, habit }: PracticeProps) {
  const opening = useOpeningName(useMemo(() => [...fens], [fens]));
  const fen = fens[fens.length - 1];
  const masters = useMasters(fen);
  const ply = fens.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <ExternalButton href={lichessVsComputer(fen)} label="Play it against Stockfish ↗" />
        {opening && <ExternalButton href={lichessPuzzles(opening.name)} label={`Puzzles: ${opening.name.split(':')[0]} ↗`} />}
      </div>
      {masters && gamesIn(masters) > 0 && (
        <div aria-label="Masters" className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: COLOURS.cream }}>
          <p className="flex flex-wrap items-baseline gap-x-3 text-[14px] font-semibold">
            <span className="font-extrabold">Masters here</span>
            <span style={{ color: COLOURS.leafSoft }}>{gamesIn(masters)} games</span>
            {masters.moves.slice(0, MASTER_MOVES).map((move) => (
              <span key={move.san} style={move.san === habit ? { color: BEST } : undefined}>
                {figurineMove(move.san, ply)} {formatPercent(gamesIn(move) / gamesIn(masters))}
                {move.san === habit && ' · yours'}
              </span>
            ))}
          </p>
          <ul className="flex flex-wrap gap-2">
            {(masters.topGames ?? []).slice(0, MASTER_GAMES).map((game) => (
              <li key={game.id}>
                <ExternalButton href={`https://lichess.org/${game.id}`} label={`${surname(game.white.name)} – ${surname(game.black.name)}, ${game.year} ↗`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function useMasters(fen: string): ExplorerResult | null {
  const [masters, setMasters] = useState<{ fen: string; result: ExplorerResult | null } | null>(null);
  useEffect(() => {
    let live = true;
    explore('masters', fen).then((result) => live && setMasters({ fen, result }));
    return () => {
      live = false;
    };
  }, [fen]);
  return masters?.fen === fen ? masters.result : null;
}

const surname = (name: string) => name.split(',')[0];

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-full px-4 py-1.5 text-[14px] font-bold" style={tile(COLOURS.sand)}>
      {label}
    </a>
  );
}
