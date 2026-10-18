// PROTOTYPE — données partagées par les variantes de la vue de ligne. À jeter avec le dossier.
import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { movesAt, studyLine, type LineStep, type PlayedMove } from '../domain/line';
import { isPlayerMove, type OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame } from '../domain/playedGame';
import { playedGamesFixture } from '../fixtures/playedGames';

export interface Position {
  /** Demi-coups joués pour atteindre la position (0 = départ). */
  ply: number;
  path: readonly string[];
  /** Le coup de la ligne joué ici, absent en bout de ligne. */
  next?: LineStep;
  /** Score de la position, avant le coup suivant. */
  rate: number;
  games: number;
  playerToMove: boolean;
  moves: PlayedMove[];
  hidden: number;
}

export interface LineGame {
  game: PlayedGame;
  /** Demi-coups suivis sur la ligne prolongée avant d'en sortir. */
  followed: number;
}

export interface LineStudy {
  steps: LineStep[];
  entry: number;
  average: number;
  positions: Position[];
  /** Le demi-coup après lequel le score chute le plus, lissé sur le nombre de parties. */
  drop: number | null;
  games: LineGame[];
}

const SMOOTHING_GAMES = 12;
// Le seuil de 20 parties du flame graph éteint presque toute une ligne étudiée : le lissage suffit ici.
const MIN_TONED_GAMES = 5;

export function useLineStudy(tree: OpeningTree, path: readonly string[]): LineStudy {
  return useMemo(() => {
    const { steps, entry } = studyLine(tree, path);
    const average = playerAverage(tree);
    const positions: Position[] = [];
    for (let ply = 0; ply <= steps.length; ply++) {
      const here = steps.slice(0, ply).map((step) => step.san);
      const { shown, hidden } = movesAt(tree, here, steps[ply]?.san);
      positions.push({
        ply,
        path: here,
        next: steps[ply],
        rate: ply === 0 ? average : steps[ply - 1].rate,
        games: ply === 0 ? tree.root.games : steps[ply - 1].games,
        playerToMove: isPlayerMove(tree.side, ply + 1),
        moves: shown,
        hidden,
      });
    }
    return { steps, entry, average, positions, drop: biggestDrop(steps, average), games: gamesOn(tree, steps, entry) };
  }, [tree, path]);
}

function biggestDrop(steps: readonly LineStep[], average: number): number | null {
  let best: number | null = null;
  let bestDrop = 0.02;
  steps.forEach((step, index) => {
    const before = index === 0 ? average : steps[index - 1].rate;
    const drop = (before - step.rate) * (step.games / (step.games + SMOOTHING_GAMES));
    if (drop > bestDrop) {
      bestDrop = drop;
      best = step.ply;
    }
  });
  return best;
}

function gamesOn(tree: OpeningTree, steps: readonly LineStep[], entry: number): LineGame[] {
  const recent = gamesOfLastMonths(playedGamesFixture, 12, new Date());
  return recent
    .filter((game) => game.side === tree.side && steps.slice(0, entry).every((step, index) => game.moves[index] === step.san))
    .map((game) => {
      let followed = entry;
      while (followed < steps.length && game.moves[followed] === steps[followed].san) followed++;
      return { game, followed };
    })
    .sort((a, b) => b.game.playedAt.localeCompare(a.game.playedAt));
}

export type Tone = 'losing' | 'slipping' | 'even' | 'winning';

export function toneOf(rate: number, games: number, average: number): Tone {
  if (games < MIN_TONED_GAMES) return 'even';
  const gap = (average - rate) * (games / (games + SMOOTHING_GAMES));
  if (gap >= 0.1) return 'losing';
  if (gap >= 0.05) return 'slipping';
  if (gap <= -0.05) return 'winning';
  return 'even';
}

export interface Arrow {
  from: string;
  to: string;
}

export function arrowsAt(path: readonly string[], sans: readonly string[]): Arrow[] {
  const chess = new Chess();
  for (const san of path) chess.move(san);
  return sans.map((san) => {
    const { from, to } = chess.move(san);
    chess.undo();
    return { from, to };
  });
}
