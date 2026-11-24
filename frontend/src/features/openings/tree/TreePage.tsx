import { MotionConfig } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BuildSession } from '../checks/BuildSession';
import { originAt } from '../checks/useBuilder';
import type { AddedMove, Addition } from '../domain/addition';
import { figurineLine, figurineMove } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { canPractiseFrom } from '../domain/practice';
import { positionKey } from '../domain/repertoire';
import { replayLine } from '../position/replay';
import { useWorkedLines } from '../replay/useWorkedLines';
import { useReplayedSession } from '../session/useReplayedSession';
import { BottomBar } from '../workshop/BottomBar';
import { PageHeader } from '../workshop/PageHeader';
import { useV2Path } from '../workshop/routes';
import { SideSwitch } from '../workshop/SideSwitch';
import { storedSide } from '../workshop/storedSide';
import { TaskBar } from '../workshop/Task';
import { COLOURS, FONT_FAMILY } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWide } from '../workshop/useWide';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PhonePane } from './PhonePane';
import { PositionPane } from './PositionPane';
import { RepertoireMap } from './RepertoireMap';
import { findByPosition, nodeAlong } from './repertoireMap';
import { SideTabs } from './SideTabs';
import { CheckSummary, PreparedSummary } from './TaskSummaries';
import { useBuilding } from './useBuilding';
import { useCheckSession } from './useCheckSession';
import { useDayAnnouncements } from './useDayAnnouncements';
import { useRemovals } from './useRemovals';
import { useRepertoireMaps } from './useRepertoireMaps';
import { useTreeKeyboard } from './useTreeKeyboard';
import { useTreeWalk, type Lead } from './useTreeWalk';
import { useWeakTask } from './useWeakTask';
import { WeakWayBack } from './WeakWayBack';

/**
 * Le répertoire, et les deux tâches qui s'y font (docs/flow/target.html) : `?task=check` tranche les positions
 * une à une, `?task=weak&side=…&line=…` travaille une ouverture faible. Sans tâche, on parcourt et on étend.
 */
