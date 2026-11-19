import { describe, expect, it } from 'vitest';
import { departureMark, lapseOf, opponentTurn, practiceStep, reviewStart, startingLine } from './practice';
import type { GameCheck } from './gameCheck';
import type { ExplorerStats } from './preparation';

const move = (san: string, games: number) => ({ san, white: games, draws: 0, black: 0 });

const position = (...moves: ReturnType<typeof move>[]): ExplorerStats => {
  const games = moves.reduce((sum, { white }) => sum + white, 0);
  return { white: games, draws: 0, black: 0, moves };
};

// Après 1.e4 e5 2.Nf3, à 1400–2000 : Nc6 dans 60 % des parties, d6 dans 36 %, f5 dans 4 %.
const afterNf3 = position(move('Nc6', 6000), move('d6', 3600), move('f5', 400));

describe('opponentTurn', () => {
  it("the opponent's reply comes as often as players of the player's level play it", () => {
    // Nc6 et d6 se partagent le tirage, 6000 contre 3600 : Nc6 jusqu'à 62,5 %, d6 au-delà.
    expect(opponentTurn(afterNf3, 3, 0.62).reply).toBe('Nc6');
    expect(opponentTurn(afterNf3, 3, 0.63).reply).toBe('d6');
  });

  it("a reply played in under 5 % of the games at the player's level never comes", () => {
    expect(opponentTurn(afterNf3, 3, 0.999).reply).toBe('d6');
  });

  it("the game stops where fewer than 100 games reached the position at the player's level", () => {
    expect(opponentTurn(position(move('Bc5', 60), move('Nf6', 30)), 5, 0)).toEqual({ reply: null, end: 'rare' });
    // La réponse tirée mène à une position trop rare : elle est jouée, puis la partie s'arrête.
    expect(opponentTurn(position(move('Nc6', 900), move('Bxf2+', 90)), 7, 0.95)).toEqual({ reply: 'Bxf2+', end: 'rare' });
  });

  it('the game stops once move 15 is played', () => {
    expect(opponentTurn(afterNf3, 29, 0)).toEqual({ reply: 'Nc6', end: 'move-15' });
    expect(opponentTurn(afterNf3, 30, 0)).toEqual({ reply: null, end: 'move-15' });
  });
});

describe('reviewStart', () => {
  it('the review opens on the first move the repertoire did not plan, whether the player or the opponent played it', () => {
    expect(reviewStart({ kind: 'left', ply: 2, played: 'Nf3', planned: ['d4'], position: '' }, 20)).toBe(3);
    expect(reviewStart({ kind: 'uncovered', ply: 5, played: 'Bc5', planned: ['Nf6'], position: '' }, 20)).toBe(6);
  });

  it('a game that outlived the preparation opens on its first move past it, not on its last position', () => {
    expect(reviewStart({ kind: 'followed', plies: 4 }, 30)).toBe(5);
    expect(reviewStart({ kind: 'followed', plies: 12 }, 12)).toBe(12);
  });
});

describe('departureMark', () => {
  it('an opponent reply off the repertoire asks for an answer the first time it is met in practice', () => {
    expect(departureMark('uncovered', null)).toBe('?');
  });

  it("a move of the player's off the repertoire is a mistake only when the engine finds it worse", () => {
    expect(departureMark('left', 'mistake')).toBe('!');
    expect(departureMark('left', null)).toBe('·');
  });

  it('without an engine, a move off the repertoire is flagged rather than passed over', () => {
    expect(departureMark('left', 'blind')).toBe('!');
  });
});

describe('practiceStep', () => {
  // La partie de PMG : sa préparation s'arrête après 4.Nxd4 ; 4…Nf6 arrive au-delà.
  const philidor = ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7'];

  it('an opponent reply past the end of the preparation asks for an answer, like one off it', () => {
    expect(practiceStep({ kind: 'followed', plies: 7 }, philidor, 'w')).toMatchObject({ kind: 'uncovered', ply: 7, played: 'Nf6' });
  });

  it("a move of the player's past the end of the preparation is a new move, not a missed one", () => {
    const step = practiceStep({ kind: 'followed', plies: 8 }, philidor, 'w');
    expect(step).toMatchObject({ kind: 'past', ply: 8, played: 'Nc3' });
    expect(lapseOf(step)).toBeNull();
  });

  it('a game that followed the preparation to its last move leaves nothing to settle', () => {
    expect(practiceStep({ kind: 'followed', plies: 10 }, philidor, 'w')).toBeNull();
  });

  it('a repertoire move missed in practice comes back in Review; an opponent reply off the repertoire does not', () => {
    const left: GameCheck = { kind: 'left', ply: 2, played: 'Bc4', planned: ['Nf3'], position: 'after 1.e4 e5' };
    expect(lapseOf(practiceStep(left, philidor, 'w'))).toBe('after 1.e4 e5');
    expect(lapseOf(practiceStep({ kind: 'uncovered', ply: 3, played: 'f5', planned: ['Nc6'], position: 'after 2.Nf3' }, philidor, 'w'))).toBeNull();
  });

  it('practising from an off-repertoire position of the tree, the move already on the board is not a lapse', () => {
    const left: GameCheck = { kind: 'left', ply: 2, played: 'Bc4', planned: ['Nf3'], position: 'after 1.e4 e5' };
    expect(lapseOf(practiceStep(left, philidor, 'w'), 3)).toBeNull();
  });
});

describe('startingLine', () => {
  it('a line from the address is cut at its first illegal move', () => {
    // 2…Ke6 : le roi ne fait qu'un pas.
    expect(startingLine('e4 e5 Nf3 Ke6 Nc3')).toEqual(['e4', 'e5', 'Nf3']);
    expect(startingLine(null)).toEqual([]);
  });

  it('a line from the address never starts the game past move 15', () => {
    const shuffle = Array.from({ length: 10 }, () => 'Nf3 Nf6 Ng1 Ng8').join(' ');
    expect(startingLine(shuffle)).toHaveLength(30);
  });
});
