import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CheckedGame } from '../checks/checkedGame';
import { buildOpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import type { Repertoire } from '../domain/repertoire';
import { answered, dueCount, seededState, withLapses, type ReviewCard, type ReviewState } from '../domain/review';
import { REPLAY_START } from '../replay/replaySetup';

const STORAGE = 'kumquat.v2.review';
const HABIT_MONTHS = 12;
// Une position manquée en partie passe devant ; un ajout récent devant le reste.
const LAPSE_WEIGHT = 10;
const ADDITION_WEIGHT = 3;

type Stored = Record<Side, [string, ReviewCard][]>;

const read = (): Record<Side, ReviewState> | null => {
  const stored = localStorage.getItem(STORAGE);
  if (!stored) return null;
  const parsed = JSON.parse(stored) as Stored;
  return { w: new Map(parsed.w), b: new Map(parsed.b) };
};

/** La révision du répertoire : semée à sa création d'après les habitudes, puis tenue à jour réponse après réponse. */
export function useReview(games: readonly PlayedGame[], repertoires: Record<Side, Repertoire>, lived: readonly CheckedGame[], today: string) {
  const [stored, setStored] = useState<Record<Side, ReviewState>>(() => read() ?? seed(games, repertoires));
  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify({ w: [...stored.w], b: [...stored.b] } satisfies Stored)), [stored]);

  const lapses = useMemo(() => {
    const found: Record<Side, Map<string, string>> = { w: new Map(), b: new Map() };
    for (const { game, check } of lived) if (check.kind === 'left') found[game.side].set(check.position, game.playedAt);
    return found;
  }, [lived]);
  const state = useMemo(() => ({ w: withLapses(stored.w, lapses.w), b: withLapses(stored.b, lapses.b) }), [stored, lapses]);
  const due = useMemo(() => ({ w: dueCount(repertoires.w, state.w, today), b: dueCount(repertoires.b, state.b, today) }), [repertoires, state, today]);
  const weight = useCallback(
    (side: Side) => (key: string) => {
      if (lapses[side].has(key)) return LAPSE_WEIGHT;
      return repertoires[side].moves.get(key)?.some((move) => move.addedAt > REPLAY_START) ? ADDITION_WEIGHT : 1;
    },
    [lapses, repertoires],
  );

  return {
    state,
    due,
    weight,
    answer: (side: Side, key: string, right: boolean) =>
      // Répondre à une position rattrapée par un oubli en partie part de l'état qui en tient compte.
      setStored((current) => ({ ...current, [side]: answered(withLapses(current[side], lapses[side]), key, right, today) })),
    forget: () => setStored(seed(games, repertoires)),
  };
}

function seed(games: readonly PlayedGame[], repertoires: Record<Side, Repertoire>): Record<Side, ReviewState> {
  const habits = gamesOfLastMonths(games, HABIT_MONTHS, new Date(REPLAY_START)).filter((game) => game.playedAt < REPLAY_START);
  return {
    w: seededState(repertoires.w, buildOpeningTree(habits, 'w', 40), REPLAY_START),
    b: seededState(repertoires.b, buildOpeningTree(habits, 'b', 40), REPLAY_START),
  };
}
