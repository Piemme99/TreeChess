// PROTOTYPE — préparation prolongée au-delà des parties du joueur : ses habitudes là où il en a,
// sinon le coup le plus joué à son niveau que le moteur valide ; les réponses adverses fréquentes
// à son niveau. À jeter avec le dossier.
import { Chess } from 'chess.js';
import type { PlayedGame, Side } from '../domain/playedGame';
import { sanOf, winChance } from './diagnosis';
import type { Evaluation } from './engine';
import { total, type ExplorerResult } from './explorer';

export type PlanSource = 'habit' | 'level' | 'engine';

export interface PlanMove {
  san: string;
  ply: number;
  byPlayer: boolean;
  /** Part des parties à ce niveau qui prennent ce coup, depuis la position précédente. */
  share: number | null;
  /** Parties du joueur passées par ce coup. */
  mine: number;
  source: PlanSource | null;
  /** L'habitude du joueur que le moteur écarte ici, et ce qu'elle coûte. */
  dropped: { san: string; loss: number } | null;
  next: PlanMove[];
}

export interface PlanDeps {
  explore: (fen: string) => Promise<ExplorerResult | null>;
  evaluate: (fen: string) => Promise<Evaluation>;
  cancelled: () => boolean;
  onProgress: (steps: number) => void;
}

const PLIES = 12;
const MIN_HABIT_GAMES = 2;
const MIN_SHARE = 0.15;
const MAX_REPLIES = 3;
// Une branche que moins de 8 % des parties à ce niveau atteignent ne vaut pas d'être apprise.
const MIN_REACH = 0.08;
const MIN_SAMPLE = 50;
const CANDIDATES = 3;
// Même seuil que « remplacée seulement là où le moteur la juge mauvaise » (préparation proposée, CONTEXT.md).
const LOSS = 0.05;

export async function planPreparation(keyPath: readonly string[], side: Side, games: readonly PlayedGame[], deps: PlanDeps): Promise<PlanMove[]> {
  const pov = (cp: number) => winChance(side === 'w' ? cp : -cp);
  let steps = 0;

  const grow = async (path: readonly string[], reach: number, reaching: readonly PlayedGame[]): Promise<PlanMove[]> => {
    if (deps.cancelled() || path.length - keyPath.length >= PLIES) return [];
    const chess = new Chess();
    path.forEach((san) => chess.move(san));
    const fen = chess.fen();
    const ply = path.length;
    const byPlayer = (ply % 2 === 0) === (side === 'w');
    const mine = countMoves(reaching, ply);
    const explorer = await deps.explore(fen);
    deps.onProgress(++steps);
    if (!explorer || total(explorer) < MIN_SAMPLE) return [];
    const shareOf = (san: string) => {
      const move = explorer.moves.find((candidate) => candidate.san === san);
      return move ? total(move) / total(explorer) : 0;
    };
    const follow = (san: string) => reaching.filter((game) => game.moves[ply] === san);

    if (!byPlayer) {
      const replies = explorer.moves
        .slice(0, MAX_REPLIES)
        .map((move) => move.san)
        .filter((san) => shareOf(san) >= MIN_SHARE && reach * shareOf(san) >= MIN_REACH);
      for (const [san, count] of mine) if (count >= MIN_HABIT_GAMES && !replies.includes(san)) replies.push(san);
      const moves: PlanMove[] = [];
      for (const san of replies) {
        const share = shareOf(san);
        // Une réponse que le joueur rencontre lui-même compte, même rare à son niveau.
        const next = await grow([...path, san], reach * Math.max(share, MIN_REACH), follow(san));
        moves.push({ san, ply: ply + 1, byPlayer, share, mine: mine.get(san) ?? 0, source: null, dropped: null, next });
      }
      return moves;
    }

    const before = await deps.evaluate(fen);
    const lossOf = async (san: string) => {
      chess.move(san);
      const after = await deps.evaluate(chess.fen());
      chess.undo();
      return pov(before.cp) - pov(after.cp);
    };

    let pick: { san: string; source: PlanSource } | null = null;
    let dropped: PlanMove['dropped'] = null;
    const habit = [...mine.entries()].sort((a, b) => b[1] - a[1]).find(([, count]) => count >= MIN_HABIT_GAMES)?.[0];
    if (habit) {
      const loss = await lossOf(habit);
      if (loss < LOSS) pick = { san: habit, source: 'habit' };
      else dropped = { san: habit, loss };
    }
    for (const move of pick ? [] : explorer.moves.slice(0, CANDIDATES)) {
      if (move.san === dropped?.san) continue;
      if ((await lossOf(move.san)) < LOSS) {
        pick = { san: move.san, source: 'level' };
        break;
      }
    }
    if (!pick) {
      const best = sanOf(fen, before.best);
      if (!best) return [];
      pick = { san: best, source: 'engine' };
    }
    const next = await grow([...path, pick.san], reach, follow(pick.san));
    return [{ san: pick.san, ply: ply + 1, byPlayer, share: shareOf(pick.san), mine: mine.get(pick.san) ?? 0, source: pick.source, dropped, next }];
  };

  return grow(keyPath, 1, games.filter((game) => keyPath.every((san, index) => game.moves[index] === san)));
}

function countMoves(games: readonly PlayedGame[], ply: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of games) {
    const san = game.moves[ply];
    if (san) counts.set(san, (counts.get(san) ?? 0) + 1);
  }
  return counts;
}

export function planDepth(moves: readonly PlanMove[]): number {
  return moves.reduce((deepest, move) => Math.max(deepest, move.ply, planDepth(move.next)), 0);
}

export function countDropped(moves: readonly PlanMove[]): number {
  return moves.reduce((sum, move) => sum + (move.dropped ? 1 : 0) + countDropped(move.next), 0);
}
