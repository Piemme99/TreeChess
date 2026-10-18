// PROTOTYPE K « Pruned » — la structure actuelle, avec toutes les propositions : miettes
// fondues dans une tuile « reste », profondeur coupée quand la rangée se vide, gris qui recule,
// vert désaturé, priorités repérées sur le graphe, rangées adverses fines, étiquettes à
// figurines enrichies des chiffres quand la place le permet, carte au survol.
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { figurineMove } from '../design-prototype/figurines';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import { playerAverage, scoreRate } from '../domain/performance';
import { formatPercent } from '../flame/format';
import { labelFits } from '../flame/label';
import { lineTone, type Tone } from '../flame/tone';
import { useElementWidth } from '../flame/useElementWidth';
import type { FlameSlotProps } from '../OpeningsPage';
import { COLOURS, SPRING, tile, ZOOM } from '../workshop/theme';
import { Badge, Crumbs, HoverCard, type Hover } from './parts';
import { halfMoveStep, layoutPruned, marksFor, type PlacedTile } from './prune';

const ROW = { player: 32, opponent: 14 };
const GAP = 3;

const TONES: Record<Tone, { bg: string; fg: string; label: string }> = {
  losing: { bg: COLOURS.terracotta, fg: 'white', label: 'leaking' },
  slipping: { bg: COLOURS.apricot, fg: COLOURS.leaf, label: 'shaky' },
  even: { bg: 'oklch(0.975 0.012 85)', fg: COLOURS.leafSoft, label: 'par' },
  winning: { bg: 'oklch(0.88 0.045 145)', fg: 'oklch(0.32 0.05 150)', label: 'solid' },
};

const REST = { bg: 'repeating-linear-gradient(135deg, oklch(0.93 0.02 85) 0 4px, oklch(0.965 0.015 85) 4px 8px)', fg: COLOURS.leafSoft };

export function PrunedFlame({ tree, focusPath, onFocusChange, onPoint, priorities }: FlameSlotProps) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const average = playerAverage(tree);
  const isPlayerRow = (depth: number) => depth === 0 || isPlayerMove(tree.side, focusPath.length + depth);

  const tiles = useMemo(() => {
    const focus = nodeAt(tree, focusPath) ?? tree.root;
    return layoutPruned(focus, focusPath, halfMoveStep, {
      widthPx: containerWidth || 800,
      minPx: 28,
      coverageFloor: 0.4,
      minRows: 6,
      maxRows: 24,
    });
  }, [tree, focusPath, containerWidth]);
  const marks = useMemo(
    () => marksFor(tiles, priorities.filter((priority) => priority.side === tree.side)),
    [tiles, priorities, tree.side],
  );

  const rows = Math.max(0, ...tiles.map((t) => t.depth)) + 1;
  const tops: number[] = [];
  for (let depth = 0, top = 0; depth < rows; depth++) {
    tops.push(top);
    top += isPlayerRow(depth) ? ROW.player : ROW.opponent;
  }
  const height = tops[rows - 1] + (isPlayerRow(rows - 1) ? ROW.player : ROW.opponent);

  const label = (placed: PlacedTile, widthPx: number, fontSize: number) => {
    if (placed.rest) return labelFits('…', widthPx, fontSize) ? '…' : '';
    const move = placed.path.length === 0 ? 'All games' : figurineMove(placed.path[placed.path.length - 1], placed.path.length);
    const full = `${move} · ${placed.node.games} · ${formatPercent(scoreRate(placed.node))}`;
    if (labelFits(full, widthPx, fontSize)) return full;
    return labelFits(move, widthPx, fontSize) ? move : '';
  };

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
        <Crumbs path={focusPath} onNavigate={onFocusChange} />
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
            const widthPx = placed.width * containerWidth;
            const tone = placed.rest ? REST : player ? TONES[lineTone(placed.node, average)] : { bg: COLOURS.opponent, fg: COLOURS.leafSoft };
            const text = label(placed, widthPx - GAP - 8, fontSize * 0.85);
            const mark = marks.get(placed.key);
            const isFocus = placed.depth === 0;
            return (
              <motion.div
                key={placed.key}
                className="absolute"
                style={{ height: rowHeight }}
                initial={{ opacity: 0, left: `${placed.start * 100}%`, width: `${placed.width * 100}%`, top: tops[placed.depth] }}
                animate={{ opacity: 1, left: `${placed.start * 100}%`, width: `${placed.width * 100}%`, top: tops[placed.depth] }}
                exit={{ opacity: 0 }}
                transition={ZOOM}
              >
                <motion.button
                  type="button"
                  aria-label={placed.rest ? `${placed.rest} other lines` : text || placed.key}
                  whileHover={placed.rest ? undefined : { y: -2 }}
                  whileTap={placed.rest ? undefined : { scale: 0.95, y: 1 }}
                  transition={SPRING}
                  disabled={placed.rest > 0}
                  onClick={() => onFocusChange(isFocus ? focusPath.slice(0, -1) : placed.path)}
                  onMouseEnter={(event) => {
                    setHover({ tile: placed, x: event.clientX, y: event.clientY });
                    onPoint(placed.path);
                  }}
                  onMouseMove={(event) => setHover({ tile: placed, x: event.clientX, y: event.clientY })}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...(placed.rest ? { background: REST.bg, boxShadow: 'inset 0 0 0 1px oklch(0.88 0.02 85)' } : tile(tone.bg)),
                    ...(tone === TONES.even ? { boxShadow: 'inset 0 0 0 1px oklch(0.9 0.02 85)' } : {}),
                    color: tone.fg,
                    right: widthPx > 12 ? GAP : 1,
                    borderRadius: Math.min(6, widthPx / 4),
                    fontSize,
                    lineHeight: `${rowHeight}px`,
                  }}
                >
                  {text && <span className="block whitespace-nowrap">{text}</span>}
                  {mark && <Badge mark={mark} />}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <ul aria-label="Legend" className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
        {(['losing', 'slipping', 'even', 'winning'] as const).map((tone) => (
          <li key={tone} className="rounded-full px-2.5 py-1" style={{ ...tile(TONES[tone].bg), color: TONES[tone].fg }}>
            {TONES[tone].label}
          </li>
        ))}
        <li className="rounded-full px-2.5 py-1" style={{ background: REST.bg, color: REST.fg }}>
          … too thin to read
        </li>
        <li className="flex items-center gap-1.5" style={{ color: COLOURS.leafSoft }}>
          <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[9px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
            1
          </span>
          priority
        </li>
      </ul>

      <HoverCard hover={hover} average={average} />
    </section>
  );
}
