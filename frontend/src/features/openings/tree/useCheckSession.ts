import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { originOf } from '../checks/useBuilder';
import type { Addition } from '../domain/addition';
import { figurineMove } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import { checkQueue, recallOf, type RecallVerdict, type SessionStep } from '../session/steps';
import type { ToastMessage } from '../workshop/useToast';
import type { StepActions } from './PositionPane';
import { findByPosition, type MapNode } from './repertoireMap';
import type { Building } from './useBuilding';
import type { TreeWalk } from './useTreeWalk';

/** En séance, avant de montrer le répertoire : le joueur cherche d'abord le coup qu'il avait préparé. */
export interface Recall {
  asking: boolean;
  /** Le coup qu'il a joué en cherchant ; absent s'il a demandé la réponse. */
  tried?: { san: string; verdict: RecallVerdict };
  onTry: (san: string) => void;
  onReveal: () => void;
}

interface Session {
  /** Les étapes connues à l'ouverture : un ajout peut en régler d'autres en route. */
  queue: readonly string[];
  /** Par étape traitée : réglée, ou remise à plus tard. */
  done: ReadonlyMap<string, 'settled' | 'skipped'>;
  /** Parties revenues à trancher parce que le joueur y a choisi un autre coup. */
  returned?: number;
}

/**
 * La tâche Check (`?task=check`) et ce qui règle une position à trancher, en séance ou non : la séance part d'elle-même
 * une fois les écarts jugés, va de position en position et compte ce qui est réglé ou remis à plus tard.
 */
export function useCheckSession({
  active,
  steps,
  judging,
  maps,
  walk,
  day,
  show,
  add,
  remove,
  ignore,
  unignore,
  pin,
  build,
  toTop,
}: {
  active: boolean;
  steps: readonly SessionStep[];
  judging: boolean;
  maps: Record<Side, MapNode>;
  walk: TreeWalk;
  day: string;
  show: (message: ToastMessage) => void;
  add: (addition: Addition) => void;
  remove: (addition: Addition) => void;
  ignore: (id: number) => void;
  unignore: (ids: readonly number[]) => void;
  pin: (lines: readonly string[]) => void;
  build: (next: Building | null) => void;
  toTop: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  // La séance : les positions à trancher, la plus fréquente d'abord, une par une.
  const live = useMemo(() => new Map(steps.map((step) => [step.key, step])), [steps]);
  const currentKey = session?.queue.find((key) => !session.done.has(key) && live.has(key));
  const current = currentKey ? live.get(currentKey) : undefined;
  const follow = useEffectEvent((key: string) => {
    const step = live.get(key)!;
    const target = findByPosition(maps[step.side], step.games[0].check.position);
    if (target) walk.goTo(step.side, target.key, true);
  });
  useEffect(() => {
    if (currentKey) follow(currentKey);
  }, [currentKey]);
  const mark = (key: string, how: 'settled' | 'skipped' | null) =>
    setSession((active) => {
      if (!active) return active;
      const done = new Map(active.done);
      if (how) done.set(key, how);
      else done.delete(key);
      return { ...active, done };
    });

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
  }, [steps, show]);

  const started = useRef(false);
  const start = useEffectEvent(() => {
    setSession({ queue: checkQueue(steps, walk.side).map((step) => step.key), done: new Map() });
    build(null);
    toTop();
  });
  useEffect(() => {
    // Les écarts n'apparaissent qu'une fois jugés : la séance attend le moteur.
    if (!active || started.current || judging || !steps.length) return;
    started.current = true;
    start();
  }, [active, judging, steps.length]);

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
  const skip = (step: SessionStep) => {
    mark(step.key, 'skipped');
    show({ text: 'Skipped for this session', undo: () => mark(step.key, null) });
  };
  const actions: StepActions = {
    onAdd: (step) => {
      const played = figurineMove(step.played, step.path.length + 1);
      const addition: Addition = { side: step.side, addedAt: day, moves: [{ position: step.games[0].check.position, san: step.played, source: 'habit' }] };
      pin([[...step.path, step.played].join(' ')]);
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

  // Une fois par position : un deuxième écart au même endroit montre la réponse déjà cherchée.
  const [recalled, setRecalled] = useState<ReadonlyMap<string, string | null>>(new Map());
  const recallKey = current?.kind === 'left' ? `${current.side} ${current.games[0].check.position}` : undefined;
  const tried = recallKey ? recalled.get(recallKey) : undefined;
  const answer = (san: string | null) => recallKey && setRecalled((known) => new Map(known).set(recallKey, san));
  const recall: Recall | undefined =
    current && recallKey
      ? {
          asking: !recalled.has(recallKey),
          tried: tried ? { san: tried, verdict: recallOf(current, tried) } : undefined,
          onTry: answer,
          onReveal: () => answer(null),
        }
      : undefined;

  const position = session ? session.queue.indexOf(currentKey ?? '') + 1 : 0;
  const counts = session ? [...session.done.values()] : [];
  return {
    session,
    current,
    live,
    actions,
    recall,
    settle,
    skip,
    position,
    settled: counts.filter((how) => how === 'settled').length,
    skipped: counts.filter((how) => how === 'skipped').length,
    over: active && !judging && (session ? !current : !steps.length),
  };
}
