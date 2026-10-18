// PROTOTYPE — direction « Clubhouse » : les objets de Club (pendule, feuille de notation, laiton)
// avec la chaleur de Workshop, en vraies matières. Seule la surface varie d'une variante à l'autre.
import { AnimatePresence, motion, MotionConfig, type Transition } from 'framer-motion';
import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Side } from '../domain/playedGame';
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
import { FIBRE, grain, PAPER, SHADOW, WOOD } from './wood';

export type SurfaceKey = 'wood' | 'baize' | 'cream';

interface Surface {
  page: CSSProperties;
  text: string;
  muted: string;
  tray: CSSProperties;
}

const CREAM = 'oklch(0.955 0.028 88)';
const LEAF = 'oklch(0.33 0.06 150)';

const LAMP = 'radial-gradient(ellipse 70% 55% at 32% 8%, oklch(0.95 0.08 80 / 0.16), transparent 70%)';
const VIGNETTE = 'radial-gradient(ellipse at 50% 30%, transparent 55%, oklch(0.1 0.03 40 / 0.45))';

const SURFACES: Record<SurfaceKey, Surface> = {
  wood: {
    page: {
      backgroundColor: 'oklch(0.42 0.07 48)',
      backgroundImage: `${LAMP}, ${VIGNETTE}, repeating-linear-gradient(180deg, transparent 0 279px, oklch(0.18 0.04 40 / 0.22) 279px 280px), ${grain('x', { size: 480, seed: 7, strength: 0.8, scale: 2.6 })}`,
      backgroundAttachment: 'fixed',
    },
    text: CREAM,
    muted: 'oklch(0.84 0.045 72)',
    tray: { backgroundColor: 'oklch(0.33 0.07 158)', backgroundImage: FIBRE, boxShadow: SHADOW.recessed },
  },
  baize: {
    page: {
      backgroundColor: 'oklch(0.34 0.07 158)',
      backgroundImage: `${FIBRE}, ${LAMP}, ${VIGNETTE}, radial-gradient(ellipse at 40% 20%, oklch(0.40 0.075 158), oklch(0.26 0.06 158) 75%)`,
      backgroundAttachment: 'fixed',
    },
    text: CREAM,
    muted: 'oklch(0.85 0.04 150)',
    tray: { backgroundColor: 'oklch(0.26 0.06 158)', backgroundImage: FIBRE, boxShadow: SHADOW.recessed },
  },
  cream: {
    page: { backgroundColor: 'oklch(0.962 0.028 85)' },
    text: LEAF,
    muted: 'oklch(0.50 0.05 150)',
    tray: { backgroundColor: WOOD.walnut, backgroundImage: grain('x', { seed: 5, strength: 0.5, scale: 1.8 }), boxShadow: SHADOW.recessed },
  },
};

const C = {
  brass: 'oklch(0.78 0.11 82)',
  brassDeep: 'oklch(0.56 0.10 70)',
  ink: 'oklch(0.26 0.03 60)',
  inkSoft: 'oklch(0.48 0.03 60)',
  kumquat: 'oklch(0.70 0.17 52)',
  oxblood: 'oklch(0.44 0.14 22)',
  ruling: 'oklch(0.72 0.06 235 / 0.4)',
  margin: 'oklch(0.60 0.15 25 / 0.5)',
};

const STAIN: Record<Tone, { bg: string; fg: string }> = {
  losing: { bg: 'oklch(0.47 0.14 32)', fg: CREAM },
  slipping: { bg: 'oklch(0.69 0.13 66)', fg: 'oklch(0.25 0.05 50)' },
  even: { bg: 'oklch(0.83 0.06 80)', fg: 'oklch(0.30 0.05 50)' },
  winning: { bg: 'oklch(0.57 0.09 135)', fg: CREAM },
};
const OPPONENT_STAIN = { bg: 'oklch(0.70 0.04 72)', fg: 'oklch(0.30 0.04 50)' };
const TILE_GRAIN = grain('x', { seed: 11, strength: 0.35, scale: 0.8 });

