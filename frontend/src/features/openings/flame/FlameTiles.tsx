import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { figurineMove } from '../domain/notation';
import { isPlayerMove, nodeAt, type OpeningTree } from '../domain/openingTree';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Priority } from '../domain/priorities';
import { COLOURS, REPERTOIRE, SPRING, tile, TONES, ZOOM } from '../workshop/theme';
import { formatPercent } from './format';
import { labelFits } from './label';
import { layoutPruned, marksFor, type PlacedTile } from './prune';
import { HoverCard, PriorityBadge, type Hover } from './TileHints';
import { lineTone } from './tone';
import { useElementWidth } from './useElementWidth';

const ROW = { player: 32, opponent: 14 };
const GAP = 3;
const PRUNE = { minPx: 28, coverageFloor: 0.4, minRows: 6, maxRows: 24 };
// Largeur de secours tant que le conteneur n'est pas mesuré (premier rendu, tests).
const FALLBACK_WIDTH = 800;

const REST = {
  bg: 'repeating-linear-gradient(135deg, oklch(0.93 0.02 85) 0 4px, oklch(0.965 0.015 85) 4px 8px)',
  fg: COLOURS.leafSoft,
  edge: 'inset 0 0 0 1px oklch(0.88 0.02 85)',
};
const OPPONENT = { bg: COLOURS.opponent, fg: COLOURS.leafSoft };
const RIM = `inset 0 0 0 2px ${REPERTOIRE}`;

interface FlameTilesProps {
  tree: OpeningTree;
  focusPath: readonly string[];
  onFocusChange: (path: readonly string[]) => void;
  onPoint: (path: readonly string[] | null) => void;
  priorities: readonly Priority[];
  /** Chemins (coups joints par des espaces) restés dans le répertoire. */
  coveredLines: ReadonlySet<string>;
}

