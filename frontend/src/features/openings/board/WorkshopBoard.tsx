import { PIECE } from '../workshop/theme';
import { MotionBoard } from './MotionBoard';

export function WorkshopBoard({ path, flipped }: { path: readonly string[]; flipped: boolean }) {
  return (
    <div
      className="rounded-[18px] p-2.5"
      style={{ background: 'oklch(0.45 0.07 50)', boxShadow: '0 18px 40px -12px oklch(0.35 0.08 50 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.2)' }}
    >
      <MotionBoard
        path={path}
        flipped={flipped}
        transition={PIECE}
        className="overflow-hidden rounded-[10px]"
        pieceStyle={{ filter: 'drop-shadow(0 2px 1.5px oklch(0.2 0.05 50 / 0.35))' }}
        squareStyle={(light, mark) => ({
          background: mark
            ? light
              ? 'oklch(0.86 0.13 75)'
              : 'oklch(0.72 0.15 60)'
            : light
              ? 'oklch(0.91 0.045 80)'
              : 'oklch(0.66 0.075 60)',
        })}
      />
    </div>
  );
}
