import { MotionConfig, motion } from 'framer-motion';
import { useSearchParams } from 'react-router';
import { replayLine } from '../position/replay';
import { positionKey } from '../domain/repertoire';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BuildSession } from '../checks/BuildSession';
import { originAt, originOf, type BuildOrigin } from '../checks/useBuilder';
import type { AddedMove, Addition } from '../domain/addition';
import { buildOpeningTree, isPlayerMove, type OpeningTree } from '../domain/openingTree';
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
import { COLOURS, FONT_FAMILY, raised, SPRING, tile } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWide } from '../workshop/useWide';
import { storedSide, storeSide } from '../workshop/storedSide';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PositionPane, type StepActions } from './PositionPane';
import { PhonePane } from './PhonePane';
import { RepertoireMap } from './RepertoireMap';
import { buildRepertoireMap, forEachNode, markedNodes, type MapNode } from './repertoireMap';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;
// Un ajout reste déplié sur la carte pendant deux semaines de jeu.
const FRESH_DAYS = 14;
const daysBefore = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

interface Session {
  /** Les étapes connues à l'ouverture : un ajout peut en régler d'autres en route. */
  queue: readonly string[];
  /** Par étape traitée : réglée, ou remise à plus tard. */
  done: ReadonlyMap<string, 'settled' | 'skipped'>;
  /** Arrêtée avant la fin : on montre quand même le bilan. */
  ended?: boolean;
  /** Parties revenues à trancher parce que le joueur y a choisi un autre coup. */
  returned?: number;
}

