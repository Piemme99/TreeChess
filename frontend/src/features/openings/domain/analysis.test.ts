import { describe, expect, it } from 'vitest';
import { replayLine } from '../position/replay';
import { judgeGame } from './analysis';
import type { Evaluation } from './diagnosis';

// La partie d'entraînement de PMG, Philidor : 1.e4 e5 2.Nf3 d6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Be7 6.Bf4 O-O 7.Be2 a6 8.f3 b5 9.Qd3
const path = ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7', 'Bf4', 'O-O', 'Be2', 'a6', 'f3', 'b5', 'Qd3'];
const { fens } = replayLine(path);

/** Toutes les positions à +0.3 sauf celles données, par demi-coup joué : 0 est la position de départ. */
const evaluate = (byPly: Record<number, Evaluation>) => new Map(fens.map((fen, ply) => [fen, byPly[ply] ?? { cp: 30 }]));

describe('judgeGame', () => {
  it("a move of the player's that throws away a tenth of their winning chances is a mistake, and the engine's move is named", () => {
    // Avant 8.f3 : +0.4 avec 8.Qd2 ; après : −1.2.
    const verdicts = judgeGame(path, fens, 'w', evaluate({ 14: { cp: 40, best: 'd1d2' }, 15: { cp: -120 } }));
    expect(verdicts.get(14)).toEqual({ judgement: 'mistake', better: 'Qd2' });
  });

  it("the engine's own move is never faulted, even when the next position evaluates lower", () => {
    const verdicts = judgeGame(path, fens, 'w', evaluate({ 8: { cp: 50, best: 'b1c3' }, 9: { cp: -30 } }));
    expect(verdicts.get(8)).toEqual({ judgement: null, better: null });
  });

  it("only the player's moves are judged: the opponent's are what players of their level play", () => {
    expect([...judgeGame(path, fens, 'w', evaluate({})).keys()]).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16]);
    expect([...judgeGame(path, fens, 'b', evaluate({})).keys()]).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
  });

  it('practising from a position of the tree, the moves already on the board are not judged: the player did not play them', () => {
    expect([...judgeGame(path, fens, 'w', evaluate({}), 8).keys()]).toEqual([8, 10, 12, 14, 16]);
  });

  it("as Black, a move that hands White the advantage is Black's mistake", () => {
    // Avant 7…a6 : +0.3 avec 7…Be6 ; après : +1.5 pour les Blancs.
    const verdicts = judgeGame(path, fens, 'b', evaluate({ 13: { cp: 30, best: 'c8e6' }, 14: { cp: 150 } }));
    expect(verdicts.get(13)).toEqual({ judgement: 'mistake', better: 'Be6' });
  });

  it('a move the engine has not judged yet is left out, not passed as sound', () => {
    const known = evaluate({});
    known.delete(fens[15]);
    expect(judgeGame(path, fens, 'w', known).has(14)).toBe(false);
  });
});