export function TreePage() {
  useWorkshopFont();
  const replayed = useReplayedSession();
  const { source, replay, known, repertoires, steps, add, remove, forgetIgnored, forgetAdditions } = replayed;
  const { worked, work, unwork } = useWorkedLines();
  const pathOf = useV2Path();
  // Openings envoie une ligne à travailler par l'adresse : /dev/tree?side=b&line=d4 Nf6.
  const [params, setParams] = useSearchParams();
  const asked = useMemo(
    () => ({ side: params.get('side') === 'b' ? 'b' : params.get('side') === 'w' ? 'w' : storedSide(), line: params.get('line')?.split(' ').filter(Boolean) ?? [] }) as { side: Side; line: string[] },
    [params],
  );
  const task = params.get('task') === 'check' ? 'check' : params.get('task') === 'weak' ? 'weak' : null;
  const wide = useWide();
  // Au téléphone, tout ce qui change la position remonte en haut : l'échiquier entier et la carte tiennent dans l'écran.
  const toTop = () => {
    if (!wide) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const { toast, show, close } = useToast();
  const [pinned, setPinned] = useState<readonly string[]>([]);
  const pin = useCallback((lines: readonly string[]) => setPinned((current) => [...current, ...lines]), []);

  const { maps, recent, priorities } = useRepertoireMaps(known, replay.day, repertoires, steps, source.start, worked);
  const walk = useTreeWalk(maps, asked);
  const { side, root, path, node } = walk;
  const { building, buildPath, build, follow, showLines, habits, shownPreview } = useBuilding({ walk, known, day: replay.day, toTop });
  const check = useCheckSession({ ...replayed, active: task === 'check', maps, walk, day: replay.day, show, pin, build, toTop });
  const { session, current } = check;
  const weak = useWeakTask({ active: task === 'weak', priorities, asked, walk, setParams, toTop });
  useTreeKeyboard(walk, !building);
  const nextDay = useDayAnnouncements({ ...replayed, live: check.live, show, close, pin });
  const reset =
    replay.reset &&
    (() => {
      replay.reset!();
      forgetIgnored();
      forgetAdditions();
      build(null);
    });
  const { stoppedActions, onRemove } = useRemovals({ ...replayed, walk, maps, today: replay.today, show, toTop });

  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  const priority = weak.onLine ? weak.priority : node.priority !== undefined ? priorities[node.priority - 1] : undefined;
  const priorityRank = weak.onLine ? weak.rank : node.priority;
  const perSide = { w: steps.filter((step) => step.side === 'w').length, b: steps.filter((step) => step.side === 'b').length };

  const accept = (moves: AddedMove[], lines: (readonly string[])[]) => {
    if (!building) return;
    const addition: Addition = { side: building.origin.side, addedAt: replay.day, moves };
    const target = building.worked ?? weak.workedBy(building.origin.side, lines);
    const worked = target && { ...target, since: replay.day };
    if (worked) work(worked);
    if (worked && task === 'weak') weak.setPrepared({ moves: moves.length, line: lines[0] ?? [] });
    pin(lines.map((line) => line.join(' ')));
    const text = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire`;
    const step = building.stepKey ? check.live.get(building.stepKey) : undefined;
    if (step) {
      check.settle(step, addition, text);
      return;
    }
    add(addition);
    build(null);
    // Une ligne qui retombe sur une position déjà dessinée y est rangée : on le dit, et la sélection y va.
    const line0 = lines[0];
    const landing = line0 && findByPosition(maps[building.origin.side], positionKey(replayLine(line0).fens[line0.length]));
    const transposed = landing && landing.key !== line0.join(' ') ? landing : undefined;
    // Dans la tâche, le bilan remplace la carte : annuler y revient.
    const inTask = worked !== undefined && task === 'weak';
    show({
      text: transposed && !inTask ? `${text} · same position as ${figurineLine(transposed.path)}: shown there, linked from here` : text,
      undo: () => {
        remove(addition);
        if (worked) unwork(worked);
        // Retour à la carte de la faiblesse : la ligne retirée n'a plus rien à montrer.
        if (inTask) weak.goTo(weak.rank);
      },
    });
    // La ligne ajoutée se voit tout de suite, même trop fine pour l'arrivée.
    const line = transposed ? transposed.path : lines[0];
    if (line) walk.reveal(building.origin.side, line);
  };

  const pane$ = building ? (
    <BuildSession
      key={`${building.origin.start.join(' ')} ${building.stepKey ?? ''} ${building.origin.keep}`}
      origin={building.origin}
      games={habits}
      repertoire={repertoires[building.origin.side]}
      onAccept={accept}
      onCancel={() => build(null)}
      onLines={showLines}
      onPath={follow}
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
    actions: check.actions,
    lead: session ? ('settle' as const) : walk.lead,
    onLead: (next: Lead) => {
      walk.setLead(next);
      toTop();
    },
    onSkip: session && current && stepsHere.includes(current) ? () => check.skip(current) : undefined,
    priorityRank,
    // Dans la tâche, la barre dit déjà « 2 of 5 ».
    priorityCount: task === 'weak' ? undefined : priorities.length,
    onNextPriority: weak.onLine ? weak.next : undefined,
    onExtend: () => build({ origin: originAt(side, node.path, path) }),
    stopped: stoppedActions,
    onRemove,
    // Une tâche a son but : on n'en sort pas par l'entraînement.
    practise: task || !canPractiseFrom(side, path.length) ? undefined : `${pathOf('practice')}?${new URLSearchParams({ side, line: path.join(' ') })}`,
    onPrepareFollows: priority
      ? (line: readonly string[]) => {
          const reached = nodeAlong(root, line);
          const after = figurineMove(line[line.length - 1], line.length);
          const heading = isPlayerMove(side, line.length + 1) ? `Prepare your moves after ${after}` : `Prepare against their replies after ${after}`;
          build({ origin: { ...originAt(side, line.slice(0, Math.min(reached.path.length, line.length)), line), heading }, worked: { side, path: priority.path } });
        }
      : undefined,
    onMove: walk.play,
    onJump: walk.walk,
    onBack: path.length ? walk.back : undefined,
  };
  const header =
    task === 'check' ? (
      <TaskBar title="Check" progress={check.over ? 'done' : session && current ? `${check.position} of ${session.queue.length} · as ${current.side === 'w' ? 'White' : 'Black'}` : undefined} />
    ) : task === 'weak' ? (
      <TaskBar title="Weak opening" progress={weak.prepared ? 'done' : priorities.length ? `${weak.rank} of ${priorities.length}` : undefined} />
    ) : (
      <PageHeader wide replay={{ ...replay, reset, next: nextDay }} />
    );
  const done = check.over ? (
    <CheckSummary started={session !== null} settled={check.settled} skipped={check.skipped} returned={session?.returned ?? 0} left={steps.length} />
  ) : weak.prepared !== null ? (
    <PreparedSummary moves={weak.prepared.moves} line={weak.prepared.line} onNext={weak.next} />
  ) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`min-h-screen pb-24`} style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        {header}
        {task === 'weak' && weak.priority && !weak.onLine && !building && !done && <WeakWayBack rank={weak.rank} onBack={() => weak.goTo(weak.rank)} onNext={weak.next} />}
        {done ? (
          <main className="px-4">{done}</main>
        ) : wide ? (
          <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-8 pt-5 min-[100rem]:max-w-[160rem]">
            {!task && (
              <div className="flex flex-wrap items-center gap-3">
                <SideSwitch side={side} onChange={(next) => !building && walk.setSide(next)} counts={perSide} />
              </div>
            )}
            {/* Une seule géométrie : la carte garde sa largeur, le volet aussi, construction comprise. Sur grand écran, le
                volet se partage (./split.ts) et prend la largeur de ses deux colonnes. */}
            <div className="grid grid-cols-[minmax(0,1fr)_27rem] gap-5 xl:grid-cols-[minmax(0,1fr)_30rem] min-[100rem]:grid-cols-[minmax(0,1fr)_auto]">
              <div className="sticky top-20 h-[calc(100vh-9rem)]">
                <RepertoireMap
                  root={root}
                  side={side}
                  selected={building && buildPath ? buildPath.join(' ') : node.key}
                  onSelect={(key) => walk.goTo(side, key, false)}
                  focus={walk.focus}
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
                <SideTabs side={side} onChange={walk.setSide} counts={perSide} />
              </div>
            )}
            <div className="flex min-w-0 scroll-mt-3 flex-col gap-3">
              {pane$ ?? <PhonePane {...paneProps} trail={walk.trail} onSelect={(key) => walk.goTo(side, key, false)} />}
            </div>
          </main>
        )}
        {!wide && !building && !done && (
          <BottomBar onStart={path.length ? () => walk.walk([]) : undefined} onBack={path.length ? walk.back : undefined} onForward={walk.forward} onEnd={walk.toEnd} />
        )}
        <Toast toast={toast} onClose={close} />
      </div>
    </MotionConfig>
  );
}
