// PROTOTYPE L « Player rows » — plus de rangées adverses : une rangée par coup du joueur, une
// tuile = (coup adverse, réponse du joueur). Le graphe est deux fois moins haut ; le coup
// adverse se lit en préfixe discret de la tuile et les tuiles d'un même coup adverse sont
// serrées entre elles. Contredit la décision du README « les coups adverses sont des rangées
// grises fines » : c'est le point à juger.
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { figurineMove } from '../design-prototype/figurines';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Side } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import { labelFits } from '../flame/label';
import { lineTone, type Tone } from '../flame/tone';
import { useElementWidth } from '../flame/useElementWidth';
import type { FlameSlotProps } from '../OpeningsPage';
import { COLOURS, SPRING, tile, ZOOM } from '../workshop/theme';
import { Badge, Crumbs, HoverCard, type Hover } from './parts';
import { layoutPruned, marksFor, playerMoveStep, type PlacedTile } from './prune';

const ROW = 40;
const GAP = 3;
const GROUP_GAP = 9;

const TONES: Record<Tone, { bg: string; fg: string; label: string }> = {
  losing: { bg: COLOURS.terracotta, fg: 'white', label: 'leaking' },
  slipping: { bg: COLOURS.apricot, fg: COLOURS.leaf, label: 'shaky' },
  even: { bg: 'oklch(0.975 0.012 85)', fg: COLOURS.leafSoft, label: 'par' },
  winning: { bg: 'oklch(0.88 0.045 145)', fg: 'oklch(0.32 0.05 150)', label: 'solid' },
};

const REST = { bg: 'repeating-linear-gradient(135deg, oklch(0.93 0.02 85) 0 4px, oklch(0.965 0.015 85) 4px 8px)', fg: COLOURS.leafSoft };

// Remonter d'un cran = retirer la paire (coup adverse, réponse), ou le seul demi-coup qui reste.
function upFrom(path: readonly string[], side: Side): readonly string[] {
  if (path.length >= 2 && isPlayerMove(side, path.length)) return path.slice(0, -2);
  return path.slice(0, -1);
}

export function PlayerRowsFlame({ tree, focusPath, onFocusChange, onPoint, priorities }: FlameSlotProps) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const average = playerAverage(tree);

  const tiles = useMemo(() => {
    const focus = nodeAt(tree, focusPath) ?? tree.root;
    return layoutPruned(focus, focusPath, playerMoveStep(tree.side), {
      widthPx: containerWidth || 800,
      minPx: 34,
      coverageFloor: 0.4,
      minRows: 4,
      maxRows: 12,
    });
  }, [tree, focusPath, containerWidth]);
  const marks = useMemo(
    () => marksFor(tiles, priorities.filter((priority) => priority.side === tree.side)),
    [tiles, priorities, tree.side],
  );

  const rows = Math.max(0, ...tiles.map((t) => t.depth)) + 1;
  const height = rows * ROW;

  const label = (placed: PlacedTile, widthPx: number) => {
    if (placed.rest) return { via: '', move: labelFits('…', widthPx, 11) ? '…' : '' };
    if (placed.path.length === 0) return { via: '', move: 'All games' };
    const move = figurineMove(placed.path[placed.path.length - 1], placed.path.length);
    const via = placed.via ? `…${placed.via.replace(/^([KQRBN])/, (p) => ({ K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' })[p] ?? p)} ` : '';
    const stats = ` · ${placed.node.games} · ${formatPercent(scoreRate(placed.node))}`;
    if (labelFits(via + move + stats, widthPx, 11)) return { via, move: move + stats };
    if (labelFits(via + move, widthPx, 11)) return { via, move };
    return { via: '', move: labelFits(move, widthPx, 11) ? move : '' };
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
            const rowHeight = ROW - GAP;
            const widthPx = placed.width * containerWidth;
            const right = placed.groupEnd && placed.depth > 0 ? GROUP_GAP : GAP;
            const tone = placed.rest ? REST : TONES[lineTone(placed.node, average)];
            const text = label(placed, widthPx - right - 10);
            const mark = marks.get(placed.key);
            const isFocus = placed.depth === 0;
            return (
              <motion.div
                key={placed.key}
                className="absolute"
                style={{ height: rowHeight }}
                initial={{ opacity: 0, left: `${placed.start * 100}%`, width: `${placed.width * 100}%`, top: placed.depth * ROW }}
                animate={{ opacity: 1, left: `${placed.start * 100}%`, width: `${placed.width * 100}%`, top: placed.depth * ROW }}
                exit={{ opacity: 0 }}
                transition={ZOOM}
              >
                <motion.button
                  type="button"
                  aria-label={placed.rest ? `${placed.rest} other lines` : `${text.via}${text.move}` || placed.key}
                  whileHover={placed.rest ? undefined : { y: -2 }}
                  whileTap={placed.rest ? undefined : { scale: 0.95, y: 1 }}
                  transition={SPRING}
                  disabled={placed.rest > 0}
                  onClick={() => onFocusChange(isFocus ? upFrom(focusPath, tree.side) : placed.path)}
                  onMouseEnter={(event) => {
                    setHover({ tile: placed, x: event.clientX, y: event.clientY });
                    onPoint(placed.path);
                  }}
                  onMouseMove={(event) => setHover({ tile: placed, x: event.clientX, y: event.clientY })}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left text-[13px] font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...(placed.rest ? { background: REST.bg, boxShadow: 'inset 0 0 0 1px oklch(0.88 0.02 85)' } : tile(tone.bg)),
                    ...(tone === TONES.even ? { boxShadow: 'inset 0 0 0 1px oklch(0.9 0.02 85)' } : {}),
                    color: tone.fg,
                    right: widthPx > 12 ? right : 1,
                    borderRadius: Math.min(8, widthPx / 4),
                    lineHeight: `${rowHeight}px`,
                  }}
                >
                  {(text.via || text.move) && (
                    <span className="block whitespace-nowrap">
                      {text.via && <span className="font-normal opacity-60">{text.via}</span>}
                      {text.move}
                    </span>
                  )}
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
        <li style={{ color: COLOURS.leafSoft }}>one row per move of yours · <span className="opacity-60">…c5</span> = their move before it</li>
      </ul>

      <HoverCard hover={hover} average={average} />
    </section>
  );
}
