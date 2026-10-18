import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { useMemo, type CSSProperties } from 'react';
import { PIECE_SVG } from '../../../shared/components/Board/pieceSvg';
import { placeLine, squareCoords } from './pieces';

export type SquareMark = 'from' | 'to' | null;

interface MotionBoardProps {
  path: readonly string[];
  flipped: boolean;
  transition: Transition;
  squareStyle: (light: boolean, mark: SquareMark) => CSSProperties;
  pieceStyle?: CSSProperties;
  pieceInks?: { dark: string; light: string };
  className?: string;
  style?: CSSProperties;
}

const inked = (svg: string, inks?: { dark: string; light: string }) =>
  inks ? svg.replaceAll('#000000', inks.dark).replaceAll('#ffffff', inks.light) : svg;

export function MotionBoard({ path, flipped, transition, squareStyle, pieceStyle, pieceInks, className, style }: MotionBoardProps) {
  const { pieces, lastMove } = useMemo(() => placeLine(path), [path]);
  const from = lastMove && squareCoords(lastMove.from);
  const to = lastMove && squareCoords(lastMove.to);

  const column = (file: number) => (flipped ? 7 - file : file);
  const row = (rank: number) => (flipped ? rank : 7 - rank);

  const squares = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const mark: SquareMark =
        from && from.file === file && from.rank === rank ? 'from' : to && to.file === file && to.rank === rank ? 'to' : null;
      squares.push(
        <div
          key={`${file}${rank}`}
          className="absolute transition-colors duration-200"
          style={{
            left: `${column(file) * 12.5}%`,
            top: `${row(rank) * 12.5}%`,
            width: '12.5%',
            height: '12.5%',
            ...squareStyle((file + rank) % 2 === 1, mark),
          }}
        />,
      );
    }
  }

  return (
    <div className={`relative aspect-square w-full ${className ?? ''}`} style={style}>
      {squares}
      <AnimatePresence initial={false}>
        {pieces.map((piece) => (
          <motion.svg
            key={piece.id}
            viewBox="0 0 45 45"
            className="absolute"
            style={{ width: '12.5%', height: '12.5%', ...pieceStyle }}
            initial={{ opacity: 0, scale: 0.6, left: `${column(piece.file) * 12.5}%`, top: `${row(piece.rank) * 12.5}%` }}
            animate={{ opacity: 1, scale: 1, left: `${column(piece.file) * 12.5}%`, top: `${row(piece.rank) * 12.5}%` }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={transition}
            dangerouslySetInnerHTML={{ __html: inked(PIECE_SVG[piece.code], pieceInks) }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
