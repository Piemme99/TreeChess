// PROTOTYPE — direction C « Atelier » : Kumquat assumé. Chaleureux, tactile, des objets qui ont du poids.
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import { formatLine, formatMove } from '../domain/notation';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Priority } from '../domain/priorities';
import { labelFits } from '../flame/label';
import { lineTone, type Tone } from '../flame/tone';
import { useElementWidth } from '../flame/useElementWidth';
import { replayLine } from '../position/replay';
import { AnimatedNumber } from './AnimatedNumber';
import { MotionBoard } from './MotionBoard';
import { pathKey, useFlameCamera, type Placement, type Viewport } from './useFlameCamera';
import type { OpeningsScreen } from './useOpeningsScreen';

const C = {
  cream: 'oklch(0.962 0.028 85)',
  sand: 'oklch(0.915 0.035 80)',
  leaf: 'oklch(0.33 0.06 150)',
  leafSoft: 'oklch(0.50 0.05 150)',
  kumquat: 'oklch(0.73 0.17 55)',
  kumquatDeep: 'oklch(0.60 0.17 45)',
  terracotta: 'oklch(0.60 0.155 35)',
  apricot: 'oklch(0.84 0.11 70)',
  sage: 'oklch(0.72 0.09 145)',
};

const TONE: Record<Tone, { bg: string; fg: string }> = {
  losing: { bg: C.terracotta, fg: 'white' },
  slipping: { bg: C.apricot, fg: C.leaf },
  even: { bg: 'oklch(0.94 0.02 85)', fg: C.leaf },
  winning: { bg: C.sage, fg: 'oklch(0.25 0.05 150)' },
};

const BOUNCE: Transition = { type: 'spring', stiffness: 420, damping: 17 };
const ZOOM: Transition = { type: 'spring', stiffness: 190, damping: 19, mass: 1 };
const PIECE: Transition = { type: 'spring', stiffness: 300, damping: 20 };

