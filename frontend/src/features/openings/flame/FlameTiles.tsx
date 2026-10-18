import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { formatMove } from '../domain/notation';
import { isPlayerMove, type OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { BOUNCE, COLOURS, tile, TONES, ZOOM } from '../workshop/theme';
import { labelFits } from './label';
import { lineTone } from './tone';
import { pathKey, useFlameCamera, type Placement, type Viewport } from './useFlameCamera';
import { useElementWidth } from './useElementWidth';

const ROW = { player: 34, opponent: 22 };
const GAP = 4;

interface FlameTilesProps {
  tree: OpeningTree;
  focusPath: readonly string[];
  onFocusChange: (path: readonly string[]) => void;
  onPoint: (path: readonly string[] | null) => void;
}

export function FlameTiles({ tree, focusPath, onFocusChange, onPoint }: FlameTilesProps) {
  const isPlayerRow = (ply: number) => ply === 0 || isPlayerMove(tree.side, ply);
  const camera = useFlameCamera(tree, focusPath, (ply) => (isPlayerRow(ply) ? ROW.player : ROW.opponent));
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const average = playerAverage(tree);

  const toStyle = (placement: Placement) => ({
    left: `${placement.left * 100}%`,
    width: `${placement.width * 100}%`,
    top: placement.top,
  });

  return (
    <section aria-labelledby="tree-title" className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 id="tree-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
          Your tree
        </h2>
        <nav aria-label="Zoom path" className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
          <Crumb onClick={() => onFocusChange([])} active={focusPath.length === 0}>
            all
          </Crumb>
          <AnimatePresence initial={false}>
            {focusPath.map((san, index) => (
              <motion.span
                key={`${index}-${san}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={BOUNCE}
              >
                <Crumb onClick={() => onFocusChange(focusPath.slice(0, index + 1))} active={index === focusPath.length - 1}>
                  {formatMove(san, index + 1)}
                </Crumb>
              </motion.span>
            ))}
          </AnimatePresence>
        </nav>
      </div>

      <motion.div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        animate={{ height: camera.height }}
        transition={ZOOM}
        onMouseLeave={() => onPoint(null)}
      >
        <AnimatePresence initial={false} custom={camera.viewport}>
          {camera.bars.map((bar) => {
            const placement = camera.place(bar, camera.viewport);
            const player = isPlayerRow(bar.depth);
            const tone = player ? TONES[lineTone(bar.node, average)] : { bg: COLOURS.opponent, fg: COLOURS.leafSoft };
            const label = bar.path.length === 0 ? 'All games' : formatMove(bar.path[bar.path.length - 1], bar.path.length);
            const isFocus = bar.depth === camera.viewport.depth;
            const fontSize = player ? 13 : 11;
            const height = (player ? ROW.player : ROW.opponent) - GAP;
            const widthPx = placement.width * containerWidth;
            return (
              <motion.div
                key={pathKey(bar.path)}
                className="absolute"
                style={{ height }}
                initial={toStyle(camera.place(bar, camera.from))}
                animate={{ ...toStyle(placement), opacity: 1 }}
                exit="exit"
                variants={{ exit: (vp: Viewport) => ({ ...toStyle(camera.place(bar, vp)), opacity: 0 }) }}
                transition={ZOOM}
              >
                <motion.button
                  type="button"
                  aria-label={label}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={BOUNCE}
                  onClick={() => onFocusChange(isFocus ? focusPath.slice(0, -1) : bar.path)}
                  onMouseEnter={() => onPoint(bar.path)}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...tile(tone.bg),
                    color: tone.fg,
                    right: widthPx > 12 ? GAP : 1,
                    borderRadius: Math.min(8, widthPx / 4),
                    fontSize,
                    lineHeight: `${height}px`,
                  }}
                >
                  {labelFits(label, widthPx - GAP, fontSize * 0.85) && <span className="block whitespace-nowrap">{label}</span>}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <ul aria-label="Legend" className="flex flex-wrap gap-2 text-[12px] font-medium">
        {(['losing', 'slipping', 'even', 'winning'] as const).map((tone) => (
          <li key={tone} className="rounded-full px-2.5 py-1" style={{ ...tile(TONES[tone].bg), color: TONES[tone].fg }}>
            {TONES[tone].label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Crumb({ onClick, active, children }: { onClick: () => void; active: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? 'location' : undefined}
      whileTap={{ scale: 0.92 }}
      transition={BOUNCE}
      className="rounded-full px-2.5 py-0.5"
      style={active ? { background: COLOURS.leaf, color: COLOURS.cream } : tile(COLOURS.sand)}
    >
      {children}
    </motion.button>
  );
}
