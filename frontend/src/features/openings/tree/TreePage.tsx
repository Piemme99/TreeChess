import { MotionConfig, motion } from 'framer-motion';
import { useSearchParams } from 'react-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BuildSession } from '../checks/BuildSession';
import { originAt, originOf, type BuildOrigin } from '../checks/useBuilder';
import type { AddedMove, Addition } from '../domain/addition';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { figurineLine, figurineMove } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, type Priority } from '../domain/priorities';
import { ReplayBar } from '../replay/ReplayBar';
import { REPLAY_START } from '../replay/replaySetup';
import type { SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { SideSwitch } from '../workshop/SideSwitch';
import { COLOURS, FONT_FAMILY, raised, SPRING } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWide } from '../workshop/useWide';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PositionPane, type StepActions } from './PositionPane';
import { RepertoireMap } from './RepertoireMap';
import { TreeList } from './TreeList';
import { buildRepertoireMap, forEachNode, markedNodes, type MapNode } from './repertoireMap';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;

interface Session {
  /** Les étapes connues à l'ouverture : un ajout peut en régler d'autres en route. */
  queue: readonly string[];
  /** Par étape traitée : réglée, ou remise à plus tard. */
  done: ReadonlyMap<string, 'settled' | 'skipped'>;
  /** Arrêtée avant la fin : on montre quand même le bilan. */
  ended?: boolean;
}

type View = 'map' | 'position';

