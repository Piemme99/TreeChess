import { Chess, type Square } from 'chess.js';
import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Chessboard, type PieceRenderObject } from 'react-chessboard';
import { PIECE_SVG } from '../../../shared/components/Board/pieceSvg';
import { ArrowLayer, type BoardArrow } from '../line/ArrowBoard';
import { BOARD, COLOURS } from '../workshop/theme';

interface PlayableBoardProps {
  path: readonly string[];
  flipped: boolean;
  arrows?: BoardArrow[];
  /** Coups jouables d'un seul clic sur leur case d'arrivée, sans choisir la pièce d'abord. */
  suggestions?: readonly string[];
  onMove: (san: string) => void;
}

const PIECE_SHADOW = 'drop-shadow(0 2px 1.5px oklch(0.2 0.05 50 / 0.35))';

// Le dessin est posé une fois, hors du rendu : réinjecté à l'appui du pointeur, il détacherait
// l'élément pressé et le navigateur annulerait le clic qui suit.
const PieceSvg = memo(function PieceSvg({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.innerHTML = PIECE_SVG[code];
  }, [code]);
  return <svg ref={ref} viewBox="0 0 45 45" style={{ width: '100%', height: '100%', filter: PIECE_SHADOW }} />;
});

// Le glisser vient de react-chessboard, comme sur la v1 : la bibliothèque gère seuil, fantôme et retour.
const PIECES: PieceRenderObject = Object.fromEntries(Object.keys(PIECE_SVG).map((code) => [code, () => <PieceSvg code={code} />]));

/** L'échiquier de l'atelier où l'on joue comme sur Lichess : en glissant la pièce, ou en cliquant la pièce puis sa case. */
export function PlayableBoard({ path, flipped, arrows = [], suggestions = [], onMove }: PlayableBoardProps) {
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

  const renderSquare = ({ square, children }: { square: string; children?: ReactNode }) => {
    const target = targets.some((candidate) => candidate.to === square);
    const landing = !from && suggested.some((candidate) => candidate.to === square);
    const style: CSSProperties = { position: 'relative', width: '100%', height: '100%' };
    if (square === from) style.boxShadow = `inset 0 0 0 3px ${COLOURS.kumquat}`;
    const occupied = Boolean(chess.get(square as Square));
    return (
      <div style={style}>
        {children}
        {(target || landing) && <Dot ring={target && occupied} faint={!target} />}
      </div>
    );
  };

  return (
    <div
      className="rounded-[18px] p-2.5"
      style={{ background: BOARD.frame, boxShadow: '0 18px 40px -12px oklch(0.3 0.06 150 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.2)' }}
    >
      <div className="relative overflow-hidden rounded-[10px]">
        <Chessboard
          options={{
            id: 'workshop-playable',
            position: chess.fen(),
            boardOrientation: flipped ? 'black' : 'white',
            pieces: PIECES,
            lightSquareStyle: { backgroundColor: BOARD.light },
            darkSquareStyle: { backgroundColor: BOARD.dark },
            dropSquareStyle: { boxShadow: `inset 0 0 0 3px ${COLOURS.kumquat}` },
            draggingPieceStyle: { transform: 'scale(1.15)', filter: 'drop-shadow(0 8px 6px oklch(0.2 0.05 50 / 0.4))' },
            showNotation: false,
            animationDurationInMs: 180,
            allowDrawingArrows: false,
            dragActivationDistance: 3,
            canDragPiece: ({ piece }) => piece.pieceType[0] === chess.turn(),
            onPieceDrag: ({ square }) => setFrom(square as Square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (targetSquare && play(sourceSquare as Square, targetSquare as Square)) return true;
              setFrom(null);
              return false;
            },
            onSquareClick: ({ square }) => click(square as Square),
            squareRenderer: renderSquare,
          }}
        />
        <ArrowLayer path={path} flipped={flipped} arrows={arrows} className="absolute inset-0 z-[1]" />
      </div>
    </div>
  );
}

function Dot({ ring, faint }: { ring: boolean; faint: boolean }) {
  const ink = faint ? 'oklch(0.3 0.06 150 / 0.22)' : 'oklch(0.3 0.06 150 / 0.35)';
  const style: CSSProperties = ring
    ? { inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 5px ${ink}` }
    : { left: '50%', top: '50%', width: faint ? '18%' : '28%', height: faint ? '18%' : '28%', borderRadius: '50%', background: ink, transform: 'translate(-50%, -50%)' };
  return <span aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none', ...style }} />;
}
