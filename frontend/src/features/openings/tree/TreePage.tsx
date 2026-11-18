import { MotionConfig } from 'framer-motion';
import { useSearchParams } from 'react-router';
import { replayLine } from '../position/replay';
import { positionKey } from '../domain/repertoire';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BuildSession } from '../checks/BuildSession';
import { originAt, originOf, type BuildOrigin } from '../checks/useBuilder';
import type { AddedMove, Addition } from '../domain/addition';
import { buildOpeningTree, isPlayerMove, type OpeningTree } from '../domain/openingTree';
import { figurineLine, figurineMove } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, shownLine, type Priority } from '../domain/priorities';
import { splitWorked } from '../domain/worked';
import { checkQueue, type SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { TaskBar, TaskDone } from '../workshop/Task';
import { SideSwitch } from '../workshop/SideSwitch';
import { COLOURS, FONT_FAMILY } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWide } from '../workshop/useWide';
import { useWorkedLines, type WorkedLine } from '../replay/useWorkedLines';
import { storedSide, storeSide } from '../workshop/storedSide';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PositionPane, type StepActions } from './PositionPane';
import { PhonePane } from './PhonePane';
import { RepertoireMap } from './RepertoireMap';
import { buildRepertoireMap, forEachNode, type MapNode } from './repertoireMap';

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
  /** Parties revenues à trancher parce que le joueur y a choisi un autre coup. */
  returned?: number;
}

/**
 * Le répertoire, et les deux tâches qui s'y font (docs/flow/target.html) : `?task=check` tranche les positions
 * une à une, `?task=weak&side=…&line=…` travaille une ouverture faible. Sans tâche, on parcourt et on étend.
 */