const HEAVY: Transition = { type: 'spring', stiffness: 190, damping: 22, mass: 1.3 };
const BOUNCE: Transition = { type: 'spring', stiffness: 420, damping: 19 };
const ZOOM: Transition = { type: 'spring', stiffness: 170, damping: 22, mass: 1 };

const DISPLAY: CSSProperties = { fontFamily: "'Gloock', Georgia, serif" };
const BODY: CSSProperties = { fontFamily: "'Hanken Grotesk', 'Noto Sans Symbols 2', system-ui, sans-serif" };
const DIGITS: CSSProperties = { fontFamily: "'Chivo Mono', monospace" };

const brass: CSSProperties = {
  background: `linear-gradient(160deg, oklch(0.87 0.10 88), ${C.brass} 45%, ${C.brassDeep})`,
  boxShadow: `${SHADOW.resting}, inset 1px 1px 0 oklch(1 0 0 / 0.6), inset -1px -1px 0 oklch(0 0 0 / 0.25)`,
  color: 'oklch(0.30 0.05 70)',
  textShadow: '0 1px 0 oklch(1 0 0 / 0.45)',
};

export function ClubhouseVariant({ screen, surface: surfaceKey }: { screen: OpeningsScreen; surface: SurfaceKey }) {
  const surface = SURFACES[surfaceKey];
  const [source, setSource] = useState<'list' | 'flame'>('list');
  const pointFrom = (from: 'list' | 'flame') => (line: Parameters<OpeningsScreen['point']>[0]) => {
    if (line) setSource(from);
    screen.point(line);
  };
  const shownPath = useReplayedPath(screen.shown.path, screen.pointed && source === 'flame' ? 'jump' : 'replay');

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-32" style={{ ...BODY, ...surface.page, color: surface.text }}>
        <div className="mx-auto flex max-w-[84rem] flex-col gap-10 px-8">
          <header className="flex items-center gap-6 pt-7">
            <Nameplate />
            <SoundSwitch />
            <ChessClock screen={screen} />
          </header>
          <div className="grid grid-cols-[minmax(0,30rem)_1fr] items-start gap-12">
            <BoardStation screen={screen} path={shownPath} surface={surface} />
            <Scoresheet screen={screen} onPoint={pointFrom('list')} />
          </div>
          <TreeTray screen={screen} surface={surface} onPoint={pointFrom('flame')} />
        </div>
      </div>
    </MotionConfig>
  );
}

