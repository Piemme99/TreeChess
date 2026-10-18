import { BOARD, PIECE } from '../workshop/theme';
import { MotionBoard } from './MotionBoard';

export function WorkshopBoard({ path, flipped, hidden }: { path: readonly string[]; flipped: boolean; hidden?: string }) {
  return (
    <div
      className="rounded-[18px] p-2.5"
      style={{ background: BOARD.frame, boxShadow: '0 18px 40px -12px oklch(0.3 0.06 150 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.2)' }}
    >
      <MotionBoard
        path={path}
        flipped={flipped}
        transition={PIECE}
        hidden={hidden}
        className="overflow-hidden rounded-[10px]"
        pieceStyle={{ filter: 'drop-shadow(0 2px 1.5px oklch(0.2 0.05 50 / 0.35))' }}
        squareStyle={(light, mark) => ({
          background: mark ? (light ? BOARD.markLight : BOARD.markDark) : light ? BOARD.light : BOARD.dark,
        })}
      />
    </div>
  );
}