/** POC (README, « the tree as the landing screen ») : le répertoire comme carte, à côté de l'aiguillage pour comparer. */
export function TreePage() {
  useWorkshopFont();
  const { replay, known, repertoires, steps, add, remove, ignore, unignore, forgetIgnored, forgetAdditions } = useReplayedSession();
  // Openings envoie une ligne à travailler par l'adresse : /dev/tree?side=b&line=d4 Nf6.
  const [params] = useSearchParams();
  const asked = useMemo(() => ({ side: params.get('side') === 'b' ? 'b' : 'w', line: params.get('line')?.split(' ').filter(Boolean) ?? [] }) as { side: Side; line: string[] }, [params]);
  const [side, setSide] = useState<Side>(asked.side);
  const [paths, setPaths] = useState<Record<Side, readonly string[]>>(() => ({ w: [], b: [], [asked.side]: asked.line }));
  const [focus, setFocus] = useState<{ key: string; stamp: number; centre: boolean } | null>(() =>
    asked.line.length ? { key: asked.line.join(' '), stamp: Date.now(), centre: true } : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [building, setBuilding] = useState<{ origin: BuildOrigin; stepKey?: string } | null>(null);
  // Sur le téléphone, la carte et le volet ne tiennent pas ensemble : un onglet à la fois.
  const [view, setView] = useState<View>(asked.line.length ? 'position' : 'map');
  const [preview, setPreview] = useState<readonly (readonly string[])[]>([]);
  const showLines = useCallback((lines: (readonly string[])[]) => {
    setPreview(lines);
    const last = lines.at(-1);
    if (last) setFocus({ key: last.join(' '), stamp: Date.now(), centre: true });
  }, []);
  const build = (next: { origin: BuildOrigin; stepKey?: string } | null) => {
    setBuilding(next);
    setPreview([]);
    if (next) {
      setFocus({ key: next.origin.start.join(' '), stamp: Date.now(), centre: true });
      setView('position');
    }
  };
  const { toast, show, close } = useToast();
  const wide = useWide();

  const { maps, recent, priorities } = useMaps(known, replay.day, repertoires, steps);
  const root = maps[side];
  const path = paths[side];
  const node = useMemo(() => nodeAlong(root, path), [root, path]);
  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  const priority = node.priority !== undefined ? priorities[node.priority - 1] : undefined;

  const goTo = (target: Side, key: string, centre: boolean) => {
    const found = findNode(maps[target], key);
    if (!found) return;
    setSide(target);
    setPaths((current) => ({ ...current, [target]: found.path }));
    setFocus({ key, stamp: Date.now(), centre });
  };
  const walk = (next: readonly string[]) => {
    setPaths((current) => ({ ...current, [side]: next }));
    const reached = nodeAlong(root, next);
    if (reached.path.length === next.length) setFocus({ key: reached.key, stamp: Date.now(), centre: false });
  };
  const play = (san: string) => walk([...path, san]);
  const back = () => walk(path.slice(0, -1));

  // La séance : les positions à trancher, la plus fréquente d'abord, une par une.
  const live = useMemo(() => new Map(steps.map((step) => [step.key, step])), [steps]);
  const currentKey = session?.ended ? undefined : session?.queue.find((key) => !session.done.has(key) && live.has(key));
  const current = currentKey ? live.get(currentKey) : undefined;
  useEffect(() => {
    if (!current) return;
    const target = findByPosition(maps[current.side], current.games[0].check.position);
    if (target) goTo(current.side, target.key, true);
    // goTo change à chaque rendu ; seule l'étape courante doit relancer le recentrage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);
  const mark = (key: string, how: 'settled' | 'skipped' | null) =>
    setSession((active) => {
      if (!active) return active;
      const done = new Map(active.done);
      if (how) done.set(key, how);
      else done.delete(key);
      return { ...active, done };
    });
  // Au téléphone, le résultat d'une action est en haut du volet : on y remonte.
  const toTop = () => {
    if (!wide) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const startSession = () => {
    // Une couleur après l'autre, en commençant par celle qu'on regarde : changer de camp à chaque étape fait tout redessiner.
    const ordered = [...steps.filter((step) => step.side === side), ...steps.filter((step) => step.side !== side)];
    setSession({ queue: ordered.map((step) => step.key), done: new Map() });
    build(null);
    setView('position');
  };
  const settle = (step: SessionStep, addition: Addition | null, text: string) => {
    if (addition) add(addition);
    mark(step.key, 'settled');
    build(null);
    toTop();
    show({
      text,
      undo: () => {
        if (addition) remove(addition);
        mark(step.key, null);
      },
    });
  };
  const accept = (moves: AddedMove[], lines: (readonly string[])[]) => {
    if (!building) return;
    const addition: Addition = { side: building.origin.side, addedAt: replay.day, moves };
    const text = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire`;
    const step = building.stepKey ? live.get(building.stepKey) : undefined;
    if (step) {
      settle(step, addition, text);
      return;
    }
    add(addition);
    build(null);
    show({ text, undo: () => remove(addition) });
    // La ligne ajoutée se voit tout de suite, même trop fine pour l'arrivée.
    const line = lines[0];
    if (line) {
      setPaths((current) => ({ ...current, [building.origin.side]: line }));
      setFocus({ key: line.join(' '), stamp: Date.now(), centre: true });
    }
  };
  const actions: StepActions = {
    onAdd: (step) => {
      const played = figurineMove(step.played, step.path.length + 1);
      const addition: Addition = { side: step.side, addedAt: replay.day, moves: [{ position: step.games[0].check.position, san: step.played, source: 'habit' }] };
      settle(step, addition, `${played} added to your repertoire`);
    },
    onBuild: (step) => build({ origin: originOf(step.games[0], true), stepKey: step.key }),
    onPrepare: (step) => build({ origin: originOf(step.games[0], false), stepKey: step.key }),
    onStay: (step) => {
      const ids = step.games.map((checked) => checked.id);
      ids.forEach(ignore);
      mark(step.key, 'settled');
      toTop();
      const games = ids.length;
      const ply = step.path.length + 1;
      show({
        text:
          step.kind === 'left'
            ? `Kept ${step.planned.map((san) => figurineMove(san, ply)).join(' · ')} · ${games} ${games === 1 ? 'game' : 'games'} set aside`
            : `${figurineMove(step.played, ply)} left unprepared · ${games} ${games === 1 ? 'game' : 'games'} set aside`,
        undo: () => {
          unignore(ids);
          mark(step.key, null);
        },
      });
    },
  };
  const skip = (step: SessionStep) => {
    mark(step.key, 'skipped');
    show({ text: 'Skipped: it stays to settle', undo: () => mark(step.key, null) });
  };

  const shownRank = node.priority ?? 1;
  // Une ligne jouée hors du répertoire se voit aussi sur la carte, en fantôme, là où elle quitte le répertoire.
  const shownPreview = useMemo(() => (building ? preview : path.length > node.path.length ? [path] : []), [building, preview, path, node.path.length]);
  const pins = useMemo(() => [...markedNodes(maps.w).priorities.map((n) => ({ side: 'w' as Side, node: n })), ...markedNodes(maps.b).priorities.map((n) => ({ side: 'b' as Side, node: n }))].sort((a, b) => a.node.priority! - b.node.priority!), [maps]);
  const goToPriority = (rank: number) => {
    const pin = pins.find((candidate) => candidate.node.priority === rank) ?? pins[0];
    if (pin) goTo(pin.side, pin.node.key, true);
    setView('position');
  };
  const position = session ? session.queue.indexOf(currentKey ?? '') + 1 : 0;
  const counts = session ? [...session.done.values()] : [];
  const settled = counts.filter((how) => how === 'settled').length;
  const skipped = counts.filter((how) => how === 'skipped').length;

  useEffect(() => {
    if (building) return;
    const press = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
      const inRepertoire = path.length === node.path.length;
      const parent = path.length ? nodeAlong(root, path.slice(0, -1)) : null;
      const siblings = parent && inRepertoire ? parent.children.filter((child) => !child.stub) : [];
      const at = siblings.findIndex((child) => child.san === path[path.length - 1]);
      if (event.key === 'ArrowLeft' && path.length) back();
      else if (event.key === 'ArrowRight' && inRepertoire && node.children.length) {
        play([...node.children].sort((a, b) => b.games - a.games)[0].san!);
      } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && siblings.length > 1 && at >= 0) {
        const next = siblings[(at + (event.key === 'ArrowDown' ? 1 : siblings.length - 1)) % siblings.length];
        walk([...path.slice(0, -1), next.san!]);
      } else if (event.key === 'Home') walk([]);
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
    build(null);
  });
  const habits = useMemo(
    () => gamesOfLastMonths(known, RECENT_MONTHS, new Date(replay.day)).filter((game) => game.side === building?.origin.side),
    [known, replay.day, building?.origin.side],
  );
  const first = steps.find((step) => step.side === side) ?? steps[0];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-24" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <ReplayBar replay={{ ...replay, reset }} />
        </PageHeader>
        <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-4 pt-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <SideSwitch side={side} onChange={(next) => !building && setSide(next)} />
            <div role="tablist" aria-label="View" className="ml-auto flex gap-1 rounded-full p-1 lg:hidden" style={{ background: COLOURS.sand }}>
              {(['map', 'position'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={view === tab}
                  onClick={() => setView(tab)}
                  className="rounded-full px-4 py-1.5 text-[14px] font-bold"
                  style={view === tab ? { background: COLOURS.leaf, color: COLOURS.cream } : { color: COLOURS.leaf }}
                >
                  {tab === 'map' ? 'Moves' : building ? 'Building' : 'Board'}
                </button>
              ))}
            </div>
            <span className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
              {session && current ? (
                <SessionBar index={position} total={session.queue.length} settled={settled} side={current.side} onEnd={() => setSession((active) => active && { ...active, ended: true })} />
              ) : (
                <Door
                  onClick={steps.length && !session ? startSession : undefined}
                  title={steps.length ? `${steps.length} ${steps.length === 1 ? 'position' : 'positions'} to settle` : 'Nothing to settle'}
                  tone={steps.length && !session ? 'terracotta' : 'plain'}
                >
                  {first
                    ? `${first.games.length} ${first.games.length === 1 ? 'game' : 'games'} as ${first.side === 'w' ? 'White' : 'Black'} at ${figurineLine(first.path) || 'the start'}`
                    : replay.next
                      ? 'Press “Next day” to bring games in'
                      : 'All games replayed'}
                </Door>
              )}
              <Door
                onClick={pins.length ? () => goToPriority(node.priority !== undefined ? (node.priority % pins.length) + 1 : 1) : undefined}
                title={priorities.length ? `Priority ${shownRank} of ${priorities.length}` : 'No priority'}
                className={session ? 'hidden sm:flex' : undefined}
              >
                {priorities[shownRank - 1] ? <PriorityLabel priority={priorities[shownRank - 1]} /> : 'Nothing below your average'}
              </Door>
            </span>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
            {(wide || view === 'map') && (
              <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-11rem)]">
                {wide ? (
                  <RepertoireMap
                    root={root}
                    side={side}
                    selected={node.key}
                    onSelect={(key) => goTo(side, key, false)}
                    focus={focus}
                    locked={building !== null}
                    preview={shownPreview}
                  />
                ) : (
                  <TreeList root={root} side={side} node={node} onSelect={(key) => goTo(side, key, false)} onOpen={() => setView('position')} />
                )}
              </div>
            )}
            {(wide || view === 'position') && (
            <div className="flex min-w-0 flex-col gap-3 lg:self-start">
              {session && !current ? (
                <Done settled={settled} skipped={skipped} left={steps.length} onClose={() => setSession(null)} />
              ) : building ? (
                <BuildSession
                  key={`${building.origin.start.join(' ')} ${building.stepKey ?? ''} ${building.origin.keep}`}
                  origin={building.origin}
                  games={habits}
                  repertoire={repertoires[building.origin.side]}
                  onAccept={accept}
                  onCancel={() => build(null)}
                  onLines={showLines}
                  stacked
                />
              ) : (
                <PositionPane
                  side={side}
                  path={path}
                  node={node}
                  recent={recent[side]}
                  steps={stepsHere}
                  priority={priority}
                  actions={actions}
                  onSkip={session && current && stepsHere.includes(current) ? () => skip(current) : undefined}
                  onNextPriority={pins.length > 1 && node.priority !== undefined ? () => goToPriority(node.priority! + 1) : undefined}
                  onExtend={() => build({ origin: originAt(side, node.path, path) })}
                  onPrepareFollows={
                    priority
                      ? () => build({ origin: { ...originAt(side, priority.path, priority.path), heading: `Prepare your moves after ${figurineMove(priority.path[priority.path.length - 1], priority.path.length)}` } })
                      : undefined
                  }
                  onMove={play}
                  onBack={path.length ? back : undefined}
                />
              )}
            </div>
            )}
          </div>
        </main>
        <Toast toast={toast} onClose={close} />
      </div>
    </MotionConfig>
  );
}

function PriorityLabel({ priority }: { priority: Priority }) {
  return <>{`${priority.side === 'w' ? 'White' : 'Black'} · ${figurineLine(priority.path)}`}</>;
}

function SessionBar({ index, total, settled, side, onEnd }: { index: number; total: number; settled: number; side: Side; onEnd: () => void }) {
  return (
    <div aria-label="Progress" className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold sm:w-auto sm:min-w-[24rem]" style={raised(false)}>
      <span className="whitespace-nowrap">
        Session · {index} of {total} ·{' '}
        <motion.span key={side} initial={{ backgroundColor: COLOURS.apricot }} animate={{ backgroundColor: 'oklch(0 0 0 / 0)' }} transition={{ duration: 1.2 }} className="ml-1.5 rounded px-1">
          as {side === 'w' ? 'White' : 'Black'}
        </motion.span>
      </span>
      <span className="hidden h-2.5 min-w-12 flex-1 overflow-hidden rounded-full sm:block" style={{ background: COLOURS.sand }}>
        <motion.span className="block h-full rounded-full" style={{ background: COLOURS.leaf }} animate={{ width: `${(settled / total) * 100}%` }} transition={SPRING} />
      </span>
      <button type="button" onClick={onEnd} className="ml-auto whitespace-nowrap rounded-lg px-2 py-1 underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
        End session
      </button>
    </div>
  );
}

function Done({ settled, skipped, left, onClose }: { settled: number; skipped: number; left: number; onClose: () => void }) {
  return (
    <aside aria-label="Done" className="flex w-full flex-col items-start gap-3 rounded-3xl p-5" style={raised(false)}>
      <span className="text-[24px] font-extrabold tracking-[-0.02em]">Session done</span>
      <span className="text-[15px]">
        <strong>{settled}</strong> settled · <strong>{skipped}</strong> skipped for later
      </span>
      <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
        {left ? `${left} still to settle: they stay marked on the map.` : 'Nothing left to settle. Come back after your next games.'}
      </span>
      <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.97 }} transition={SPRING} className="rounded-full px-4 py-2 font-bold focus-visible:outline-2" style={raised(true)}>
        Close
      </motion.button>
    </aside>
  );
}

function Door({ onClick, title, tone = 'plain', className = 'flex', children }: { onClick?: () => void; title: string; tone?: 'plain' | 'terracotta'; className?: string; children: ReactNode }) {
  const accent = tone === 'terracotta';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={SPRING}
      className={`${className} min-w-0 flex-1 flex-col items-start rounded-2xl px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-[17rem] sm:flex-none`}
      style={{ ...raised(false), ...(accent ? { background: 'oklch(0.52 0.15 35)', color: 'white' } : {}), opacity: onClick ? 1 : 0.7 }}
    >
      <span className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</span>
      <span className="w-full truncate text-[13px] font-semibold" style={{ color: accent ? 'white' : COLOURS.leafSoft }}>
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
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities, createdAt: REPLAY_START }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities, createdAt: REPLAY_START }),
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
