// PROTOTYPE — direction « Workshop · wood » : Workshop tel quel (crème, kumquat, ressorts),
// mais tous les objets qu'on touche passent en bois : échiquier, tickets, tuiles, interrupteur.
import { AnimatePresence, motion, MotionConfig, type Transition } from 'framer-motion';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Priority } from '../domain/priorities';
import { labelFits } from '../flame/label';
import { lineTone, type Tone } from '../flame/tone';
import { useElementWidth } from '../flame/useElementWidth';
import { replayLine } from '../position/replay';
import { AnimatedNumber } from '../workshop/AnimatedNumber';
import { figurineLine, figurineMove } from './figurines';
import { play, useSoundToggle } from './sounds';
import { pathKey, useFlameCamera, type Placement, type Viewport } from '../flame/useFlameCamera';
import type { OpeningsScreen } from './useOpeningsScreen';
import { useReplayedPath } from './useReplayedPath';
import { WoodBoard } from './WoodBoard';
import { grain, PAPER, SHADOW, WOOD } from './wood';

const C = {
  cream: 'oklch(0.962 0.028 85)',
  leaf: 'oklch(0.33 0.06 150)',
  leafSoft: 'oklch(0.50 0.05 150)',
  kumquat: 'oklch(0.73 0.17 55)',
  kumquatDeep: 'oklch(0.60 0.17 45)',
  burnt: 'oklch(0.36 0.07 45)',
  maple: 'oklch(0.88 0.05 82)',
  birch: 'oklch(0.92 0.03 84)',
};

const STAIN: Record<Tone, { bg: string; fg: string }> = {
  losing: { bg: 'oklch(0.57 0.15 36)', fg: 'white' },
  slipping: { bg: 'oklch(0.79 0.12 68)', fg: C.burnt },
  even: { bg: C.maple, fg: C.leaf },
  winning: { bg: 'oklch(0.68 0.09 140)', fg: 'oklch(0.24 0.05 150)' },
};
const OPPONENT_STAIN = { bg: C.birch, fg: C.leafSoft };

const BOUNCE: Transition = { type: 'spring', stiffness: 420, damping: 17 };
const ZOOM: Transition = { type: 'spring', stiffness: 190, damping: 19, mass: 1 };

const FONT: CSSProperties = { fontFamily: "'Bricolage Grotesque', 'Noto Sans Symbols 2', system-ui, sans-serif" };

const GRAINS = [grain('x', { seed: 21, strength: 0.38 }), grain('x', { seed: 22, strength: 0.38 }), grain('x', { seed: 23, strength: 0.38 })];
const DARK_GRAIN = grain('x', { seed: 24, strength: 0.7 });

const wood = (colour: string, seed = 0, dark = false): CSSProperties => ({
  backgroundColor: colour,
  backgroundImage: dark ? DARK_GRAIN : GRAINS[seed % GRAINS.length],
  backgroundPosition: `${(seed * 47) % 160}px ${(seed * 29) % 160}px`,
  boxShadow: `${SHADOW.bevel}, ${SHADOW.resting}`,
});

const burnt: CSSProperties = { color: C.burnt, textShadow: '0 1px 0 oklch(1 0 0 / 0.35)' };

