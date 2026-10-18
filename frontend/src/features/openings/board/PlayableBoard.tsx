import { Chess, type Square } from 'chess.js';
import { useMemo, useState } from 'react';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { COLOURS } from '../workshop/theme';

interface PlayableBoardProps {
  path: readonly string[];
  flipped: boolean;
  arrows?: BoardArrow[];
  onMove: (san: string) => void;
}

const FILES = 'abcdefgh';

/** L'échiquier de l'atelier, où l'on joue en cliquant la pièce puis sa case d'arrivée. */
export function PlayableBoard({ path, flipped, arrows, onMove }: PlayableBoardProps) {
  const chess = useMemo(() => {
    const game = new Chess();
    for (const san of path) game.move(san);
    return game;
  }, [path]);
  const [from, setFrom] = useState<Square | null>(null);
  const [shownFor, setShownFor] = useState(path);
  if (shownFor !== path) {
    setShownFor(path);
    setFrom(null);
  }
  const targets = from ? chess.moves({ square: from, verbose: true }) : [];

  const click = (square: Square) => {
    const move = targets.find((candidate) => candidate.to === square);
    if (move) {
      setFrom(null);
      // La dame d'office : une sous-promotion n'a pas sa place dans une ouverture.
      onMove(chess.move({ from: move.from, to: move.to, promotion: 'q' }).san);
      return;
    }
    const piece = chess.get(square);
    setFrom(piece && piece.color === chess.turn() && square !== from ? square : null);
  };

  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const file = flipped ? 7 - column : column;
      const rank = flipped ? row + 1 : 8 - row;
      squares.push(`${FILES[file]}${rank}` as Square);
    }
  }

  return (
    <div className="relative">
      <ArrowBoard path={path} flipped={flipped} arrows={arrows} />
      <div className="absolute inset-2.5 grid grid-cols-8 grid-rows-8">
        {squares.map((square) => {
          const target = targets.some((candidate) => candidate.to === square);
          return (
            <button
              key={square}
              type="button"
              aria-label={square}
              onClick={() => click(square)}
              className="relative cursor-pointer"
              style={square === from ? { boxShadow: `inset 0 0 0 3px ${COLOURS.kumquat}` } : undefined}
            >
              {target && (
                <span
                  className="absolute top-1/2 left-1/2 size-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: 'oklch(0.3 0.06 150 / 0.35)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
