import { describe, expect, it } from 'vitest';
import { replayLine } from '../position/replay';
import { diagnoseLine, followGame, gameFens, winChance, type Evaluation } from './diagnosis';
import { linePositions, studyLine } from './line';
import { buildOpeningTree, type OpeningTree } from './openingTree';
import { playerAverage } from './performance';
import type { PlayedGame } from './playedGame';

const games = (count: number, moves: string, score: PlayedGame['score']): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'w', moves: moves.split(' '), score, playedAt: '2026-01-01' }));

// Moyenne du joueur : 60 % ; la ligne 1.e4 e5 2.Nf3 : 20 % sur 10 parties.
const tree = buildOpeningTree([...games(2, 'e4 e5 Nf3', 1), ...games(8, 'e4 e5 Nf3', 0), ...games(10, 'd4 d5', 1)], 'w', 16);

function diagnose(path: string[], cps: number[], best: Record<number, string> = {}, onTree: OpeningTree = tree) {
  const line = studyLine(onTree, path);
  const fens = replayLine(line.steps.map((step) => step.san)).fens;
  const evaluations = new Map<string, Evaluation>(cps.map((cp, ply) => [fens[ply], { cp, best: best[ply] }]));
  return diagnoseLine({ positions: linePositions(onTree, line), steps: line.steps, entry: line.entry, average: playerAverage(onTree) }, onTree.side, evaluations, fens);
}

describe('diagnoseLine', () => {
  it('splits the points lost between the opening moves and what follows', () => {
    const { openingCost, playCost, costlyMoves } = diagnose(['e4', 'e5'], [0, 0, 0, 0]);

    expect(openingCost).toBeCloseTo(0);
    expect(playCost).toBeCloseTo(0.6 - 0.2);
    expect(costlyMoves).toEqual([]);
  });

  it('names a move of the player the engine finds costly, with the engine move', () => {
    const { openingCost, costlyMoves } = diagnose(['e4', 'e5'], [0, -150, -150, -150], { 0: 'd2d4' });

    expect(openingCost).toBeCloseTo(winChance(0) - winChance(-150));
    expect(costlyMoves).toEqual([{ ply: 1, san: 'e4', loss: expect.closeTo(winChance(0) - winChance(-150)), best: 'd4' }]);
  });

  it('takes as key position the one scored furthest below its worth, preferring the player to move', () => {
    const deeper = buildOpeningTree(
      [...games(10, 'e4 e5 Nf3 Nc6 Bb5', 1), ...games(10, 'e4 e5 Nf3 d6 d4', 0), ...games(10, 'd4 d5', 1)],
      'w',
      16,
    );

    // L'écart est un peu plus large après 3.d4, mais c'est après 2…d6 que le joueur a un choix.
    expect(diagnose(['e4', 'e5', 'Nf3', 'd6'], [0, 0, 0, 0, 0, 20], {}, deeper).key).toBe(4);
  });

  it('waits for every position of the line before weighing anything', () => {
    const { openingCost, playCost, complete } = diagnose(['e4', 'e5'], [0, 0]);

    expect(complete).toBe(false);
    expect(openingCost).toBeNull();
    expect(playCost).toBeNull();
  });
});

describe('followGame', () => {
  const moves = 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'.split(' ');
  const course = (cps: number[], best: Record<number, string> = {}) => {
    const fens = gameFens(moves, 2, cps.length - 1);
    const evaluations = new Map<string, Evaluation>(cps.map((cp, index) => [fens[index], { cp, best: best[index] }]));
    return followGame(moves, 2, fens, 'w', evaluations);
  };

  it('blames the move that drops the player chances the most, not the first slip', () => {
    // Positions depuis 2…e5 : 3.Nf3 glisse un peu, 5.Ng5 s'effondre.
    const { mistake } = course([0, -80, -80, -80, -80, -500, -500, -500], { 4: 'd2d3' });

    expect(mistake).toEqual({ ply: 7, san: 'Ng5', drop: expect.closeTo(winChance(-80) - winChance(-500)), best: 'd3' });
  });

  it('does not take a recapture for a mistake when the capture made the evaluation jump', () => {
    // Après la prise adverse, l'évaluation grimpe à tort ; la reprise du joueur la ramène où elle était.
    const { mistake } = course([0, 0, 0, 0, 400, 0, 0, 0, 0]);

    expect(mistake).toBeNull();
  });

  it('says nothing until the game is evaluated', () => {
    const fens = gameFens(moves, 2, 4);
    const { chances, mistake } = followGame(moves, 2, fens, 'w', new Map([[fens[0], { cp: 0 }]]));

    expect(chances.filter((chance) => chance === null)).toHaveLength(4);
    expect(mistake).toBeNull();
  });
});