export function FlameTiles({ tree, focusPath, onFocusChange, onPoint, priorities, coveredLines }: FlameTilesProps) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const average = playerAverage(tree);
  const isPlayerRow = (depth: number) => depth === 0 || isPlayerMove(tree.side, focusPath.length + depth);
  const widthPx = containerWidth || FALLBACK_WIDTH;

  const tiles = useMemo(
    () => layoutPruned(nodeAt(tree, focusPath) ?? tree.root, focusPath, { ...PRUNE, widthPx }),
    [tree, focusPath, widthPx],
  );
  const marks = useMemo(
    () => marksFor(tiles, priorities.filter((priority) => priority.side === tree.side)),
    [tiles, priorities, tree.side],
  );

  const rows = Math.max(0, ...tiles.map((placed) => placed.depth)) + 1;
  const tops: number[] = [];
  let height = 0;
  for (let depth = 0; depth < rows; depth++) {
    tops.push(height);
    height += isPlayerRow(depth) ? ROW.player : ROW.opponent;
  }

  const leave = () => {
    setHover(null);
    onPoint(null);
  };

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
                transition={SPRING}
              >
                <Crumb onClick={() => onFocusChange(focusPath.slice(0, index + 1))} active={index === focusPath.length - 1}>
                  {figurineMove(san, index + 1)}
                </Crumb>
              </motion.span>
            ))}
          </AnimatePresence>
        </nav>
      </div>

      <motion.div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        animate={{ height }}
        transition={ZOOM}
        onMouseLeave={leave}
      >
        <AnimatePresence initial={false}>
          {tiles.map((placed) => {
            const player = isPlayerRow(placed.depth);
            const rowHeight = (player ? ROW.player : ROW.opponent) - GAP;
            const fontSize = player ? 13 : 9;
            const tileWidth = placed.width * widthPx;
            const tone = placed.rest ? REST : player ? TONES[lineTone(placed.node, average)] : OPPONENT;
            const name = tileName(placed);
            const text = tileLabel(placed, name, tileWidth - GAP - 8, fontSize * 0.85);
            const mark = marks.get(placed.key);
            const covered = !placed.rest && placed.path.length > 0 && coveredLines.has(placed.path.join(' '));
            const surface = placed.rest ? { background: REST.bg, boxShadow: REST.edge } : tile(tone.bg);
            const edge = tone === TONES.even ? REST.edge : surface.boxShadow;
            const position = { left: `${placed.start * 100}%`, width: `${placed.width * 100}%`, top: tops[placed.depth] };
            return (
              <motion.div
                key={placed.key}
                className="absolute"
                style={{ height: rowHeight }}
                initial={{ ...position, opacity: 0 }}
                animate={{ ...position, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={ZOOM}
              >
                <motion.button
                  type="button"
                  aria-label={name}
                  disabled={placed.rest > 0}
                  data-repertoire={covered || undefined}
                  whileHover={placed.rest ? undefined : { y: -2 }}
                  whileTap={placed.rest ? undefined : { scale: 0.95, y: 1 }}
                  transition={SPRING}
                  onClick={() => onFocusChange(placed.depth === 0 ? focusPath.slice(0, -1) : placed.path)}
                  onMouseEnter={(event) => {
                    setHover({ tile: placed, x: event.clientX, y: event.clientY });
                    onPoint(placed.path);
                  }}
                  onMouseMove={(event) => setHover({ tile: placed, x: event.clientX, y: event.clientY })}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...surface,
                    boxShadow: covered ? `${RIM}, ${edge}` : edge,
                    color: tone.fg,
                    right: tileWidth > 12 ? GAP : 1,
                    borderRadius: Math.min(6, tileWidth / 4),
                    fontSize,
                    lineHeight: `${rowHeight}px`,
                  }}
                >
                  {text && <span className="block whitespace-nowrap">{text}</span>}
                  {mark && <PriorityBadge mark={mark} />}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <ul aria-label="Legend" className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
        {(['losing', 'slipping', 'even', 'winning'] as const).map((toneKey) => (
          <li key={toneKey} className="rounded-full px-2.5 py-1" style={{ ...tile(TONES[toneKey].bg), color: TONES[toneKey].fg }}>
            {TONES[toneKey].label}
          </li>
        ))}
        <li className="rounded-full px-2.5 py-1" style={{ background: REST.bg, color: REST.fg }}>
          … too thin to read
        </li>
        <li className="rounded-full px-2.5 py-1" style={{ background: TONES.even.bg, boxShadow: RIM, color: COLOURS.leafSoft }}>
          in your repertoire
        </li>
        <li className="flex items-center gap-1.5" style={{ color: COLOURS.leafSoft }}>
          <span
            className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[9px] font-extrabold"
            style={{ background: COLOURS.leaf, color: COLOURS.cream }}
          >
            1
          </span>
          priority
        </li>
      </ul>

      <HoverCard hover={hover} average={average} />
    </section>
  );
}

function tileName(placed: PlacedTile): string {
  if (placed.rest) return `${placed.rest} other lines`;
  if (placed.path.length === 0) return 'All games';
  return figurineMove(placed.path[placed.path.length - 1], placed.path.length);
}

// Du plus bavard au plus court : coup, parties et score ; le coup seul ; rien.
function tileLabel(placed: PlacedTile, name: string, widthPx: number, fontSize: number): string {
  if (placed.rest) return labelFits('…', widthPx, fontSize) ? '…' : '';
  const full = `${name} · ${placed.node.games} · ${formatPercent(scoreRate(placed.node))}`;
  if (labelFits(full, widthPx, fontSize)) return full;
  return labelFits(name, widthPx, fontSize) ? name : '';
}

function Crumb({ onClick, active, children }: { onClick: () => void; active: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? 'location' : undefined}
      whileTap={{ scale: 0.92 }}
      transition={SPRING}
      className="rounded-full px-2.5 py-0.5"
      style={active ? { background: COLOURS.leaf, color: COLOURS.cream } : tile(COLOURS.sand)}
    >
      {children}
    </motion.button>
  );
}
