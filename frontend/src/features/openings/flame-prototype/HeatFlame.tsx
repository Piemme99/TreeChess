// PROTOTYPE M « Heat » — le graphe comme carte de chaleur : tuiles plates bord à bord, couleur
// continue (plus la ligne fuit, plus elle est rouge ; la moyenne est la couleur du papier),
// rangées adverses réduites à un filet, étiquettes rares. Les mots vivent dans un bandeau
// sous le graphe, qui suit le survol, plutôt que dans une bulle.
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { figurineMove } from '../design-prototype/figurines';
import { isPlayerMove, nodeAt, type OpeningNode } from '../domain/openingTree';
import { deficit, playerAverage } from '../domain/performance';
import { labelFits } from '../flame/label';
import { useElementWidth } from '../flame/useElementWidth';
import type { FlameSlotProps } from '../OpeningsPage';
import { COLOURS, ZOOM } from '../workshop/theme';
import { headline, summary } from './describe';
import { Badge, Crumbs } from './parts';
import { halfMoveStep, layoutPruned, marksFor, type PlacedTile } from './prune';

const ROW = { player: 30, opponent: 7 };
const FULL_HEAT = 0.12;
const PAPER = 'oklch(0.965 0.015 85)';

// Écart signé en points par partie, saturé à ±FULL_HEAT ; le gris de « moins de 20 parties »
// disparaît : l'écart est déjà ramené vers zéro par le lissage.
function heat(node: OpeningNode, average: number): string {
  const gap = deficit(node, average);
  const strength = Math.min(1, Math.abs(gap) / FULL_HEAT);
  const ink = gap > 0 ? COLOURS.terracotta : COLOURS.sage;
  return `color-mix(in oklch, ${ink} ${Math.round(strength * 100)}%, ${PAPER})`;
}

function inkFor(node: OpeningNode, average: number): string {
  return Math.abs(deficit(node, average)) / FULL_HEAT > 0.55 ? 'white' : COLOURS.leaf;
}

export function HeatFlame({ tree, focusPath, onFocusChange, onPoint, priorities }: FlameSlotProps) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<PlacedTile | null>(null);
  const average = playerAverage(tree);
  const isPlayerRow = (depth: number) => depth === 0 || isPlayerMove(tree.side, focusPath.length + depth);

  const tiles = useMemo(() => {
    const focus = nodeAt(tree, focusPath) ?? tree.root;
    return layoutPruned(focus, focusPath, halfMoveStep, {
      widthPx: containerWidth || 800,
      minPx: 8,
      coverageFloor: 0.3,
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

  const shown = hovered ?? tiles[0];

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
        className="relative w-full overflow-hidden rounded-xl"
        style={{ background: PAPER, boxShadow: 'inset 0 0 0 1px oklch(0.9 0.02 85)' }}
        animate={{ height }}
        transition={ZOOM}
        onMouseLeave={() => {
          setHovered(null);
          onPoint(null);
        }}
      >
        <AnimatePresence initial={false}>
          {tiles.map((placed) => {
            const player = isPlayerRow(placed.depth);
            const rowHeight = player ? ROW.player : ROW.opponent;
            const widthPx = placed.width * containerWidth;
            const text =
              player && !placed.rest && placed.path.length > 0
                ? figurineMove(placed.path[placed.path.length - 1], placed.path.length)
                : placed.path.length === 0 && player
                  ? 'All games'
                  : '';
            const fits = text && labelFits(text, widthPx - 10, 11);
            const mark = marks.get(placed.key);
            const isFocus = placed.depth === 0;
            const background = placed.rest ? 'transparent' : player ? heat(placed.node, average) : COLOURS.sand;
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
                <button
                  type="button"
                  aria-label={placed.rest ? `${placed.rest} other lines` : text || placed.key}
                  disabled={placed.rest > 0}
                  onClick={() => onFocusChange(isFocus ? focusPath.slice(0, -1) : placed.path)}
                  onMouseEnter={() => {
                    setHovered(placed);
                    onPoint(placed.path);
                  }}
                  className="absolute inset-y-0 left-0 overflow-hidden px-1.5 text-left text-[12px] font-semibold outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2"
                  style={{
                    background,
                    color: player && !placed.rest ? inkFor(placed.node, average) : COLOURS.leaf,
                    right: 1,
                    top: player ? 1 : 1,
                    bottom: 1,
                    borderRadius: 3,
                    lineHeight: `${rowHeight - 2}px`,
                    outline: hovered?.key === placed.key ? `2px solid ${COLOURS.leaf}` : undefined,
                    outlineOffset: -2,
                  }}
                >
                  {fits && <span className="block whitespace-nowrap">{text}</span>}
                  {mark && <Badge mark={mark} />}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <div
        aria-live="polite"
        className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl px-4 text-[13px]"
        style={{ background: COLOURS.leaf, color: COLOURS.cream }}
      >
        <span className="font-bold">{shown ? headline(shown) : ''}</span>
        <span style={{ color: 'oklch(0.85 0.03 85)' }}>{shown ? summary(shown.node, average) : ''}</span>
      </div>

      <div className="flex items-center gap-3 text-[12px] font-medium" style={{ color: COLOURS.leafSoft }}>
        <span>solid</span>
        <span
          className="h-3 w-40 rounded-full"
          style={{ background: `linear-gradient(90deg, ${COLOURS.sage}, ${PAPER} 50%, ${COLOURS.terracotta})`, boxShadow: 'inset 0 0 0 1px oklch(0.88 0.02 85)' }}
        />
        <span>leaking</span>
        <span className="ml-3">thin strips = their moves</span>
      </div>
    </section>
  );
}