function Kumquat() {
  return (
    <motion.span className="relative block h-7 w-7" whileHover={{ rotate: -14, scale: 1.1 }} transition={BOUNCE}>
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, oklch(0.86 0.12 72), ${C.kumquat} 55%, oklch(0.58 0.17 45))`, boxShadow: SHADOW.resting }} />
      <span className="absolute -top-1 left-1/2 h-2.5 w-3.5 rotate-[-25deg] rounded-[100%_0]" style={{ background: 'oklch(0.66 0.11 140)' }} />
    </motion.span>
  );
}

function Screw() {
  return <span className="h-2 w-2 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, oklch(0.9 0.05 85), oklch(0.5 0.08 70))', boxShadow: 'inset 0 0 0 0.5px oklch(0.3 0.05 70)' }} />;
}

function Nameplate() {
  return (
    <div className="flex items-center gap-3 rounded-[4px] px-4 py-2" style={brass}>
      <Screw />
      <Kumquat />
      <span className="flex flex-col leading-none">
        <span className="text-[24px] tracking-[0.01em]" style={DISPLAY}>
          Kumquat
        </span>
        <span className="pt-1 text-[10px] font-bold uppercase tracking-[0.3em]">Chess club</span>
      </span>
      <Screw />
    </div>
  );
}

function SoundSwitch() {
  const [enabled, toggle] = useSoundToggle();
  return (
    <motion.button
      type="button"
      onClick={() => {
        toggle();
        if (!enabled) play('plunger');
      }}
      whileTap={{ scale: 0.92 }}
      transition={BOUNCE}
      className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.2em]"
      style={{ ...brass, opacity: enabled ? 1 : 0.6 }}
    >
      Sound {enabled ? 'on' : 'off'}
    </motion.button>
  );
}

function ChessClock({ screen }: { screen: OpeningsScreen }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="flex gap-16 px-6">
        {(['w', 'b'] as const).map((side) => (
          <motion.button
            key={side}
            type="button"
            aria-label={side === 'w' ? 'White' : 'Black'}
            onClick={() => {
              if (screen.side !== side) play('plunger');
              screen.showSide(side);
            }}
            animate={{ y: screen.side === side ? 6 : 0 }}
            whileTap={{ y: 8 }}
            transition={BOUNCE}
            className="h-4 w-10 rounded-t-md"
            style={{ ...brass, boxShadow: 'inset 1px 1px 0 oklch(1 0 0 / 0.6), 1px -1px 2px oklch(0 0 0 / 0.3)' }}
          />
        ))}
      </div>
      <div
        className="relative z-10 flex gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: WOOD.walnutDeep,
          backgroundImage: `linear-gradient(170deg, oklch(1 0 0 / 0.08), transparent 50%), ${grain('x', { seed: 13, strength: 0.6 })}`,
          boxShadow: `${SHADOW.object}, ${SHADOW.bevel}`,
        }}
      >
        {(['w', 'b'] as const).map((side) => (
          <ClockFace key={side} side={side} active={screen.side === side} games={screen.trees[side].root.games} score={scoreRate(screen.trees[side].root)} />
        ))}
      </div>
    </div>
  );
}

function ClockFace({ side, active, games, score }: { side: Side; active: boolean; games: number; score: number }) {
  return (
    <motion.div
      className="flex w-36 flex-col items-center rounded-md px-3 py-2"
      animate={{ backgroundColor: active ? 'oklch(0.87 0.07 105)' : 'oklch(0.40 0.03 105)', color: active ? 'oklch(0.22 0.03 110)' : 'oklch(0.62 0.03 110)' }}
      transition={{ duration: 0.35 }}
      style={{ ...DIGITS, boxShadow: 'inset 2px 3px 5px oklch(0 0 0 / 0.4)' }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={BODY}>
        {side === 'w' ? 'White' : 'Black'}
      </span>
      <span className="text-[26px] leading-tight font-semibold tabular-nums">{games.toLocaleString('en')}</span>
      <span className="text-[12px] tabular-nums">{Math.round(score * 100)}% score</span>
    </motion.div>
  );
}

function BoardStation({ screen, path, surface }: { screen: OpeningsScreen; path: readonly string[]; surface: Surface }) {
  const side = screen.shown.side;
  const node = nodeAt(screen.trees[side], path);
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);

  return (
    <div className="sticky top-6 flex flex-col gap-5">
      <WoodBoard path={path} flipped={side === 'b'} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={opening?.name ?? 'none'}
              className="truncate text-[24px] leading-tight"
              style={DISPLAY}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}
            </motion.span>
          </AnimatePresence>
          <span className="truncate text-[15px]" style={{ color: surface.muted }}>
            {figurineLine(path) || '—'}
          </span>
        </div>
        {node && (
          <div className="flex shrink-0 gap-2">
            <Plaque label="games">
              <AnimatedNumber value={node.games} duration={0.5} />
            </Plaque>
            <Plaque label="score">
              <AnimatedNumber value={scoreRate(node) * 100} format={(v) => `${Math.round(v)}%`} duration={0.5} />
            </Plaque>
          </div>
        )}
      </div>
    </div>
  );
}

function Plaque({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center rounded-[3px] px-3 py-1" style={brass}>
      <span className="text-[18px] leading-tight font-semibold" style={DIGITS}>
        {children}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span>
    </span>
  );
}

const LINE = 30;

function Scoresheet({ screen, onPoint }: { screen: OpeningsScreen; onPoint: (priority: Priority | null) => void }) {
  const heaviest = Math.max(...screen.priorities.map((priority) => priority.pointsToGain));
  return (
    <motion.section
      className="relative px-10 pt-6 pb-8"
      initial={{ rotate: 0, y: 24, opacity: 0 }}
      animate={{ rotate: -0.8, y: 0, opacity: 1 }}
      transition={HEAVY}
      style={{
        backgroundColor: CREAM,
        color: C.ink,
        boxShadow: SHADOW.object,
        backgroundImage: `${PAPER}, linear-gradient(90deg, transparent 3.25rem, ${C.margin} 3.25rem, ${C.margin} calc(3.25rem + 1px), transparent calc(3.25rem + 1px)), repeating-linear-gradient(transparent 0 ${LINE * 2 - 1}px, ${C.ruling} ${LINE * 2 - 1}px ${LINE * 2}px)`,
        backgroundPosition: `0 0, 0 0, 0 ${78}px`,
      }}
    >
      <div className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-1" style={{ background: 'oklch(0.93 0.03 90 / 0.7)', boxShadow: SHADOW.resting }} />
      <header className="flex items-baseline justify-between pb-3 pl-6">
        <h2 className="text-[30px] leading-none" style={DISPLAY}>
          Scoresheet
        </h2>
        <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: C.inkSoft }}>
          Leaks to fix
        </span>
      </header>
      <ol onMouseLeave={() => onPoint(null)}>
        {screen.priorities.map((priority, index) => (
          <SheetRow
            key={`${priority.side}:${pathKey(priority.path)}`}
            priority={priority}
            rank={index + 1}
            share={priority.pointsToGain / heaviest}
            selected={screen.isShown(priority)}
            onSelect={() => {
              play('paper');
              screen.showPriority(priority);
            }}
            onPoint={onPoint}
          />
        ))}
      </ol>
    </motion.section>
  );
}

function SheetRow({
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
  return (
    <li className="relative">
      {selected && (
        <motion.span
          layoutId="clubhouse-marker"
          transition={BOUNCE}
          className="absolute top-3 -left-12 h-9 w-5"
          style={{ ...brass, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)' }}
        />
      )}
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => onPoint(priority)}
        onFocus={() => onPoint(priority)}
        className="grid w-full grid-cols-[2rem_1fr_7rem] items-center gap-4 pl-1 text-left outline-none transition-colors duration-200 hover:bg-[oklch(0.90_0.04_85/0.6)]"
        style={{ height: LINE * 2 }}
      >
        <span className="text-[22px]" style={{ ...DISPLAY, color: selected ? C.kumquat : C.inkSoft }}>
          {rank}.
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-semibold">{opening?.name ?? 'Unnamed line'}</span>
          <span className="truncate text-[14px]" style={{ color: C.inkSoft }}>
            {priority.side === 'w' ? '○' : '●'} {figurineLine(priority.path)}
          </span>
        </span>
        <Tally count={Math.max(1, Math.round(share * 10))} />
      </button>
    </li>
  );
}

function Tally({ count }: { count: number }) {
  const groups = Array.from({ length: Math.ceil(count / 5) }, (_, group) => Math.min(5, count - group * 5));
  return (
    <span className="flex items-center justify-end gap-2" aria-label="Impact">
      {groups.map((size, group) => (
        <svg key={group} width="26" height="22" viewBox="0 0 26 22" style={{ overflow: 'visible' }}>
          {Array.from({ length: Math.min(size, 4) }, (_, index) => (
            <motion.line
              key={index}
              x1={3 + index * 6}
              y1={2}
              x2={2 + index * 6}
              y2={20}
              stroke={C.ink}
              strokeWidth={1.6}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.18, delay: 0.3 + (group * 5 + index) * 0.07 }}
            />
          ))}
          {size === 5 && (
            <motion.line
              x1={-1}
              y1={16}
              x2={24}
              y2={5}
              stroke={C.oxblood}
              strokeWidth={1.8}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, delay: 0.3 + (group * 5 + 4) * 0.07 }}
            />
          )}
        </svg>
      ))}
    </span>
  );
}

const ROW = { player: 32, opponent: 20 };
const GAP = 3;
const PRESS_MS = 110;

function TreeTray({ screen, surface, onPoint }: { screen: OpeningsScreen; surface: Surface; onPoint: (line: { side: Side; path: readonly string[] } | null) => void }) {
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
      <div className="flex items-baseline gap-5">
        <h2 className="text-[30px] leading-none" style={DISPLAY}>
          The tree
        </h2>
        <nav className="flex flex-wrap items-center gap-1 text-[15px]" style={{ color: surface.muted }}>
          <button type="button" onClick={() => screen.zoomTo([])} className="hover:underline">
            All games
          </button>
          {focusPath.map((san, index) => (
            <Fragment key={index}>
              <span style={{ color: C.brass }}>·</span>
              <button type="button" onClick={() => screen.zoomTo(focusPath.slice(0, index + 1))} className="hover:underline">
                {figurineMove(san, index + 1)}
              </button>
            </Fragment>
          ))}
        </nav>
        <span className="ml-auto flex gap-4 text-[12px]" style={{ color: surface.muted }}>
          {(['losing', 'slipping', 'even', 'winning'] as const).map((tone) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-5 rounded-[2px]" style={{ backgroundColor: STAIN[tone].bg, backgroundImage: TILE_GRAIN, boxShadow: SHADOW.bevel }} />
              {tone === 'losing' ? 'Losing' : tone === 'slipping' ? 'Slipping' : tone === 'even' ? 'Par' : 'Winning'}
            </span>
          ))}
        </span>
      </div>

      <div className="rounded-lg p-3" style={surface.tray}>
        <motion.div ref={containerRef} className="relative w-full overflow-hidden" animate={{ height: camera.height }} transition={ZOOM} onMouseLeave={() => onPoint(null)}>
          <AnimatePresence initial={false} custom={camera.viewport}>
            {camera.bars.map((bar) => {
              const placement = camera.place(bar, camera.viewport);
              const player = isPlayerRow(bar.depth);
              const stain = player ? STAIN[lineTone(bar.node, average)] : OPPONENT_STAIN;
              const label = bar.path.length === 0 ? 'All games' : figurineMove(bar.path[bar.path.length - 1], bar.path.length);
              const isFocus = bar.depth === camera.viewport.depth;
              const height = (player ? ROW.player : ROW.opponent) - GAP;
              const fontSize = player ? 13 : 11;
              const pixels = placement.width * containerWidth;
              const wide = pixels > 14;
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
                    animate={{ y: isPressed ? 1.5 : 0, boxShadow: isPressed ? '0px 0px 0px oklch(0 0 0 / 0)' : SHADOW.resting }}
                    whileHover={{ y: -2, boxShadow: SHADOW.lifted }}
                    transition={BOUNCE}
                    onClick={() => press(bar.path, isFocus ? focusPath.slice(0, -1) : bar.path)}
                    onMouseEnter={() => onPoint({ side: tree.side, path: bar.path })}
                    className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none focus-visible:ring-2"
                    style={{
                      backgroundColor: stain.bg,
                      backgroundImage: TILE_GRAIN,
                      backgroundPosition: `${(bar.depth * 41) % 160}px ${(bar.path.length * 23) % 160}px`,
                      color: stain.fg,
                      right: wide ? GAP : 1,
                      borderRadius: wide ? 3 : 1,
                      fontSize,
                      lineHeight: `${height}px`,
                    }}
                  >
                    <span className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: SHADOW.bevel }} />
                    {labelFits(label, pixels - GAP, fontSize * 0.85) && <span className="relative block whitespace-nowrap">{label}</span>}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