export function TreePage() {
  useWorkshopFont();
  const { source, replay, known, repertoires, steps, adoptions, judging, add, remove, ignore, unignore, forgetIgnored, forgetAdditions } = useReplayedSession();
  const { worked, work, unwork } = useWorkedLines();
  // Openings envoie une ligne à travailler par l'adresse : /dev/tree?side=b&line=d4 Nf6.
  const [params, setParams] = useSearchParams();
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
  const task = params.get('task') === 'check' ? 'check' : params.get('task') === 'weak' ? 'weak' : null;
  // Le bilan d'une ouverture faible préparée, avant de passer à la suivante.
  const [prepared, setPrepared] = useState<{ moves: number; line: readonly string[] } | null>(null);
  const wide = useWide();
  const [building, setBuilding] = useState<{ origin: BuildOrigin; stepKey?: string; worked?: { side: Side; path: readonly string[] } } | null>(null);
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
  const build = (next: { origin: BuildOrigin; stepKey?: string; worked?: { side: Side; path: readonly string[] } } | null) => {
    setBuilding(next);
    setPreview([]);
    setBuildPath(null);
    if (!wide) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (next) setFocus({ key: next.origin.start.join(' '), stamp: Date.now(), centre: true });
  };
  const { toast, show, close } = useToast();

  const { maps, recent, priorities } = useMaps(known, replay.day, repertoires, steps, source.start, worked);
  const root = maps[side];
  const path = paths[side];
  const node = useMemo(() => nodeAlong(root, path), [root, path]);
  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  // Le rang de la tâche vient de l'adresse, pas de la position regardée : on peut s'écarter de la ligne sans le perdre.
  const askedIndex = useMemo(
    () => priorities.findIndex((candidate) => candidate.side === asked.side && showsOn(candidate, asked.line)),
    [priorities, asked],
  );
  const taskRank = askedIndex + 1 || 1;
  const taskPriority = task === 'weak' ? priorities[taskRank - 1] : undefined;
  // Dans la tâche, la faiblesse se montre sur sa ligne même hors du répertoire : on y joue un coup qu'il n'a pas.
  const onTaskLine = taskPriority !== undefined && taskPriority.side === side && showsOn(taskPriority, path);
  const priority = onTaskLine ? taskPriority : node.priority !== undefined ? priorities[node.priority - 1] : undefined;
  const priorityRank = onTaskLine ? taskRank : node.priority;

  const goTo = (target: Side, key: string, centre: boolean) => {
    const found = findNode(maps[target], key);
    if (!found) return;
    setLead('settle');
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
  const currentKey = session?.queue.find((key) => !session.done.has(key) && live.has(key));
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
    setSession({ queue: checkQueue(steps, side).map((step) => step.key), done: new Map() });
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
    const worked = building.worked && { ...building.worked, since: replay.day };
    if (worked) work(worked);
    if (worked && task === 'weak') setPrepared({ moves: moves.length, line: lines[0] ?? [] });
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
    // Dans la tâche, le bilan remplace la carte : annuler y revient.
    const inTask = building.worked !== undefined && task === 'weak';
    show({
      text: transposed && !inTask ? `${text} · same position as ${figurineLine(transposed.path)}: shown there, linked from here` : text,
      undo: () => {
        remove(addition);
        if (worked) unwork(worked);
        // Retour à la carte de la faiblesse : la ligne retirée n'a plus rien à montrer.
        if (inTask) goToWeak(taskRank);
      },
    });
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

  // Une ligne jouée hors du répertoire se voit aussi sur la carte, en fantôme, là où elle quitte le répertoire.
  const shownPreview = useMemo(() => (building ? preview : path.length > node.path.length ? [path] : []), [building, preview, path, node.path.length]);
  // Toutes les faiblesses à la suite, celles hors du répertoire comprises : on va à leur ligne, pas à leur épingle.
  const goToWeak = (rank: number) => {
    const target = priorities[rank - 1];
    if (!target) return;
    const line = shownLine(target);
    // L'adresse suit la faiblesse montrée : recharger la page y ramène.
    setParams({ task: 'weak', side: target.side, line: line.join(' ') }, { replace: true });
    setPrepared(null);
    setSide(target.side);
    setPaths((current) => ({ ...current, [target.side]: line }));
    setTrails((current) => ({ ...current, [target.side]: line }));
    setFocus({ key: line.join(' '), stamp: Date.now(), centre: true });
    setLead('priority');
    toTop();
  };
  // Une adresse dont la ligne n'est plus une faiblesse (autre jour du rejeu, lien ancien) mène à la première.
  useEffect(() => {
    if (task === 'weak' && priorities.length && askedIndex < 0) goToWeak(1);
    // Seule une adresse périmée compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, priorities, askedIndex]);
  const nextWeak = task === 'weak' && priorities.length > 1 ? () => goToWeak((taskRank % priorities.length) + 1) : undefined;
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
    build(null);
  });
  const before = useRef<ReadonlySet<string> | null>(null);
  const nextDay = () => {
    close();
    before.current = new Set(steps.map((step) => step.key));
    replay.next!();
  };
  const announced = useRef(new Set<string>());
  // Le changement de jour et les coups entrés seuls au répertoire se disent dans le même message.
  useEffect(() => {
    const known = before.current;
    const fresh = adoptions.filter(({ key }) => !announced.current.has(key));
    // Les écarts du jour attendent l'avis du moteur : on ne les compte qu'une fois jugés.
    if (judging || (!known && !fresh.length)) return;
    fresh.forEach(({ key }) => announced.current.add(key));
    before.current = null;
    const parts: string[] = [];
    if (known) {
      const added = steps.filter((step) => !known.has(step.key)).length;
      // Un coup adverse croisé une seule fois sort de la liste au bout d'un temps : le compteur baisse, on dit pourquoi.
      const expired = [...known].filter((key) => !live.has(key)).length;
      const games = replay.gamesThatDay;
      parts.push(`${games} ${games === 1 ? 'game' : 'games'} played`);
      if (added > 0) parts.push(`${added} new to settle`);
      if (expired > 0) parts.push(`${expired} expired`);
    }
    if (fresh.length) {
      const moves = fresh.map(({ step }) => figurineMove(step.played, step.path.length + 1)).join(', ');
      parts.push(`${moves} now in your repertoire`);
      setPinned((current) => [...current, ...fresh.map(({ step }) => [...step.path, step.played].join(' '))]);
    }
    show({
      text: parts.join(' · '),
      // Annuler une adoption met aussi ses parties de côté : sinon elle reviendrait au rendu suivant.
      undo: fresh.length
        ? () => {
            fresh.forEach(({ step, addition }) => {
              remove(addition);
              step.games.forEach((checked) => ignore(checked.id));
            });
          }
        : undefined,
    });
    // Seuls le changement de jour, la fin du jugement et une adoption comptent ; `steps` est recalculé dans le même rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.day, judging, adoptions]);
  const habits = useMemo(
    () => gamesOfLastMonths(known, RECENT_MONTHS, new Date(replay.day)).filter((game) => game.side === building?.origin.side),
    [known, replay.day, building?.origin.side],
  );
  const perSide = { w: steps.filter((step) => step.side === 'w').length, b: steps.filter((step) => step.side === 'b').length };

  const autoStarted = useRef(false);
  useEffect(() => {
    // Les écarts n'apparaissent qu'une fois jugés : la séance attend le moteur.
    if (task !== 'check' || autoStarted.current || judging || !steps.length) return;
    autoStarted.current = true;
    startSession();
    // Une seule fois, dès que les étapes sont là.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, judging, steps.length]);
  const checkOver = task === 'check' && !judging && (session ? !current : !steps.length);
  const pane$ = building ? (
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
    // En séance, une décision par écran : l'autre coup joué ici vient à l'écran suivant, sur le même échiquier.
    steps: current && stepsHere.includes(current) ? [current] : stepsHere,
    priority,
    actions,
    lead: session ? ('settle' as const) : lead,
    onLead: (next: 'settle' | 'priority') => {
      setLead(next);
      toTop();
    },
    onSkip: session && current && stepsHere.includes(current) ? () => skip(current) : undefined,
    priorityRank,
    // Dans la tâche, la barre dit déjà « 2 of 5 ».
    priorityCount: task === 'weak' ? undefined : priorities.length,
    onNextPriority: onTaskLine ? nextWeak : undefined,
    onExtend: () => build({ origin: originAt(side, node.path, path) }),
    onPrepareFollows: priority
      ? (line: readonly string[]) => {
          const reached = nodeAlong(root, line);
          const after = figurineMove(line[line.length - 1], line.length);
          const heading = isPlayerMove(side, line.length + 1) ? `Prepare your moves after ${after}` : `Prepare against their replies after ${after}`;
          build({ origin: { ...originAt(side, line.slice(0, Math.min(reached.path.length, line.length)), line), heading }, worked: { side, path: priority.path } });
        }
      : undefined,
    onMove: play,
    onJump: walk,
    onBack: path.length ? back : undefined,
  };
  const header =
    task === 'check' ? (
      <TaskBar title="Check" progress={checkOver ? 'done' : session && current ? `${position} of ${session.queue.length} · as ${current.side === 'w' ? 'White' : 'Black'}` : undefined} />
    ) : task === 'weak' ? (
      <TaskBar title="Weak opening" progress={prepared ? 'done' : priorities.length ? `${taskRank} of ${priorities.length}` : undefined} />
    ) : (
      <PageHeader replay={{ ...replay, reset, next: replay.next && nextDay }} />
    );
  const done = checkOver ? (
    <TaskDone title={session ? (settled ? `${settled} settled` : 'Nothing settled') : 'Nothing to settle'}>
      {skipped > 0 && <p>{skipped} skipped for later</p>}
      {(session?.returned ?? 0) > 0 && <p>{session!.returned} {session!.returned === 1 ? 'game' : 'games'} left the repertoire again further on</p>}
      <p>{steps.length ? `${steps.length} still to settle, marked in your repertoire.` : 'Come back after your next games.'}</p>
    </TaskDone>
  ) : prepared !== null ? (
    <TaskDone title={`${prepared.moves} ${prepared.moves === 1 ? 'move' : 'moves'} added`} next={nextWeak && { label: 'Next weak opening', onClick: nextWeak }}>
      {prepared.line.length > 0 && <p style={{ color: COLOURS.leaf }}>{figurineLine(prepared.line)}</p>}
      <p>Your next games through this line will tell if the work pays.</p>
    </TaskDone>
  ) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`min-h-screen pb-24`} style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        {header}
        {done ? (
          <main className="px-4">{done}</main>
        ) : wide ? (
          <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-8 pt-5">
            {!task && (
              <div className="flex flex-wrap items-center gap-3">
                <SideSwitch side={side} onChange={(next) => !building && setSide(next)} counts={perSide} />
              </div>
            )}
            {/* Une seule géométrie : la carte garde sa largeur, le volet aussi, construction comprise. */}
            <div className="grid grid-cols-[minmax(0,1fr)_27rem] gap-5">
              <div className="sticky top-20 h-[calc(100vh-9rem)]">
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
            {!task && !building && (
              <div className="flex">
                <SideTabs side={side} onChange={setSide} counts={perSide} />
              </div>
            )}
            <div ref={pane} className="flex min-w-0 scroll-mt-3 flex-col gap-3">
              {pane$ ?? <PhonePane {...paneProps} trail={trail} onSelect={(key) => goTo(side, key, false)} />}
            </div>
          </main>
        )}
        {!wide && !building && !done && <BottomBar onStart={path.length ? () => walk([]) : undefined} onBack={path.length ? back : undefined} onForward={forward} onEnd={toEnd} />}
        <Toast toast={toast} onClose={close} />
      </div>
    </MotionConfig>
  );
}

const startsWith = (line: readonly string[], prefix: readonly string[]) => prefix.length <= line.length && prefix.every((san, index) => line[index] === san);

/** Le camp, en onglets serrés. */
function SideTabs({ side, onChange, counts }: { side: Side; onChange: (side: Side) => void; counts: Record<Side, number> }) {
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
          {counts[tab] > 0 && (
            <span className="rounded-full px-1.5 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }} title={`${counts[tab]} to settle`}>
              {counts[tab]}
            </span>
          )}
        </button>
      ))}
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

function useMaps(
  known: readonly PlayedGame[],
  day: string,
  repertoires: ReturnType<typeof useReplayedSession>['repertoires'],
  steps: readonly SessionStep[],
  createdAt: string,
  worked: readonly WorkedLine[],
) {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]): Record<Side, OpeningTree> => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    const recent = trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day)));
    // Les mêmes rangs que sur Home : les cinq à faire d'abord, puis les travaillées, qu'« Open » y amène encore.
    const { toWork, treated } = splitWorked(findPriorities(trees(known), recent, Infinity), worked, known, MAX_PRIORITIES);
    const priorities = [...toWork, ...treated];
    const toSettle: Record<Side, Map<string, number>> = { w: new Map(), b: new Map() };
    for (const step of steps) {
      const position = step.games[0].check.position;
      // Des décisions, pas des parties : la même unité que « N to settle ».
      toSettle[step.side].set(position, (toSettle[step.side].get(position) ?? 0) + 1);
    }
    const maps: Record<Side, MapNode> = {
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities, createdAt, freshSince: daysBefore(day, FRESH_DAYS) }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities, createdAt, freshSince: daysBefore(day, FRESH_DAYS) }),
    };
    return { maps, recent, priorities };
  }, [known, day, repertoires, steps, createdAt, worked]);
}

// Une ouverture faible se montre après la réponse qui coûte, mais reste la sienne sur son propre coup.
const showsOn = (priority: Priority, line: readonly string[]) => [priority.path, shownLine(priority)].some((shown) => shown.join(' ') === line.join(' '));

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