/** POC (README, « the tree as the landing screen ») : le répertoire comme carte, à côté de l'aiguillage pour comparer. */
export function TreePage() {
  useWorkshopFont();
  const { replay, known, repertoires, steps, judging, add, remove, ignore, unignore, forgetIgnored, forgetAdditions } = useReplayedSession();
  // Openings envoie une ligne à travailler par l'adresse : /dev/tree?side=b&line=d4 Nf6.
  const [params] = useSearchParams();
  const asked = useMemo(
    () => ({ side: params.get('side') === 'b' ? 'b' : params.get('side') === 'w' ? 'w' : storedSide(), line: params.get('line')?.split(' ').filter(Boolean) ?? [] }) as { side: Side; line: string[] },
    [params],
  );
  const [side, setSide] = useState<Side>(asked.side);
  useEffect(() => storeSide(side), [side]);
  const [paths, setPaths] = useState<Record<Side, readonly string[]>>(() => ({ w: [], b: [], [asked.side]: asked.line }));
  const [focus, setFocus] = useState<{ key: string; stamp: number; centre: boolean } | null>(() =>
    asked.line.length ? { key: asked.line.join(' '), stamp: Date.now(), centre: true } : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const wide = useWide();
  const [building, setBuilding] = useState<{ origin: BuildOrigin; stepKey?: string } | null>(null);
  // Ce que « coup suivant » rejoue au téléphone : la ligne d'où l'on vient de reculer, comme sur Lichess.
  const [trails, setTrails] = useState<Record<Side, readonly string[]>>(() => ({ w: [], b: [], [asked.side]: asked.line }));
  // Ce que le volet met en avant quand une position porte une décision et une priorité : ce qui y a mené.
  const [lead, setLead] = useState<'settle' | 'priority'>(asked.line.length ? 'priority' : 'settle');
  const [preview, setPreview] = useState<readonly (readonly string[])[]>([]);
  const [buildPath, setBuildPath] = useState<readonly string[] | null>(null);
  const [pinned, setPinned] = useState<readonly string[]>([]);
  // La carte suit l'échiquier du constructeur : le coup qu'on regarde y est sélectionné et gardé en vue.
  const followBuild = useCallback((next: readonly string[]) => {
    setBuildPath(next);
    setFocus({ key: next.join(' '), stamp: Date.now(), centre: false });
  }, []);
  const showLines = useCallback((lines: (readonly string[])[]) => {
    setPreview(lines);
    const last = lines.at(-1);
    if (last) setFocus({ key: last.join(' '), stamp: Date.now(), centre: true });
  }, []);
  const build = (next: { origin: BuildOrigin; stepKey?: string } | null) => {
    setBuilding(next);
    setPreview([]);
    setBuildPath(null);
    if (!wide) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (next) setFocus({ key: next.origin.start.join(' '), stamp: Date.now(), centre: true });
  };
  const { toast, show, close } = useToast();

  const { maps, recent, priorities } = useMaps(known, replay.day, repertoires, steps);
  const root = maps[side];
  const path = paths[side];
  const node = useMemo(() => nodeAlong(root, path), [root, path]);
  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  const priority = node.priority !== undefined ? priorities[node.priority - 1] : undefined;

  const goTo = (target: Side, key: string, centre: boolean) => {
    const found = findNode(maps[target], key);
    if (!found) return;
    setLead('settle');
    // Le bilan d'une séance finie s'efface dès qu'on va ailleurs.
    setSession((active) => (active && (active.ended || !active.queue.some((k) => !active.done.has(k) && live.has(k))) ? null : active));
    setSide(target);
    setPaths((current) => ({ ...current, [target]: found.path }));
    setTrails((current) => ({ ...current, [target]: startsWith(current[target], found.path) ? current[target] : found.path }));
    setFocus({ key, stamp: Date.now(), centre });
  };
  const walk = (next: readonly string[]) => {
    setPaths((current) => ({ ...current, [side]: next }));
    setTrails((current) => ({ ...current, [side]: startsWith(current[side], next) ? current[side] : next }));
    const reached = nodeAlong(root, next);
    if (reached.path.length === next.length) setFocus({ key: reached.key, stamp: Date.now(), centre: false });
  };
  const play = (san: string) => walk([...path, san]);
  const back = () => walk(path.slice(0, -1));
  const trail = trails[side];
  const mainMove = path.length === node.path.length ? [...node.children].sort((a, b) => b.games - a.games)[0]?.san : undefined;
  const forward = trail.length > path.length && startsWith(trail, path) ? () => walk(trail.slice(0, path.length + 1)) : mainMove ? () => play(mainMove) : undefined;
  // ▶| : le bout de la ligne gardée, sinon le bout de la ligne principale du répertoire.
  const toEnd = forward
    ? () => {
        if (trail.length > path.length && startsWith(trail, path)) return walk(trail);
        let reached = node;
        const line = [...path];
        while (reached.children.length) {
          reached = [...reached.children].sort((a, b) => b.games - a.games)[0];
          if (reached.stub) break;
          line.push(reached.san!);
        }
        walk(line);
      }
    : undefined;

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
  const pane = useRef<HTMLDivElement>(null);
  // Au téléphone, tout ce qui change la position remonte en haut : l'échiquier entier et la carte tiennent dans l'écran.
  const toTop = () => {
    if (!wide) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const startSession = () => {
    // Une couleur après l'autre, en commençant par celle qu'on regarde : changer de camp à chaque étape fait tout redessiner.
    const ordered = [...steps.filter((step) => step.side === side), ...steps.filter((step) => step.side !== side)];
    setSession({ queue: ordered.map((step) => step.key), done: new Map() });
    build(null);
    toTop();
  };
  // Après un ajout, une partie de l'étape peut encore quitter le répertoire plus loin : on la guette au rendu suivant
  // pour le dire tout de suite, plutôt que de laisser le compteur étonner.
  const watched = useRef<{ ids: ReadonlySet<number>; text: string; undo: () => void } | null>(null);
  useEffect(() => {
    const watch = watched.current;
    if (!watch) return;
    watched.current = null;
    const again = steps.find((candidate) => candidate.games.some((checked) => watch.ids.has(checked.id)));
    if (!again) return;
    const ply = again.path.length + 1;
    show({ text: `${watch.text} · that game leaves the repertoire again at ${figurineMove(again.played, ply)}: still to settle`, undo: watch.undo });
    setSession((active) => active && { ...active, returned: (active.returned ?? 0) + 1 });
    // Seul un nouveau calcul des étapes compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);
  const settle = (step: SessionStep, addition: Addition | null, text: string) => {
    if (addition) add(addition);
    mark(step.key, 'settled');
    build(null);
    toTop();
    const undo = () => {
      if (addition) remove(addition);
      mark(step.key, null);
    };
    if (addition) watched.current = { ids: new Set(step.games.map((checked) => checked.id)), text, undo };
    show({ text, undo });
  };
  const accept = (moves: AddedMove[], lines: (readonly string[])[]) => {
    if (!building) return;
    const addition: Addition = { side: building.origin.side, addedAt: replay.day, moves };
    setPinned((current) => [...current, ...lines.map((line) => line.join(' '))]);
    const text = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire`;
    const step = building.stepKey ? live.get(building.stepKey) : undefined;
    if (step) {
      settle(step, addition, text);
      return;
    }
    add(addition);
    build(null);
    // Une ligne qui retombe sur une position déjà dessinée y est rangée : on le dit, et la sélection y va.
    const line0 = lines[0];
    const landing = line0 && findByPosition(maps[building.origin.side], positionKey(replayLine(line0).fens[line0.length]));
    const transposed = landing && landing.key !== line0.join(' ') ? landing : undefined;
    show({ text: transposed ? `${text} · same position as ${figurineLine(transposed.path)}: shown there, linked from here` : text, undo: () => remove(addition) });
    // La ligne ajoutée se voit tout de suite, même trop fine pour l'arrivée.
    const line = transposed ? transposed.path : lines[0];
    if (line) {
      setPaths((current) => ({ ...current, [building.origin.side]: line }));
      setFocus({ key: line.join(' '), stamp: Date.now(), centre: true });
    }
  };
  const actions: StepActions = {
    onAdd: (step) => {
      const played = figurineMove(step.played, step.path.length + 1);
      const addition: Addition = { side: step.side, addedAt: replay.day, moves: [{ position: step.games[0].check.position, san: step.played, source: 'habit' }] };
      setPinned((current) => [...current, [...step.path, step.played].join(' ')]);
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
    show({ text: 'Skipped for this session', undo: () => mark(step.key, null) });
  };

  // La priorité montrée suit le camp regardé ; sur un nœud épinglé, c'est la sienne.
  const shownRank = node.priority ?? (priorities.findIndex((candidate) => candidate.side === side) + 1 || 1);
  // Une ligne jouée hors du répertoire se voit aussi sur la carte, en fantôme, là où elle quitte le répertoire.
  const shownPreview = useMemo(() => (building ? preview : path.length > node.path.length ? [path] : []), [building, preview, path, node.path.length]);
  const pins = useMemo(() => [...markedNodes(maps.w).priorities.map((n) => ({ side: 'w' as Side, node: n })), ...markedNodes(maps.b).priorities.map((n) => ({ side: 'b' as Side, node: n }))].sort((a, b) => a.node.priority! - b.node.priority!), [maps]);
  const goToPriority = (rank: number) => {
    const pin = pins.find((candidate) => candidate.node.priority === rank) ?? pins[0];
    if (pin) goTo(pin.side, pin.node.key, true);
    setLead('priority');
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
        // Sans boucler : ↑ au premier frère ne doit pas sauter tout en bas de la carte.
        const next = siblings[Math.min(siblings.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))];
        if (next.san !== path[path.length - 1]) walk([...path.slice(0, -1), next.san!]);
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
  const before = useRef<ReadonlySet<string> | null>(null);
  const nextDay = () => {
    close();
    before.current = new Set(steps.map((step) => step.key));
    replay.next!();
  };
  useEffect(() => {
    const known = before.current;
    // Les écarts du jour attendent l'avis du moteur : on ne les compte qu'une fois jugés.
    if (!known || judging) return;
    before.current = null;
    const added = steps.filter((step) => !known.has(step.key)).length;
    // Un coup adverse croisé une seule fois sort de la liste au bout d'un temps : le compteur baisse, on dit pourquoi.
    const expired = [...known].filter((key) => !live.has(key)).length;
    const games = replay.gamesThatDay;
    show({ text: `${games} ${games === 1 ? 'game' : 'games'} played${added > 0 ? ` · ${added} new to settle` : ''}${expired > 0 ? ` · ${expired} expired` : ''}` });
    // Seuls le changement de jour et la fin du jugement comptent ; `steps` est recalculé dans le même rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.day, judging]);
  const habits = useMemo(
    () => gamesOfLastMonths(known, RECENT_MONTHS, new Date(replay.day)).filter((game) => game.side === building?.origin.side),
    [known, replay.day, building?.origin.side],
  );
  const first = steps.find((step) => step.side === side) ?? steps[0];
  const perSide = { w: steps.filter((step) => step.side === 'w').length, b: steps.filter((step) => step.side === 'b').length };

  // Au téléphone, la séance finie se dit dans un toast : l'échiquier ne doit jamais disparaître.
  const finished = Boolean(session && !current);
  useEffect(() => {
    if (!finished || wide) return;
    setSession(null);
    show({ text: `Session done · ${settled} settled${steps.length ? ` · ${steps.length} still to settle` : ''}` });
    // Seule la fin de la séance compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  const pane$ = session && !current && wide ? (
    <Done settled={settled} skipped={skipped} returned={session.returned ?? 0} left={steps.length} onClose={() => setSession(null)} />
  ) : building ? (
    <BuildSession
        key={`${building.origin.start.join(' ')} ${building.stepKey ?? ''} ${building.origin.keep}`}
        origin={building.origin}
        games={habits}
        repertoire={repertoires[building.origin.side]}
        onAccept={accept}
        onCancel={() => build(null)}
        onLines={showLines}
        onPath={followBuild}
        stacked
      />
  ) : null;
  const paneProps = {
    side,
    path,
    node,
    recent: recent[side],
    steps: stepsHere,
    priority,
    actions,
    lead: session ? ('settle' as const) : lead,
    onLead: (next: 'settle' | 'priority') => {
      setLead(next);
      toTop();
    },
    onSkip: session && current && stepsHere.includes(current) ? () => skip(current) : undefined,
    priorityCount: priorities.length,
    onNextPriority: pins.length > 1 && node.priority !== undefined ? () => goToPriority(node.priority! + 1) : undefined,
    onExtend: () => build({ origin: originAt(side, node.path, path) }),
    onPrepareFollows: priority
      ? (line: readonly string[]) => {
          const reached = nodeAlong(root, line);
          const after = figurineMove(line[line.length - 1], line.length);
          const heading = isPlayerMove(side, line.length + 1) ? `Prepare your moves after ${after}` : `Prepare against their replies after ${after}`;
          build({ origin: { ...originAt(side, line.slice(0, Math.min(reached.path.length, line.length)), line), heading } });
        }
      : undefined,
    onMove: play,
    onJump: walk,
    onBack: path.length ? back : undefined,
  };
  const nextPriority = pins.length ? () => goToPriority(node.priority !== undefined ? (node.priority % pins.length) + 1 : shownRank) : undefined;
  const endSession = () => setSession((active) => active && { ...active, ended: true });

  return (
    <MotionConfig reducedMotion="user">
      <div className={`min-h-screen pb-24`} style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <ReplayBar replay={{ ...replay, reset, next: replay.next && nextDay }} />
        </PageHeader>
        {wide ? (
          <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-8 pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <SideSwitch side={side} onChange={(next) => !building && setSide(next)} counts={perSide} />
              <span className="ml-auto flex gap-2">
                {session && current ? (
                  <SessionBar index={position} total={session.queue.length} settled={position} side={current.side} onEnd={endSession} />
                ) : (
                  <Door onClick={steps.length ? startSession : undefined} title={steps.length ? `${steps.length} to settle` : 'Nothing to settle'} tone={steps.length ? 'terracotta' : 'plain'}>
                    {first ? `${perSide.w} as White · ${perSide.b} as Black` : replay.next ? '“Next game day” brings games in' : 'All games replayed'}
                  </Door>
                )}
                <Door onClick={nextPriority} title={priorities.length ? `Priority ${shownRank} of ${priorities.length}` : 'No priority'}>
                  {priorities[shownRank - 1] ? <PriorityLabel priority={priorities[shownRank - 1]} /> : 'Nothing below your average'}
                </Door>
              </span>
            </div>
            {/* Une seule géométrie : la carte garde sa largeur, le volet aussi, construction comprise. */}
            <div className="grid grid-cols-[minmax(0,1fr)_27rem] gap-5">
              <div className="sticky top-4 h-[calc(100vh-11rem)]">
                <RepertoireMap
                  root={root}
                  side={side}
                  selected={building && buildPath ? buildPath.join(' ') : node.key}
                  onSelect={(key) => goTo(side, key, false)}
                  focus={focus}
                  locked={building !== null}
                  preview={shownPreview}
                  pinned={pinned}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-3 self-start">{pane$ ?? <PositionPane {...paneProps} />}</div>
            </div>
          </main>
        ) : (
          <main className="flex flex-col gap-3 px-4 pt-3">
            {!building && (
              <div className="flex items-center gap-2">
                <SideTabs side={side} onChange={setSide} />
                {session && current ? (
                  <PhoneSession index={position} total={session.queue.length} onEnd={endSession} />
                ) : (
                  <span className="ml-auto flex gap-1.5">
                    {steps.length > 0 && (
                      <Pill onClick={startSession} tone="terracotta">
                        {steps.length} to settle
                      </Pill>
                    )}
                    {pins.length > 0 && (
                      <Pill onClick={nextPriority!} active={node.priority !== undefined}>
                        Priorities
                      </Pill>
                    )}
                  </span>
                )}
              </div>
            )}
            <div ref={pane} className="flex min-w-0 scroll-mt-3 flex-col gap-3">
              {pane$ ?? <PhonePane {...paneProps} trail={trail} onSelect={(key) => goTo(side, key, false)} />}
            </div>
          </main>
        )}
        {!wide && !building && <BottomBar onStart={path.length ? () => walk([]) : undefined} onBack={path.length ? back : undefined} onForward={forward} onEnd={toEnd} />}
        <Toast toast={toast} onClose={close} />
      </div>
    </MotionConfig>
  );
}

const startsWith = (line: readonly string[], prefix: readonly string[]) => prefix.length <= line.length && prefix.every((san, index) => line[index] === san);

/** Le camp, en onglets serrés. */
function SideTabs({ side, onChange }: { side: Side; onChange: (side: Side) => void }) {
  return (
    <div role="tablist" aria-label="Repertoire" className="flex shrink-0 rounded-full p-0.5 text-[14px] font-bold" style={{ background: COLOURS.sand }}>
      {(['w', 'b'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={side === tab}
          onClick={() => onChange(tab)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 focus-visible:outline-2"
          style={side === tab ? { background: COLOURS.leaf, color: COLOURS.cream } : { color: COLOURS.leaf }}
        >
          {tab === 'w' ? 'White' : 'Black'}
        </button>
      ))}
    </div>
  );
}

function Pill({ onClick, tone = 'plain', active = false, children }: { onClick: () => void; tone?: 'plain' | 'terracotta'; active?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className="whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] font-bold focus-visible:outline-2"
      aria-pressed={tone === 'plain' ? active : undefined}
      style={tone === 'terracotta' ? { background: COLOURS.terracotta, color: 'white' } : active ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.paper), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}

function PhoneSession({ index, total, onEnd }: { index: number; total: number; onEnd: () => void }) {
  return (
    <div aria-label="Progress" className="ml-auto flex min-w-0 flex-1 items-center gap-2 text-[13px] font-bold">
      <span className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
        <motion.span className="block h-full rounded-full" style={{ background: COLOURS.terracotta }} animate={{ width: `${(index / total) * 100}%` }} transition={SPRING} />
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {index}/{total}
      </span>
      <button type="button" onClick={onEnd} className="whitespace-nowrap rounded-full px-2.5 py-1.5 focus-visible:outline-2" style={{ ...tile(COLOURS.paper), color: COLOURS.leaf }}>
        End
      </button>
    </div>
  );
}

/** Sous le pouce, comme la barre de Lichess : début, coup précédent, coup suivant, fin de ligne. */
function BottomBar({ onStart, onBack, onForward, onEnd }: { onStart?: () => void; onBack?: () => void; onForward?: () => void; onEnd?: () => void }) {
  const buttons = [
    { label: 'Start', onClick: onStart, icon: 'M7 6v12M18 6l-8 6 8 6z' },
    { label: 'Previous move', onClick: onBack, icon: 'M16 6l-8 6 8 6z' },
    { label: 'Next move', onClick: onForward, icon: 'M8 6l8 6-8 6z' },
    { label: 'End of the line', onClick: onEnd, icon: 'M17 6v12M6 6l8 6-8 6z' },
  ];
  return (
    <nav aria-label="Moves" className="fixed inset-x-0 bottom-0 z-30 flex pb-[env(safe-area-inset-bottom)]" style={{ background: COLOURS.leaf }}>
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          aria-label={button.label}
          onClick={button.onClick}
          disabled={!button.onClick}
          className="grid h-14 flex-1 place-items-center focus-visible:outline-2 focus-visible:-outline-offset-4 active:bg-white/10 disabled:opacity-35"
          style={{ color: COLOURS.cream }}
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true">
            <path d={button.icon} />
          </svg>
        </button>
      ))}
    </nav>
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
        <motion.span key={side} initial={{ backgroundColor: COLOURS.apricot }} animate={{ backgroundColor: 'oklch(0 0 0 / 0)' }} transition={{ duration: 1.2 }} className="rounded px-1">
          as {side === 'w' ? 'White' : 'Black'}
        </motion.span>
      </span>
      <span className="h-2.5 min-w-8 flex-1 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
        <motion.span className="block h-full rounded-full" style={{ background: COLOURS.leaf }} animate={{ width: `${(settled / total) * 100}%` }} transition={SPRING} />
      </span>
      <button type="button" onClick={onEnd} className="ml-auto whitespace-nowrap rounded-lg px-2 py-1 underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
        End session
      </button>
    </div>
  );
}

function Done({ settled, skipped, returned, left, onClose }: { settled: number; skipped: number; returned: number; left: number; onClose: () => void }) {
  return (
    <aside aria-label="Done" className="flex w-full flex-col items-start gap-3 rounded-3xl p-5" style={raised(false)}>
      <span className="text-[24px] font-extrabold tracking-[-0.02em]">Session done</span>
      <span className="text-[15px]">
        <strong>{settled}</strong> settled · <strong>{skipped}</strong> skipped for later
        {returned > 0 && (
          <>
            {' '}
            · <strong>{returned}</strong> {returned === 1 ? 'game' : 'games'} left the repertoire again further on
          </>
        )}
      </span>
      <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
        {left ? `${left} still to settle: they stay marked in the tree.` : 'Nothing left to settle. Come back after your next games.'}
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
      <span className="hidden w-full truncate text-[13px] font-semibold sm:block" style={{ color: accent ? 'white' : COLOURS.leafSoft }}>
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
      // Des décisions, pas des parties : la même unité que « N to settle ».
      toSettle[step.side].set(position, (toSettle[step.side].get(position) ?? 0) + 1);
    }
    const maps: Record<Side, MapNode> = {
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities, createdAt: REPLAY_START, freshSince: daysBefore(day, FRESH_DAYS) }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities, createdAt: REPLAY_START, freshSince: daysBefore(day, FRESH_DAYS) }),
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
