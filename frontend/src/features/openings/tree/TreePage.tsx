import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BuildSession } from '../checks/BuildSession';
import type { AddedMove } from '../domain/addition';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { figurineLine } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, type Priority } from '../domain/priorities';
import { ReplayBar } from '../replay/ReplayBar';
import type { SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { SideSwitch } from '../workshop/SideSwitch';
import { COLOURS, FONT_FAMILY, raised, SPRING } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PositionPane } from './PositionPane';
import { RepertoireMap } from './RepertoireMap';
import { buildRepertoireMap, forEachNode, markedNodes, type MapNode } from './repertoireMap';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;

interface Session {
  /** Les étapes connues à l'ouverture : un ajout peut en régler d'autres en route. */
  queue: readonly string[];
  done: ReadonlySet<string>;
}

/** POC (README, « the tree as the landing screen ») : le répertoire comme carte, à côté de l'aiguillage pour comparer. */
export function TreePage() {
  useWorkshopFont();
  const { replay, known, repertoires, steps, add, ignore, forgetIgnored, forgetAdditions } = useReplayedSession();
  const [side, setSide] = useState<Side>('w');
  const [paths, setPaths] = useState<Record<Side, readonly string[]>>({ w: [], b: [] });
  const [focus, setFocus] = useState<{ key: string; stamp: number; centre: boolean } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [building, setBuilding] = useState<{ step: SessionStep; keep: boolean } | null>(null);

  const { maps, recent, priorities } = useMaps(known, replay.day, repertoires, steps);
  const root = maps[side];
  const path = paths[side];
  const node = useMemo(() => nodeAlong(root, path), [root, path]);
  const marked = useMemo(() => markedNodes(root), [root]);
  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  const priority = node.priority !== undefined ? priorities[node.priority - 1] : undefined;

  const goTo = (target: Side, key: string, centre: boolean) => {
    const found = findNode(maps[target], key);
    if (!found) return;
    setSide(target);
    setPaths((current) => ({ ...current, [target]: found.path }));
    setFocus({ key, stamp: Date.now(), centre });
  };
  const play = (san: string) => {
    const next = [...path, san];
    setPaths((current) => ({ ...current, [side]: next }));
    const reached = nodeAlong(root, next);
    if (reached.path.length === next.length) setFocus({ key: reached.key, stamp: Date.now(), centre: false });
  };
  const back = () => setPaths((current) => ({ ...current, [side]: current[side].slice(0, -1) }));

  // La séance : les positions à trancher, la plus fréquente d'abord, une par une.
  const live = useMemo(() => new Map(steps.map((step) => [step.key, step])), [steps]);
  const currentKey = session?.queue.find((key) => !session.done.has(key) && live.has(key));
  const current = currentKey ? live.get(currentKey) : undefined;
  useEffect(() => {
    if (!current) return;
    const target = findByPosition(maps[current.side], current.games[0].check.position);
    if (target) goTo(current.side, target.key, true);
    // goTo change à chaque rendu ; seule l'étape courante doit relancer le recentrage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);
  const finish = (key: string) => {
    setSession((active) => active && { ...active, done: new Set(active.done).add(key) });
    setBuilding(null);
  };
  const startSession = () => {
    setSession({ queue: steps.map((step) => step.key), done: new Set() });
    setBuilding(null);
  };
  const accept = (moves: AddedMove[]) => {
    if (!building) return;
    add({ side: building.step.side, addedAt: replay.day, moves });
    finish(building.step.key);
  };
  const actions = {
    onKeep: (step: SessionStep) => setBuilding({ step, keep: true }),
    onPrepare: (step: SessionStep) => setBuilding({ step, keep: false }),
    onStay: (step: SessionStep) => {
      step.games.forEach((checked) => ignore(checked.id));
      finish(step.key);
    },
  };

  const pins = useMemo(() => [...markedNodes(maps.w).priorities.map((n) => ({ side: 'w' as Side, node: n })), ...markedNodes(maps.b).priorities.map((n) => ({ side: 'b' as Side, node: n }))].sort((a, b) => a.node.priority! - b.node.priority!), [maps]);
  const goToPriority = (rank: number) => {
    const pin = pins.find((candidate) => candidate.node.priority === rank) ?? pins[0];
    if (pin) goTo(pin.side, pin.node.key, true);
  };
  const positions = marked.toSettle.length;
  const settled = session ? session.queue.filter((key) => session.done.has(key) || !live.has(key)).length : 0;

  useEffect(() => {
    if (building) return;
    const press = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === 'ArrowLeft' && path.length) back();
      else if (event.key === 'ArrowRight' && path.length === node.path.length && node.children.length) {
        play([...node.children].sort((a, b) => b.games - a.games)[0].san!);
      } else if (event.key === 'ArrowUp') setPaths((current) => ({ ...current, [side]: [] }));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  });

  const reset = replay.reset && (() => {
    replay.reset!();
    forgetIgnored();
    forgetAdditions();
    setSession(null);
  });
  const habits = useMemo(() => known.filter((game) => game.side === building?.step.side), [known, building?.step.side]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-10" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <span className="sm:ml-auto">
            <ReplayBar replay={{ ...replay, reset }} />
          </span>
        </PageHeader>
        {building ? (
          <BuildSession
            key={`${building.step.key} ${building.keep}`}
            checked={building.step.games[0]}
            games={habits}
            repertoire={repertoires[building.step.side]}
            keep={building.keep}
            onAccept={accept}
            onCancel={() => setBuilding(null)}
          />
        ) : (
          <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-4 pt-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <SideSwitch side={side} onChange={(next) => setSide(next)} />
              <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
                {positions} {positions === 1 ? 'position' : 'positions'} to settle as {side === 'w' ? 'White' : 'Black'}
              </span>
              <span className="flex flex-wrap gap-2 sm:ml-auto">
                <Door onClick={steps.length && !session ? startSession : undefined} title={session ? `Session · ${Math.min(settled + 1, session.queue.length)} / ${session.queue.length}` : `${steps.length} to settle`}>
                  {session ? (current ? `${current.games.length} games at ${figurineLine(current.path) || 'the start'}` : 'done for today') : steps.length ? `${steps[0].games.length} games at ${figurineLine(steps[0].path) || 'the start'}` : 'nothing to settle'}
                </Door>
                <Door onClick={pins.length ? () => goToPriority(1) : undefined} title="Priority 1">
                  {priorities[0] ? <PriorityLabel priority={priorities[0]} /> : 'no priority'}
                </Door>
              </span>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="h-[60vh] min-h-[380px] lg:h-[calc(100vh-13rem)]">
                <RepertoireMap root={root} side={side} selected={node.key} onSelect={(key) => goTo(side, key, false)} focus={focus} />
              </div>
              {session && !current ? (
                <Done settled={settled} onClose={() => setSession(null)} />
              ) : (
                <PositionPane
                  path={path}
                  node={node}
                  flipped={side === 'b'}
                  recent={recent[side]}
                  steps={stepsHere}
                  priority={priority}
                  actions={actions}
                  session={session && current ? { index: settled + 1, total: session.queue.length, onSkip: () => finish(current.key) } : undefined}
                  onNextPriority={pins.length > 1 && node.priority !== undefined ? () => goToPriority(node.priority! + 1) : undefined}
                  onMove={play}
                  onBack={path.length ? back : undefined}
                />
              )}
            </div>
          </main>
        )}
      </div>
    </MotionConfig>
  );
}

function PriorityLabel({ priority }: { priority: Priority }) {
  return <>{`${priority.side === 'w' ? 'White' : 'Black'} · ${figurineLine(priority.path)}`}</>;
}

function Done({ settled, onClose }: { settled: number; onClose: () => void }) {
  return (
    <aside aria-label="Done" className="flex flex-col items-start gap-3 self-start rounded-3xl p-5" style={raised(false)}>
      <span className="text-[24px] font-extrabold tracking-[-0.02em]">Done for today</span>
      <span style={{ color: COLOURS.leafSoft }}>
        {settled} {settled === 1 ? 'position' : 'positions'} gone through.
      </span>
      <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.97 }} transition={SPRING} className="rounded-full px-4 py-2 font-bold" style={raised(true)}>
        Back to the tree
      </motion.button>
    </aside>
  );
}