const FONT = { fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" };

const tile = (bg: string) => ({
  background: bg,
  boxShadow: `inset 0 1.5px 0 oklch(1 0 0 / 0.45), inset 0 -2px 0 oklch(0 0 0 / 0.12), 0 1px 2px oklch(0.3 0.05 60 / 0.15)`,
});

export function WorkshopVariant({ screen }: { screen: OpeningsScreen }) {
  return (
    <div className="min-h-screen pb-28" style={{ ...FONT, background: C.cream, color: C.leaf }}>
      <header className="mx-auto flex max-w-[84rem] items-center gap-4 px-8 pt-7">
        <Kumquat />
        <span className="text-[26px] font-bold tracking-[-0.03em]">kumquat</span>
        <SideSwitch screen={screen} />
      </header>

      <div className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
        <Board screen={screen} />
        <div className="flex min-w-0 flex-col gap-10">
          <Picks screen={screen} />
          <Tiles screen={screen} />
        </div>
      </div>
    </div>
  );
}

function Kumquat() {
  return (
    <motion.span className="relative block h-9 w-9" whileHover={{ rotate: -12, scale: 1.08 }} transition={BOUNCE}>
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${C.apricot}, ${C.kumquat} 55%, ${C.kumquatDeep})` }} />
      <span className="absolute -top-1 left-1/2 h-3 w-4 -translate-x-1/4 rotate-[-25deg] rounded-[100%_0]" style={{ background: C.sage }} />
    </motion.span>
  );
}

function SideSwitch({ screen }: { screen: OpeningsScreen }) {
  const black = screen.side === 'b';
  return (
    <button
      type="button"
      onClick={() => screen.showSide(black ? 'w' : 'b')}
      className="ml-auto flex items-center gap-3 text-[15px] font-semibold"
      aria-label="Switch side"
    >
      <span style={{ opacity: black ? 0.45 : 1 }}>White</span>
      <span className="relative h-8 w-14 rounded-full p-1" style={{ background: C.sand, boxShadow: 'inset 0 2px 4px oklch(0.3 0.05 60 / 0.18)' }}>
        <motion.span
          className="block h-6 w-6 rounded-full"
          animate={{ x: black ? 24 : 0, background: black ? C.leaf : 'oklch(0.99 0.01 85)' }}
          transition={BOUNCE}
          style={{ boxShadow: '0 2px 4px oklch(0.3 0.05 60 / 0.3)' }}
        />
      </span>
      <span style={{ opacity: black ? 1 : 0.45 }}>Black</span>
    </button>
  );
}

function Board({ screen }: { screen: OpeningsScreen }) {
  const { shown } = screen;
  const tree = screen.trees[shown.side];
  const node = nodeAt(tree, shown.path);
  const fens = useMemo(() => replayLine(shown.path).fens, [shown.path]);
  const opening = useOpeningName(fens);

  return (
    <div className="sticky top-6 flex flex-col gap-4 self-start">
      <div className="rounded-[18px] p-2.5" style={{ background: 'oklch(0.45 0.07 50)', boxShadow: '0 18px 40px -12px oklch(0.35 0.08 50 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.2)' }}>
        <MotionBoard
          path={shown.path}
          flipped={shown.side === 'b'}
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
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">{opening?.name ?? (shown.path.length ? 'Unnamed line' : 'Starting position')}</span>
          <span className="truncate text-[14px]" style={{ color: C.leafSoft }}>
            {formatLine(shown.path) || '—'}
          </span>
        </div>
        {node && (
          <div className="flex shrink-0 gap-2">
            <Chip label="games">
              <AnimatedNumber value={node.games} />
            </Chip>
            <Chip label="score">
              <AnimatedNumber value={scoreRate(node) * 100} format={(v) => `${Math.round(v)}%`} />
            </Chip>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-center rounded-xl px-3 py-1.5" style={tile(C.sand)}>
      <span className="text-[18px] leading-tight font-bold">{children}</span>
      <span className="text-[11px] font-medium" style={{ color: C.leafSoft }}>
        {label}
      </span>
    </span>
  );
}

function Picks({ screen }: { screen: OpeningsScreen }) {
  const heaviest = Math.max(...screen.priorities.map((priority) => priority.pointsToGain));
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[30px] leading-none font-extrabold tracking-[-0.03em]">Fix these first</h2>
      <ol className="grid grid-cols-5 gap-3" onMouseLeave={() => screen.point(null)}>
        {screen.priorities.map((priority, index) => (
          <Ticket
            key={`${priority.side}:${pathKey(priority.path)}`}
            priority={priority}
            rank={index + 1}
            share={priority.pointsToGain / heaviest}
            selected={screen.isShown(priority)}
            screen={screen}
          />
        ))}
      </ol>
    </section>
  );
}

function Ticket({
  priority,
  rank,
  share,
  selected,
  screen,
}: {
  priority: Priority;
  rank: number;
  share: number;
  selected: boolean;
  screen: OpeningsScreen;
}) {
  const fens = useMemo(() => replayLine(priority.path).fens, [priority.path]);
  const opening = useOpeningName(fens);
  const last = priority.path.length;
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: selected ? -8 : 0, rotate: selected ? (rank % 2 ? -2 : 2) : 0 }}
      whileHover={{ y: selected ? -10 : -4 }}
      whileTap={{ scale: 0.96 }}
      transition={{ ...BOUNCE, opacity: { delay: rank * 0.05 }, y: { ...BOUNCE } }}
    >
      <button
        type="button"
        onClick={() => screen.showPriority(priority)}
        onMouseEnter={() => screen.point(priority)}
        onFocus={() => screen.point(priority)}
        className="flex h-full w-full flex-col gap-3 rounded-2xl p-3.5 text-left outline-none transition-shadow duration-200"
        style={{
          background: selected ? C.leaf : 'oklch(0.985 0.012 85)',
          color: selected ? C.cream : C.leaf,
          boxShadow: selected
            ? '0 14px 28px -10px oklch(0.3 0.06 150 / 0.55)'
            : '0 1px 0 oklch(1 0 0 / 0.8) inset, 0 2px 6px -2px oklch(0.35 0.06 60 / 0.2)',
        }}
      >
        <span className="flex items-center justify-between">
          <span className="text-[28px] leading-none font-extrabold" style={{ color: selected ? C.apricot : C.kumquatDeep }}>
            {rank}
          </span>
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: priority.side === 'w' ? 'white' : C.leaf, boxShadow: `0 0 0 1.5px ${selected ? C.cream : C.leaf}` }}
            aria-label={priority.side === 'w' ? 'White' : 'Black'}
          />
        </span>
        <span className="line-clamp-2 min-h-[2.5em] text-[14px] leading-tight font-semibold">{opening?.name ?? 'Unnamed line'}</span>
        <span className="text-[13px]" style={{ opacity: 0.75 }}>
          {formatMove(priority.path[last - 1], last)}
        </span>
        <span className="mt-auto h-2 overflow-hidden rounded-full" style={{ background: selected ? 'oklch(1 0 0 / 0.15)' : C.sand }}>
          <motion.span
            className="block h-full rounded-full"
            style={{ background: C.kumquat }}
            initial={{ width: 0 }}
            animate={{ width: `${share * 100}%` }}
            transition={{ ...ZOOM, delay: 0.2 + rank * 0.07 }}
          />
        </span>
      </button>
    </motion.li>
  );
}

const ROW = { player: 34, opponent: 22 };
const GAP = 4;

function Tiles({ screen }: { screen: OpeningsScreen }) {
  const { tree, focusPath } = screen;
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
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Your tree</h2>
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
          <Crumb onClick={() => screen.zoomTo([])} active={focusPath.length === 0}>
            all
          </Crumb>
          <AnimatePresence initial={false}>
            {focusPath.map((san, index) => (
              <motion.span key={`${index}-${san}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={BOUNCE}>
                <Crumb onClick={() => screen.zoomTo(focusPath.slice(0, index + 1))} active={index === focusPath.length - 1}>
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
        onMouseLeave={() => screen.point(null)}
      >
        <AnimatePresence initial={false} custom={camera.viewport}>
          {camera.bars.map((bar) => {
            const placement = camera.place(bar, camera.viewport);
            const player = isPlayerRow(bar.depth);
            const tone = player ? TONE[lineTone(bar.node, average)] : { bg: 'oklch(0.925 0.025 82)', fg: C.leafSoft };
            const label = bar.path.length === 0 ? 'All games' : formatMove(bar.path[bar.path.length - 1], bar.path.length);
            const isFocus = bar.depth === camera.viewport.depth;
            const fontSize = player ? 13 : 11;
            const height = (player ? ROW.player : ROW.opponent) - GAP;
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
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={BOUNCE}
                  onClick={() => screen.zoomTo(isFocus ? focusPath.slice(0, -1) : bar.path)}
                  onMouseEnter={() => screen.point({ side: tree.side, path: bar.path })}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...tile(tone.bg),
                    color: tone.fg,
                    right: placement.width * containerWidth > 12 ? GAP : 1,
                    borderRadius: Math.min(8, (placement.width * containerWidth) / 4),
                    fontSize,
                    lineHeight: `${height}px`,
                  }}
                >
                  {labelFits(label, placement.width * containerWidth - GAP, fontSize * 0.85) && (
                    <span className="block whitespace-nowrap">{label}</span>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <div className="flex flex-wrap gap-2 text-[12px] font-medium">
        {(['losing', 'slipping', 'even', 'winning'] as const).map((tone) => (
          <span key={tone} className="rounded-full px-2.5 py-1" style={{ ...tile(TONE[tone].bg), color: TONE[tone].fg }}>
            {tone === 'losing' ? 'leaking' : tone === 'slipping' ? 'shaky' : tone === 'even' ? 'par' : 'solid'}
          </span>
        ))}
      </div>
    </section>
  );
}

function Crumb({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={BOUNCE}
      className="rounded-full px-2.5 py-0.5"
      style={active ? { background: C.leaf, color: C.cream } : { ...tile(C.sand) }}
    >
      {children}
    </motion.button>
  );
}
