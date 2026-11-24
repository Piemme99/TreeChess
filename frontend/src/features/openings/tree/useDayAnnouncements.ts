import { useEffect, useEffectEvent, useRef } from 'react';
import { figurineMove } from '../domain/notation';
import type { SessionStep } from '../session/steps';
import type { useReplayedSession } from '../session/useReplayedSession';
import type { ToastMessage } from '../workshop/useToast';

type Replayed = ReturnType<typeof useReplayedSession>;

/**
 * « Next day » du rejeu, et le message qui l'annonce : les parties du jour, les décisions nouvelles ou expirées, et les
 * coups entrés seuls au répertoire, qui se disent aussi hors du changement de jour.
 */
export function useDayAnnouncements({
  replay,
  steps,
  live,
  adoptions,
  judging,
  remove,
  ignore,
  show,
  close,
  pin,
}: Pick<Replayed, 'replay' | 'adoptions' | 'judging' | 'remove' | 'ignore'> & {
  steps: readonly SessionStep[];
  live: ReadonlyMap<string, SessionStep>;
  show: (message: ToastMessage) => void;
  close: () => void;
  pin: (lines: readonly string[]) => void;
}) {
  const before = useRef<ReadonlySet<string> | null>(null);
  const nextDay = () => {
    close();
    before.current = new Set(steps.map((step) => step.key));
    replay.next!();
  };
  const announced = useRef(new Set<string>());
  // Le changement de jour et les coups entrés seuls au répertoire se disent dans le même message.
  const announce = useEffectEvent(() => {
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
      pin(fresh.map(({ step }) => [...step.path, step.played].join(' ')));
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
  });
  // Seuls le changement de jour, la fin du jugement et une adoption comptent ; `steps` est recalculé dans le même rendu.
  useEffect(() => announce(), [replay.day, judging, adoptions]);

  return replay.next && nextDay;
}