function Door({ onClick, title, children }: { onClick?: () => void; title: string; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={SPRING}
      className="flex flex-col items-start rounded-2xl px-4 py-2 text-left"
      style={{ ...raised(false), opacity: onClick ? 1 : 0.6 }}
    >
      <span className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</span>
      <span className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
        {children}
      </span>
    </motion.button>
  );
}

function useMaps(known: readonly PlayedGame[], day: string, repertoires: ReturnType<typeof useReplayedSession>['repertoires'], steps: readonly SessionStep[]) {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]): Record<Side, OpeningTree> => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    const recent = trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day)));
    const priorities = findPriorities(trees(known), recent, MAX_PRIORITIES);
    const toSettle: Record<Side, Map<string, number>> = { w: new Map(), b: new Map() };
    for (const step of steps) {
      const position = step.games[0].check.position;
      toSettle[step.side].set(position, (toSettle[step.side].get(position) ?? 0) + step.games.length);
    }
    const maps: Record<Side, MapNode> = {
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities }),
    };
    return { maps, recent, priorities };
  }, [known, day, repertoires, steps]);
}

/** Le nœud le plus profond de la carte sur la ligne, en passant par le propriétaire d'une transposition. */
function nodeAlong(root: MapNode, path: readonly string[]): MapNode {
  const byKey = new Map<string, MapNode>();
  forEachNode(root, (node) => byKey.set(node.key, node));
  let node = root;
  for (const san of path) {
    const child = node.children.find((candidate) => candidate.san === san);
    if (!child) break;
    node = child.stub ? byKey.get(child.owner!)! : child;
  }
  return node;
}

function findNode(root: MapNode, key: string): MapNode | undefined {
  let found: MapNode | undefined;
  forEachNode(root, (node) => {
    if (node.key === key && !node.stub) found = node;
  });
  return found;
}

function findByPosition(root: MapNode, position: string): MapNode | undefined {
  let found: MapNode | undefined;
  forEachNode(root, (node) => {
    if (!found && node.position === position && !node.stub) found = node;
  });
  return found;
}
