// PROTOTYPE — direction F « Club » : le club d'échecs le soir. Tapis vert, laiton, feuille de
// notation, échiquier de tournoi vert et crème. La pendule sert de bascule Blancs / Noirs.
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { isPlayerMove, nodeAt } from '../domain/openingTree';
import { formatLine, formatMove } from '../domain/notation';
import { playerAverage, scoreRate } from '../domain/performance';
import type { Side } from '../domain/playedGame';
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
  baize: 'oklch(0.34 0.07 158)',
  baizeDeep: 'oklch(0.26 0.06 158)',
  brass: 'oklch(0.78 0.11 82)',
  brassDeep: 'oklch(0.56 0.10 70)',
  cream: 'oklch(0.955 0.028 88)',
  ink: 'oklch(0.26 0.03 60)',
  inkSoft: 'oklch(0.48 0.03 60)',
  ruling: 'oklch(0.72 0.06 235 / 0.45)',
  margin: 'oklch(0.60 0.15 25 / 0.55)',
  oxblood: 'oklch(0.44 0.14 22)',
  mahogany: 'oklch(0.34 0.08 38)',
};

const FELT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0.05 0 0 0 0 0 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`;

const TONE: Record<Tone, { bg: string; fg: string }> = {
  losing: { bg: C.oxblood, fg: C.cream },
  slipping: { bg: C.brassDeep, fg: C.cream },
  even: { bg: 'oklch(0.41 0.065 158)', fg: 'oklch(0.9 0.03 150)' },
  winning: { bg: 'oklch(0.62 0.09 150)', fg: 'oklch(0.2 0.04 158)' },
};

const HEAVY: Transition = { type: 'spring', stiffness: 190, damping: 22, mass: 1.3 };
const ZOOM: Transition = { type: 'spring', stiffness: 150, damping: 23, mass: 1.1 };
const PIECE: Transition = { type: 'spring', stiffness: 210, damping: 25, mass: 1.2 };

const DISPLAY: CSSProperties = { fontFamily: "'Gloock', Georgia, serif" };
const BODY: CSSProperties = { fontFamily: "'Hanken Grotesk', system-ui, sans-serif" };
const DIGITS: CSSProperties = { fontFamily: "'Chivo Mono', monospace" };

const brassPlate: CSSProperties = {
  background: `linear-gradient(160deg, oklch(0.86 0.10 88), ${C.brass} 45%, ${C.brassDeep})`,
  boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.6), inset 0 -1px 0 oklch(0 0 0 / 0.25), 0 3px 8px oklch(0 0 0 / 0.35)',
  color: 'oklch(0.28 0.05 70)',
};

export function ClubVariant({ screen }: { screen: OpeningsScreen }) {
  return (
    <div
      className="min-h-screen pb-32"
      style={{
        ...BODY,
        color: C.cream,
        backgroundColor: C.baize,
        backgroundImage: `${FELT}, radial-gradient(ellipse at 40% 20%, oklch(0.40 0.075 158), ${C.baizeDeep} 75%)`,
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="mx-auto flex max-w-[84rem] flex-col gap-10 px-8">
        <header className="flex items-center justify-between pt-7">
          <Nameplate />
          <ChessClock screen={screen} />
        </header>
        <div className="grid grid-cols-[minmax(0,29rem)_1fr] items-start gap-12">
          <TournamentBoard screen={screen} />
          <Scoresheet screen={screen} />
        </div>
        <TreeTray screen={screen} />
      </div>
    </div>
  );
}

function Screw() {
  return <span className="h-2 w-2 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, oklch(0.9 0.05 85), oklch(0.5 0.08 70))', boxShadow: 'inset 0 0 0 0.5px oklch(0.3 0.05 70)' }} />;
}

function Nameplate() {
  return (
    <div className="flex items-center gap-3 rounded-[4px] px-4 py-2" style={brassPlate}>
      <Screw />
      <span className="flex flex-col leading-none">
        <span className="text-[24px] tracking-[0.02em]" style={DISPLAY}>
          Kumquat
        </span>
        <span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.3em]">Chess club · est. 2026</span>
      </span>
      <Screw />
    </div>
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
            onClick={() => screen.showSide(side)}
            animate={{ y: screen.side === side ? 6 : 0 }}
            whileTap={{ y: 8 }}
            transition={HEAVY}
            className="h-4 w-10 rounded-t-md"
            style={{ ...brassPlate, boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.6), 0 -1px 2px oklch(0 0 0 / 0.3)' }}
          />
        ))}
      </div>
      <div
        className="relative z-10 flex gap-3 rounded-xl px-4 pt-3 pb-3"
        style={{
          background: `linear-gradient(170deg, oklch(0.44 0.09 42), ${C.mahogany} 60%, oklch(0.26 0.06 38))`,
          boxShadow: '0 10px 24px -6px oklch(0 0 0 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.18)',
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
      animate={{
        backgroundColor: active ? 'oklch(0.86 0.07 110)' : 'oklch(0.42 0.03 110)',
        color: active ? 'oklch(0.22 0.03 110)' : 'oklch(0.62 0.03 110)',
      }}
      transition={{ duration: 0.35 }}
      style={{ ...DIGITS, boxShadow: 'inset 0 2px 4px oklch(0 0 0 / 0.35)' }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={BODY}>
        {side === 'w' ? 'White' : 'Black'}
      </span>
      <span className="text-[26px] leading-tight font-semibold tabular-nums">{games.toLocaleString('en')}</span>
      <span className="text-[12px] tabular-nums">{Math.round(score * 100)}% score</span>
    </motion.div>
  );
}

function TournamentBoard({ screen }: { screen: OpeningsScreen }) {
  const { shown } = screen;
  const tree = screen.trees[shown.side];
  const node = nodeAt(tree, shown.path);
  const fens = useMemo(() => replayLine(shown.path).fens, [shown.path]);
  const opening = useOpeningName(fens);

  return (
    <div className="sticky top-6 flex flex-col gap-5">
      <div className="p-3" style={{ background: C.cream, boxShadow: '0 22px 40px -14px oklch(0 0 0 / 0.6), 0 2px 4px oklch(0 0 0 / 0.25)', borderRadius: 3 }}>
        <MotionBoard
          path={shown.path}
          flipped={shown.side === 'b'}
          transition={PIECE}
          pieceStyle={{ filter: 'drop-shadow(0 3px 2px oklch(0 0 0 / 0.35))' }}
          squareStyle={(light, mark) => ({
            background: mark ? (light ? 'oklch(0.88 0.10 90)' : 'oklch(0.66 0.11 95)') : light ? 'oklch(0.95 0.025 95)' : 'oklch(0.56 0.095 150)',
          })}
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[24px] leading-tight" style={DISPLAY}>
            {opening?.name ?? (shown.path.length ? 'Unnamed line' : 'Starting position')}
          </span>
          <span className="truncate text-[14px]" style={{ color: 'oklch(0.85 0.04 150)' }}>
            {formatLine(shown.path) || '—'}
          </span>
        </div>
        {node && (
          <div className="flex shrink-0 gap-2">
            <Plaque label="games">
              <AnimatedNumber value={node.games} duration={0.6} />
            </Plaque>
            <Plaque label="score">
              <AnimatedNumber value={scoreRate(node) * 100} format={(v) => `${Math.round(v)}%`} duration={0.6} />
            </Plaque>
          </div>
        )}
      </div>
    </div>
  );
}

function Plaque({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center rounded-[3px] px-3 py-1" style={brassPlate}>
      <span className="text-[18px] leading-tight font-semibold" style={DIGITS}>
        {children}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span>
    </span>
  );
}

const LINE = 30;

function Scoresheet({ screen }: { screen: OpeningsScreen }) {
  const heaviest = Math.max(...screen.priorities.map((priority) => priority.pointsToGain));
  return (
    <motion.section
      className="relative px-10 pt-6 pb-8"
      initial={{ rotate: 0, y: 20, opacity: 0 }}
      animate={{ rotate: -0.8, y: 0, opacity: 1 }}
      transition={HEAVY}
      style={{
        background: C.cream,
        color: C.ink,
        boxShadow: '0 24px 40px -18px oklch(0 0 0 / 0.65), 0 1px 3px oklch(0 0 0 / 0.3)',
        backgroundImage: `linear-gradient(90deg, transparent 3.25rem, ${C.margin} 3.25rem, ${C.margin} calc(3.25rem + 1px), transparent calc(3.25rem + 1px)), repeating-linear-gradient(transparent 0 ${LINE * 2 - 1}px, ${C.ruling} ${LINE * 2 - 1}px ${LINE * 2}px)`,
        backgroundPosition: `0 0, 0 ${6 * 4 + 54}px`,
      }}
    >
      <div className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-1" style={{ background: 'oklch(0.92 0.03 90 / 0.75)', boxShadow: '0 1px 2px oklch(0 0 0 / 0.2)' }} />
      <header className="flex items-baseline justify-between pb-3 pl-6">
        <h2 className="text-[30px] leading-none" style={DISPLAY}>
          Scoresheet
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: C.inkSoft }}>
          Leaks to fix
        </span>
      </header>
      <ol onMouseLeave={() => screen.point(null)}>
        {screen.priorities.map((priority, index) => (
          <SheetRow
            key={`${priority.side}:${pathKey(priority.path)}`}
            priority={priority}
            rank={index + 1}
            share={priority.pointsToGain / heaviest}
            selected={screen.isShown(priority)}
            screen={screen}
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
  return (
    <li className="relative">
      {selected && (
        <motion.span
          layoutId="club-marker"
          transition={HEAVY}
          className="absolute top-3 -left-12 h-9 w-5 rounded-r-sm"
          style={{ ...brassPlate, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)' }}
        />
      )}
      <button
        type="button"
        onClick={() => screen.showPriority(priority)}
        onMouseEnter={() => screen.point(priority)}
        onFocus={() => screen.point(priority)}
        className="grid w-full grid-cols-[2rem_1fr_7rem] items-center gap-4 pl-1 text-left outline-none transition-colors duration-200 hover:bg-[oklch(0.90_0.04_88)]"
        style={{ height: LINE * 2 }}
      >
        <span className="text-[22px]" style={{ ...DISPLAY, color: selected ? C.oxblood : C.inkSoft }}>
          {rank}.
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-semibold">{opening?.name ?? 'Unnamed line'}</span>
          <span className="truncate text-[13px]" style={{ color: C.inkSoft }}>
            {priority.side === 'w' ? '♔' : '♚'} {formatLine(priority.path)}
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

function TreeTray({ screen }: { screen: OpeningsScreen }) {
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
      <div className="flex items-baseline gap-5">
        <h2 className="text-[30px] leading-none" style={DISPLAY}>
          The tree
        </h2>
        <nav className="flex flex-wrap items-center gap-1 text-[14px]" style={{ color: 'oklch(0.85 0.04 150)' }}>
          <button type="button" onClick={() => screen.zoomTo([])} className="hover:text-white">
            All games
          </button>
          {focusPath.map((san, index) => (
            <Fragment key={index}>
              <span style={{ color: C.brass }}>·</span>
              <button type="button" onClick={() => screen.zoomTo(focusPath.slice(0, index + 1))} className="hover:text-white">
                {formatMove(san, index + 1)}
              </button>
            </Fragment>
          ))}
        </nav>
        <span className="ml-auto flex gap-4 text-[12px]" style={{ color: 'oklch(0.85 0.04 150)' }}>
          {(['losing', 'slipping', 'even', 'winning'] as const).map((tone) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-5 rounded-[2px]" style={{ background: TONE[tone].bg, outline: '1px dashed oklch(1 0 0 / 0.3)', outlineOffset: -3 }} />
              {tone === 'losing' ? 'Losing' : tone === 'slipping' ? 'Slipping' : tone === 'even' ? 'Par' : 'Winning'}
            </span>
          ))}
        </span>
      </div>

      <div className="rounded-lg p-3" style={{ background: C.baizeDeep, boxShadow: 'inset 0 4px 12px oklch(0 0 0 / 0.5), inset 0 -1px 0 oklch(1 0 0 / 0.08)' }}>
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
              const tone = player ? TONE[lineTone(bar.node, average)] : { bg: 'oklch(0.31 0.06 158)', fg: 'oklch(0.75 0.04 150)' };
              const label = bar.path.length === 0 ? 'All games' : formatMove(bar.path[bar.path.length - 1], bar.path.length);
              const isFocus = bar.depth === camera.viewport.depth;
              const height = (player ? ROW.player : ROW.opponent) - GAP;
              const fontSize = player ? 13 : 11;
              const wide = placement.width * containerWidth > 14;
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
                    whileHover={{ y: -2, boxShadow: '0 6px 10px -4px oklch(0 0 0 / 0.6)' }}
                    whileTap={{ y: 1, boxShadow: '0 0px 0px oklch(0 0 0 / 0)' }}
                    transition={HEAVY}
                    onClick={() => screen.zoomTo(isFocus ? focusPath.slice(0, -1) : bar.path)}
                    onMouseEnter={() => screen.point({ side: tree.side, path: bar.path })}
                    className="absolute inset-y-0 left-0 overflow-hidden px-2 text-left font-semibold outline-none"
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      right: wide ? GAP : 1,
                      borderRadius: wide ? 3 : 1,
                      fontSize,
                      lineHeight: `${height}px`,
                      boxShadow: '0 2px 3px -1px oklch(0 0 0 / 0.45)',
                      outline: wide ? '1px dashed oklch(1 0 0 / 0.22)' : undefined,
                      outlineOffset: -4,
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
      </div>
    </section>
  );
}
