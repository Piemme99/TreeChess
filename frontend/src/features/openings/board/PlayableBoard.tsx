import { Chess, type Square } from 'chess.js';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PIECE_SVG } from '../../../shared/components/Board/pieceSvg';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { COLOURS } from '../workshop/theme';

interface PlayableBoardProps {
  path: readonly string[];
  flipped: boolean;
  arrows?: BoardArrow[];
  /** Coups jouables d'un seul clic sur leur case d'arrivée, sans choisir la pièce d'abord. */
  suggestions?: readonly string[];
  onMove: (san: string) => void;
}

interface Drag {
  from: Square;
  code: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

const FILES = 'abcdefgh';
// En deçà, un glisser est un clic : la sélection reste au clic, qui suit.
const DRAG_THRESHOLD = 5;

/** L'échiquier de l'atelier, où l'on joue comme sur Lichess : en glissant la pièce, ou en cliquant la pièce puis sa case. */
export function PlayableBoard({ path, flipped, arrows, suggestions = [], onMove }: PlayableBoardProps) {
  const chess = useMemo(() => {
    const game = new Chess();
    for (const san of path) game.move(san);
    return game;
  }, [path]);
  const [from, setFrom] = useState<Square | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [shownFor, setShownFor] = useState(path);
  if (shownFor !== path) {
    setShownFor(path);
    setFrom(null);
    setDrag(null);
  }
  const selected = drag?.from ?? from;
  const targets = selected ? chess.moves({ square: selected, verbose: true }) : [];
  const suggested = useMemo(
    () =>
      suggestions.flatMap((san) => {
        const move = chess.move(san);
        chess.undo();
        return move ? [{ san, to: move.to }] : [];
      }),
    [chess, suggestions],
  );

  const play = (origin: Square, square: Square) => {
    const move = chess.moves({ square: origin, verbose: true }).find((candidate) => candidate.to === square);
    if (!move) return false;
    setFrom(null);
    // La dame d'office : une sous-promotion n'a pas sa place dans une ouverture.
    onMove(chess.move({ from: move.from, to: move.to, promotion: 'q' }).san);
    return true;
  };

  const click = (square: Square) => {
    if (from && play(from, square)) return;
    // Deux flèches sur la même case : on laisse le joueur désigner la pièce.
    const landing = from ? [] : suggested.filter((candidate) => candidate.to === square);
    if (landing.length === 1) {
      onMove(landing[0].san);
      return;
    }
    const piece = chess.get(square);
    setFrom(piece && piece.color === chess.turn() && square !== from ? square : null);
  };

  /** La case sous un point donné en pixels depuis le coin de la grille. */
  const squareAt = (x: number, y: number): Square | null => {
    const rect = grid.current?.getBoundingClientRect();
    if (!rect) return null;
    const column = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    if (column < 0 || column > 7 || row < 0 || row > 7) return null;
    return `${FILES[flipped ? 7 - column : column]}${flipped ? row + 1 : 8 - row}` as Square;
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, square: Square) => {
    if (event.button !== 0) return;
    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) return;
    const rect = grid.current!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setDrag({ from: square, code: `${piece.color}${piece.type.toUpperCase()}`, pointerId: event.pointerId, startX: x, startY: y, x, y, moved: false });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const rect = grid.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) >= DRAG_THRESHOLD;
      setDrag({ ...drag, x, y, moved });
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      setDrag(null);
      if (!drag.moved) return;
      const rect = grid.current?.getBoundingClientRect();
      const square = rect ? squareAt(event.clientX - rect.left, event.clientY - rect.top) : null;
      if (square && square !== drag.from && play(drag.from, square)) return;
      setFrom(square === drag.from ? drag.from : null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const file = flipped ? 7 - column : column;
      const rank = flipped ? row + 1 : 8 - row;
      squares.push(`${FILES[file]}${rank}` as Square);
    }
  }
  const dragging = drag?.moved ? drag : null;
  const over = dragging ? squareAt(dragging.x, dragging.y) : null;

  return (
    <div className="relative">
      <ArrowBoard path={path} flipped={flipped} arrows={arrows} hidden={dragging?.from} />
      <div ref={grid} className="absolute inset-2.5 grid grid-cols-8 grid-rows-8 select-none" style={{ touchAction: 'none' }}>
        {squares.map((square) => {
          const target = targets.some((candidate) => candidate.to === square);
          // Sans pièce choisie, un point discret sur la case d'arrivée d'une flèche dit qu'un clic la joue.
          const landing = !selected && suggested.some((candidate) => candidate.to === square);
          const ring = square === from || (dragging && square === over && target);
          return (
            <button
              key={square}
              type="button"
              aria-label={square}
              onClick={() => click(square)}
              onPointerDown={(event) => pointerDown(event, square)}
              className="relative cursor-grab active:cursor-grabbing"
              style={ring ? { boxShadow: `inset 0 0 0 3px ${COLOURS.kumquat}` } : undefined}
            >
              {(target || landing) && (
                <span
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={target ? { width: '28%', height: '28%', background: 'oklch(0.3 0.06 150 / 0.35)' } : { width: '18%', height: '18%', background: 'oklch(0.3 0.06 150 / 0.22)' }}
                />
              )}
            </button>
          );
        })}
        {dragging && (
          <svg
            viewBox="0 0 45 45"
            aria-hidden="true"
            className="pointer-events-none absolute z-10"
            style={{
              width: '12.5%',
              height: '12.5%',
              left: dragging.x,
              top: dragging.y,
              transform: 'translate(-50%, -50%) scale(1.1)',
              filter: 'drop-shadow(0 6px 6px oklch(0.2 0.05 50 / 0.45))',
            }}
            dangerouslySetInnerHTML={{ __html: PIECE_SVG[dragging.code] }}
          />
        )}
      </div>
    </div>
  );
}
