// PROTOTYPE — échiquier en bois : deux essences au fil alterné, filet de marqueterie, coordonnées
// gravées dans le cadre, pièces Staunton qui se soulèvent, glissent et se posent.
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { useMemo } from 'react';
import { placeLine, squareCoords } from './pieces';
import { grain, SHADOW, WOOD } from './wood';

const PIECE_URLS = import.meta.glob<string>('./governor/*.svg', { eager: true, query: '?url', import: 'default' });
const pieceUrl = (code: string) => PIECE_URLS[`./governor/${code}.svg`];

const SLIDE: Transition = { type: 'spring', stiffness: 230, damping: 25, mass: 1.1 };
const SETTLE: Transition = { type: 'spring', stiffness: 420, damping: 18 };

const GRAIN_X = grain('x', { seed: 4, strength: 0.42 });
const GRAIN_Y = grain('y', { seed: 9, strength: 0.42 });
const DARK_GRAIN_X = grain('x', { seed: 6, strength: 0.75 });
const DARK_GRAIN_Y = grain('y', { seed: 8, strength: 0.75 });
const FRAME_GRAIN = grain('x', { seed: 2, strength: 0.6, scale: 1.4 });

const FILES = 'abcdefgh';

export function WoodBoard({ path, flipped }: { path: readonly string[]; flipped: boolean }) {
  const { pieces, lastMove } = useMemo(() => placeLine(path), [path]);
  const from = lastMove && squareCoords(lastMove.from);
  const to = lastMove && squareCoords(lastMove.to);

  const column = (file: number) => (flipped ? 7 - file : file);
  const row = (rank: number) => (flipped ? rank : 7 - rank);
  const at = (file: number, rank: number) => ({ left: `${column(file) * 12.5}%`, top: `${row(rank) * 12.5}%` });

  const squares = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const light = (file + rank) % 2 === 1;
      const marked = (from && from.file === file && from.rank === rank) || (to && to.file === file && to.rank === rank);
      squares.push(
        <div
          key={`${file}${rank}`}
          className="absolute"
          style={{
            ...at(file, rank),
            width: '12.5%',
            height: '12.5%',
            backgroundColor: light ? WOOD.maple : WOOD.walnut,
            backgroundImage: light ? (file % 2 === 0 ? GRAIN_X : GRAIN_Y) : file % 2 === 0 ? DARK_GRAIN_X : DARK_GRAIN_Y,
            backgroundPosition: `${(file * 37 + rank * 11) % 160}px ${(rank * 53 + file * 7) % 160}px`,
            boxShadow: marked ? 'inset 0 0 0 100px oklch(0.82 0.15 78 / 0.38)' : undefined,
            transition: 'box-shadow 250ms ease',
          }}
        />,
      );
    }
  }

  return (
    <div
      className="relative rounded-[6px] p-[22px]"
      style={{ backgroundColor: WOOD.frame, backgroundImage: FRAME_GRAIN, boxShadow: `${SHADOW.object}, ${SHADOW.bevel}` }}
    >
      <Coordinates flipped={flipped} />
      <div className="relative aspect-square w-full" style={{ boxShadow: `0 0 0 2px ${WOOD.maple}, 0 0 0 4px ${WOOD.walnutDeep}, 0 0 0 5px oklch(0.75 0.06 75)` }}>
        {squares}
        <AnimatePresence initial={false}>
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute"
              style={{ width: '12.5%', height: '12.5%' }}
              initial={{ ...at(piece.file, piece.rank), opacity: 0 }}
              animate={{ ...at(piece.file, piece.rank), opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: flipped ? -60 : 60, scale: 0.85, transition: { duration: 0.35, ease: 'easeIn' } }}
              transition={SLIDE}
            >
              <motion.img
                key={`${piece.file}${piece.rank}`}
                src={pieceUrl(piece.code)}
                alt=""
                draggable={false}
                className="h-full w-full select-none"
                initial={{ scale: 1.1, filter: 'drop-shadow(5px 9px 5px oklch(0.12 0.04 40 / 0.45))' }}
                animate={{ scale: 1, filter: 'drop-shadow(1.5px 3px 1.5px oklch(0.12 0.04 40 / 0.5))' }}
                transition={SETTLE}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Coordinates({ flipped }: { flipped: boolean }) {
  const engraved = { color: 'oklch(0.66 0.07 70)', textShadow: '0 -1px 0 oklch(0.12 0.04 40 / 0.9)' };
  return (
    <>
      <div className="pointer-events-none absolute right-[22px] bottom-[4px] left-[22px] flex text-[11px] font-semibold" style={engraved}>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="flex-1 text-center">
            {FILES[flipped ? 7 - index : index]}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute top-[22px] bottom-[22px] left-[7px] flex flex-col text-[11px] font-semibold" style={engraved}>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="flex flex-1 items-center">
            {flipped ? index + 1 : 8 - index}
          </span>
        ))}
      </div>
    </>
  );
}