export function WorkshopWoodVariant({ screen }: { screen: OpeningsScreen }) {
  const [source, setSource] = useState<'list' | 'flame'>('list');
  const pointFrom = (from: 'list' | 'flame') => (line: Parameters<OpeningsScreen['point']>[0]) => {
    if (line) setSource(from);
    screen.point(line);
  };
  const shownPath = useReplayedPath(screen.shown.path, screen.pointed && source === 'flame' ? 'jump' : 'replay');

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-28" style={{ ...FONT, backgroundColor: C.cream, backgroundImage: PAPER, color: C.leaf }}>
        <header className="mx-auto flex max-w-[84rem] items-center gap-4 px-8 pt-7">
          <Kumquat />
          <span className="text-[26px] font-bold tracking-[-0.03em]">kumquat</span>
          <SoundSwitch />
          <SideSwitch screen={screen} />
        </header>

        <div className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
          <Board screen={screen} path={shownPath} />
          <div className="flex min-w-0 flex-col gap-10">
            <Picks screen={screen} onPoint={pointFrom('list')} />
            <Tiles screen={screen} onPoint={pointFrom('flame')} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function Kumquat() {
  return (
    <motion.span className="relative block h-9 w-9" whileHover={{ rotate: -12, scale: 1.08 }} transition={BOUNCE}>
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, oklch(0.86 0.12 72), ${C.kumquat} 55%, ${C.kumquatDeep})`, boxShadow: SHADOW.resting }} />
      <span className="absolute -top-1 left-1/2 h-3 w-4 -translate-x-1/4 rotate-[-25deg] rounded-[100%_0]" style={{ background: 'oklch(0.72 0.09 145)' }} />
    </motion.span>
  );
}

function SoundSwitch() {
  const [enabled, toggle] = useSoundToggle();
  return (
    <motion.button
      type="button"
      onClick={() => {
        toggle();
        if (!enabled) play('tock');
      }}
      whileTap={{ scale: 0.92, y: 1 }}
      transition={BOUNCE}
      className="ml-auto rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{ ...wood(C.maple, 4), ...burnt, opacity: enabled ? 1 : 0.6 }}
    >
      {enabled ? '♪ sound' : '♪ muted'}
    </motion.button>
  );
}

function SideSwitch({ screen }: { screen: OpeningsScreen }) {
  const black = screen.side === 'b';
  return (
    <button
      type="button"
      onClick={() => {
        play('plunger');
        screen.showSide(black ? 'w' : 'b');
      }}
      className="flex items-center gap-3 text-[15px] font-semibold"
      aria-label="Switch side"
    >
      <span style={{ opacity: black ? 0.45 : 1 }}>White</span>
      <span className="relative h-8 w-14 rounded-full p-1" style={{ ...wood(WOOD.walnut, 1, true), boxShadow: SHADOW.recessed }}>
        <motion.span
          className="block h-6 w-6 rounded-full"
          animate={{ x: black ? 24 : 0 }}
          transition={BOUNCE}
          style={{ ...wood(black ? WOOD.walnutDeep : C.maple, 2, black), boxShadow: `${SHADOW.bevel}, 1px 2px 3px oklch(0.2 0.05 50 / 0.45)` }}
        />
      </span>
      <span style={{ opacity: black ? 1 : 0.45 }}>Black</span>
    </button>
  );
}

function Board({ screen, path }: { screen: OpeningsScreen; path: readonly string[] }) {
  const side = screen.shown.side;
  const node = nodeAt(screen.trees[side], path);
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);

  return (
    <div className="sticky top-6 flex flex-col gap-4 self-start">
      <WoodBoard path={path} flipped={side === 'b'} />
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="flex min-w-0 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={opening?.name ?? 'none'}
              className="truncate text-[19px] font-semibold tracking-[-0.01em]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
            </motion.span>
          </AnimatePresence>
          <span className="truncate text-[14px]" style={{ color: C.leafSoft }}>
            {figurineLine(path) || '—'}
          </span>
        </div>
        {node && (
          <div className="flex shrink-0 gap-2">
            <Chip label="games" seed={5}>
              <AnimatedNumber value={node.games} />
            </Chip>
            <Chip label="score" seed={6}>
              <AnimatedNumber value={scoreRate(node) * 100} format={(v) => `${Math.round(v)}%`} />
            </Chip>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, seed, children }: { label: string; seed: number; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center rounded-xl px-3 py-1.5" style={{ ...wood(C.maple, seed), ...burnt }}>
      <span className="text-[18px] leading-tight font-bold">{children}</span>
      <span className="text-[11px] font-medium opacity-80">{label}</span>
    </span>
  );
}

function Picks({ screen, onPoint }: { screen: OpeningsScreen; onPoint: (priority: Priority | null) => void }) {
  const heaviest = Math.max(...screen.priorities.map((priority) => priority.pointsToGain));
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[30px] leading-none font-extrabold tracking-[-0.03em]">Fix these first</h2>
      <ol className="grid grid-cols-5 gap-3" onMouseLeave={() => onPoint(null)}>
        {screen.priorities.map((priority, index) => (
          <Block
            key={`${priority.side}:${pathKey(priority.path)}`}
            priority={priority}
            rank={index + 1}
            share={priority.pointsToGain / heaviest}
            selected={screen.isShown(priority)}
            onSelect={() => {
              play('tock');
              screen.showPriority(priority);
            }}
            onPoint={onPoint}
          />
        ))}
      </ol>
    </section>
  );
}

function Block({
  priority,
  rank,
  share,
  selected,
  onSelect,
  onPoint,
}: {
  priority: Priority;
  rank: number;
  share: number;
  selected: boolean;
  onSelect: () => void;
  onPoint: (priority: Priority | null) => void;
}) {
  const fens = useMemo(() => replayLine(priority.path).fens, [priority.path]);
  const opening = useOpeningName(fens);
  const last = priority.path.length;
  const surface = selected ? wood(WOOD.walnut, rank, true) : wood(C.maple, rank);

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: selected ? -8 : 0, rotate: selected ? (rank % 2 ? -2 : 2) : 0 }}
      whileHover={{ y: selected ? -10 : -4 }}
      whileTap={{ scale: 0.96 }}
      transition={{ ...BOUNCE, opacity: { delay: rank * 0.05 } }}
    >
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => onPoint(priority)}
        onFocus={() => onPoint(priority)}
        className="flex h-full w-full flex-col gap-3 rounded-2xl p-3.5 text-left outline-none transition-shadow duration-200"
        style={{
          ...surface,
          color: selected ? C.cream : C.burnt,
          boxShadow: `${SHADOW.bevel}, ${selected ? SHADOW.lifted : SHADOW.resting}`,
        }}
      >
        <span className="flex items-center justify-between">
          <span className="text-[28px] leading-none font-extrabold" style={{ color: selected ? 'oklch(0.84 0.11 70)' : C.kumquatDeep, textShadow: selected ? undefined : '0 1px 0 oklch(1 0 0 / 0.4)' }}>
            {rank}
          </span>
          <span
            className="h-4 w-4 rounded-full"
            style={{ ...wood(priority.side === 'w' ? C.birch : WOOD.walnutDeep, rank, priority.side === 'b'), boxShadow: `${SHADOW.bevel}, 0 0 0 1px oklch(0.3 0.05 50 / 0.5)` }}
            aria-label={priority.side === 'w' ? 'White' : 'Black'}
          />
        </span>
        <span className="line-clamp-2 min-h-[2.5em] text-[14px] leading-tight font-semibold">{opening?.name ?? 'Unnamed line'}</span>
        <span className="text-[13px]" style={{ opacity: 0.8 }}>
          {figurineMove(priority.path[last - 1], last)}
        </span>
        <span className="mt-auto h-2.5 overflow-hidden rounded-full" style={{ background: 'oklch(0.25 0.04 45 / 0.35)', boxShadow: 'inset 1px 1.5px 2px oklch(0 0 0 / 0.4)' }}>
          <motion.span
            className="block h-full rounded-full"
            style={{ background: `linear-gradient(180deg, oklch(0.80 0.15 62), ${C.kumquat})`, boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.45)' }}
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
const PRESS_MS = 110;

function Tiles({ screen, onPoint }: { screen: OpeningsScreen; onPoint: (line: { side: Side; path: readonly string[] } | null) => void }) {
  const { tree, focusPath } = screen;
  const isPlayerRow = (ply: number) => ply === 0 || isPlayerMove(tree.side, ply);
  const camera = useFlameCamera(tree, focusPath, (ply) => (isPlayerRow(ply) ? ROW.player : ROW.opponent));
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [pressed, setPressed] = useState<string | null>(null);
  const average = playerAverage(tree);

  const toStyle = (placement: Placement) => ({
    left: `${placement.left * 100}%`,
    width: `${placement.width * 100}%`,
    top: placement.top,
  });

  const press = (path: readonly string[], target: readonly string[]) => {
    play('tock');
    setPressed(pathKey(path));
    setTimeout(() => {
      setPressed(null);
      screen.zoomTo(target);
    }, PRESS_MS);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Your tree</h2>
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
          <Crumb onClick={() => screen.zoomTo([])} active={focusPath.length === 0} seed={0}>
            all
          </Crumb>
          <AnimatePresence initial={false}>
            {focusPath.map((san, index) => (
              <motion.span key={`${index}-${san}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={BOUNCE}>
                <Crumb onClick={() => screen.zoomTo(focusPath.slice(0, index + 1))} active={index === focusPath.length - 1} seed={index + 1}>
                  {figurineMove(san, index + 1)}
                </Crumb>
              </motion.span>
            ))}
          </AnimatePresence>
        </nav>
      </div>

      <motion.div ref={containerRef} className="relative w-full overflow-hidden" animate={{ height: camera.height }} transition={ZOOM} onMouseLeave={() => onPoint(null)}>
        <AnimatePresence initial={false} custom={camera.viewport}>
          {camera.bars.map((bar) => {
            const placement = camera.place(bar, camera.viewport);
            const player = isPlayerRow(bar.depth);
            const stain = player ? STAIN[lineTone(bar.node, average)] : OPPONENT_STAIN;
            const label = bar.path.length === 0 ? 'All games' : figurineMove(bar.path[bar.path.length - 1], bar.path.length);
            const isFocus = bar.depth === camera.viewport.depth;
            const fontSize = player ? 13 : 11;
            const height = (player ? ROW.player : ROW.opponent) - GAP;
            const pixels = placement.width * containerWidth;
            const isPressed = pressed === pathKey(bar.path);
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
                  animate={{ y: isPressed ? 1.5 : 0, scale: isPressed ? 0.97 : 1 }}
                  whileHover={{ y: -2 }}
                  transition={BOUNCE}
                  onClick={() => press(bar.path, isFocus ? focusPath.slice(0, -1) : bar.path)}
                  onMouseEnter={() => onPoint({ side: tree.side, path: bar.path })}
                  className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                  style={{
                    ...wood(stain.bg, bar.depth + bar.path.length),
                    color: stain.fg,
                    right: pixels > 12 ? GAP : 1,
                    borderRadius: Math.min(8, pixels / 4),
                    fontSize,
                    lineHeight: `${height}px`,
                  }}
                >
                  {labelFits(label, pixels - GAP, fontSize * 0.85) && <span className="block whitespace-nowrap">{label}</span>}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
        {(['losing', 'slipping', 'even', 'winning'] as const).map((tone, index) => (
          <span key={tone} className="rounded-full px-2.5 py-1" style={{ ...wood(STAIN[tone].bg, index + 7), color: STAIN[tone].fg }}>
            {tone === 'losing' ? 'leaking' : tone === 'slipping' ? 'shaky' : tone === 'even' ? 'par' : 'solid'}
          </span>
        ))}
      </div>
    </section>
  );
}

function Crumb({ onClick, active, seed, children }: { onClick: () => void; active: boolean; seed: number; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={BOUNCE}
      className="rounded-full px-2.5 py-0.5"
      style={active ? { ...wood(WOOD.walnut, seed, true), color: C.cream } : { ...wood(C.maple, seed), ...burnt }}
    >
      {children}
    </motion.button>
  );
}
