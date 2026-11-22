import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { positionKey, type Repertoire, type RepertoireMove } from './repertoire';
import { buildOpeningTree } from './openingTree';
import type { PlayedGame } from './playedGame';
import { acceptedMoves, answered, dueCount, hasDueAhead, isDue, mastery, missedInPractice, nextReply, planLine, playerPositions, seededState, sessionDone, sessionPositions, withLapses, type ReviewState } from './review';

const TODAY = '2026-03-01';

const fenAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
};

const repertoireOf = (side: Repertoire['side'], lines: Record<string, string[]>): Repertoire => ({
  side,
  moves: new Map(Object.entries(lines).map(([moves, sans]) => [positionKey(fenAfter(moves)), sans.map((san): RepertoireMove => ({ san, source: 'habit', addedAt: '2026-01-01' }))])),
});

// Blancs : 1.e4, contre 1…e5 2.♘f3, contre 1…c5 2.♘f3 ou 2.c3.
const white = repertoireOf('w', { '': ['e4'], e4: ['e5', 'c5'], 'e4 e5': ['Nf3'], 'e4 c5': ['Nf3', 'c3'] });
const key = (moves: string) => positionKey(fenAfter(moves));

describe('review', () => {
  it('lists the positions where the player has a move, once each', () => {
    expect(playerPositions(white).map((position) => position.key)).toEqual([key(''), key('e4 e5'), key('e4 c5')]);
  });

  it('counts every position never reviewed as due', () => {
    expect(dueCount(white, new Map(), TODAY)).toBe(3);
  });

  it('sends a right answer further at each step, a wrong one back to tomorrow', () => {
    let state: ReviewState = answered(new Map(), key(''), true, TODAY);
    expect(state.get(key(''))).toEqual({ box: 1, due: '2026-03-02', reviewedAt: TODAY });
    state = answered(state, key(''), true, '2026-03-02');
    expect(state.get(key(''))).toEqual({ box: 2, due: '2026-03-09', reviewedAt: '2026-03-02' });
    state = answered(state, key(''), false, '2026-03-09');
    expect(state.get(key(''))).toEqual({ box: 1, due: '2026-03-10', reviewedAt: '2026-03-09', missed: true });
    expect(isDue(state, key(''), '2026-03-09')).toBe(false);
  });

  it('leaves a position that was not due alone when it is answered right', () => {
    const state = answered(new Map(), key(''), true, TODAY);

    expect(answered(state, key(''), true, TODAY)).toBe(state);
    expect(answered(state, key(''), false, TODAY).get(key(''))?.box).toBe(1);
  });

  it('accepts any repertoire move of the player', () => {
    expect(acceptedMoves(white, fenAfter('e4 c5'))).toEqual(['Nf3', 'c3']);
  });

  it('answers with the reply that leads to the positions still due', () => {
    const state = answered(answered(new Map(), key(''), true, TODAY), key('e4 e5'), true, TODAY);

    expect(nextReply(white, fenAfter('e4'), state, TODAY)).toBe('c5');
  });

  it('weighs a position missed in a game above the others', () => {
    const missed = key('e4 e5');

    expect(nextReply(white, fenAfter('e4'), new Map(), TODAY, (k) => (k === missed ? 10 : 1))).toBe('e5');
  });

  it('ends the line once nothing ahead is due', () => {
    const state = [key(''), key('e4 e5'), key('e4 c5')].reduce<ReviewState>((known, k) => answered(known, k, true, TODAY), new Map());

    expect(nextReply(white, fenAfter('e4'), state, TODAY)).toBeUndefined();
    expect(hasDueAhead(white, fenAfter(''), state, TODAY)).toBe(false);
    expect(hasDueAhead(white, fenAfter(''), state, '2026-03-02')).toBe(true);
  });

  it('starts the moves the player always plays in the last box, the others due', () => {
    const games = (count: number, moves: string): PlayedGame[] => Array.from({ length: count }, () => ({ side: 'w', moves: moves.split(' '), score: 1, playedAt: '2025-06-01' }));
    const habits = buildOpeningTree([...games(30, 'e4 e5 Nf3'), ...games(6, 'e4 c5 Nf3'), ...games(6, 'e4 c5 c3')], 'w', 10);
    const state = seededState(white, habits, TODAY);

    expect(isDue(state, key(''), TODAY)).toBe(false);
    expect(isDue(state, key('e4 e5'), TODAY)).toBe(false);
    // 12 parties, partagées entre deux coups prévus : le joueur y joue toujours un coup du répertoire.
    expect(isDue(state, key('e4 c5'), TODAY)).toBe(false);
    expect(seededState(white, buildOpeningTree(games(5, 'e4 e5 Nf3'), 'w', 10), TODAY).size).toBe(0);
  });

  it('brings back a position missed in a game after its last review', () => {
    const state = answered(new Map(), key('e4 e5'), true, TODAY);

    expect(isDue(withLapses(state, new Map([[key('e4 e5'), '2026-03-01']])), key('e4 e5'), TODAY)).toBe(false);
    expect(isDue(withLapses(state, new Map([[key('e4 e5'), '2026-03-02']])), key('e4 e5'), '2026-03-02')).toBe(true);
  });

  it("a repertoire move missed in practice is back in that day's review, from box 1, even when it was a month away", () => {
    const known: ReviewState = new Map([[key('e4 e5'), { box: 3, due: '2026-03-31', reviewedAt: TODAY }]]);
    const missed = missedInPractice(known, key('e4 e5'), '2026-03-02');
    expect(isDue(missed, key('e4 e5'), '2026-03-02')).toBe(true);
    expect(missed.get(key('e4 e5'))?.box).toBe(1);
    expect(mastery(white, missed, '2026-03-02').known).toBe(0);
  });

  it('plays the line alone up to the two last moves of the player before the position due', () => {
    const deep = repertoireOf('w', { '': ['e4'], e4: ['e5'], 'e4 e5': ['Nf3'], 'e4 e5 Nf3': ['Nc6'], 'e4 e5 Nf3 Nc6': ['Bb5'], 'e4 e5 Nf3 Nc6 Bb5': ['a6'], 'e4 e5 Nf3 Nc6 Bb5 a6': ['Ba4'] });
    const state = [key(''), key('e4 e5'), key('e4 e5 Nf3 Nc6')].reduce<ReviewState>((known, k) => answered(known, k, true, TODAY), new Map());

    expect(planLine(deep, state, TODAY)).toMatchObject({ target: key('e4 e5 Nf3 Nc6 Bb5 a6'), autoplayed: ['e4', 'e5'] });
    expect(planLine(white, new Map(), TODAY, (k) => (k === key('e4 c5') ? 5 : 1))).toMatchObject({ target: key('e4 c5'), autoplayed: [] });
  });

  it('knows the repertoire fully once every position was answered right three times, at its intervals', () => {
    let state: ReviewState = new Map();
    for (const day of [TODAY, '2026-03-02', '2026-03-09']) for (const { key } of playerPositions(white)) state = answered(state, key, true, day);

    expect(mastery(white, state, '2026-03-09')).toEqual({ known: 3, positions: 3 });
  });

  it('counts a position never reviewed or last missed as unknown, and one answered right once as a third known', () => {
    const missed = answered(new Map(), key(''), false, TODAY);
    expect(mastery(white, missed, TODAY).known).toBe(0);
    expect(mastery(white, answered(new Map(), key(''), true, TODAY), TODAY).known).toBeCloseTo(1 / 3);
  });

  it('counts a position missed in a game after its last review as unknown', () => {
    const state: ReviewState = new Map([[key(''), { box: 3, due: '2026-04-01', reviewedAt: TODAY }]]);

    expect(mastery(white, withLapses(state, new Map([[key(''), '2026-03-05']])), '2026-03-05').known).toBe(0);
  });

  it('takes a level off a position while its review is overdue, until it is answered right again', () => {
    const state: ReviewState = new Map([[key(''), { box: 3, due: '2026-04-01', reviewedAt: TODAY }]]);

    expect(mastery(white, state, '2026-04-01').known).toBe(1);
    expect(mastery(white, state, '2026-04-02').known).toBeCloseTo(2 / 3);
    expect(mastery(white, answered(state, key(''), true, '2026-04-02'), '2026-04-02').known).toBe(1);
  });

  it('reviews 15 due positions a session, or all of them when fewer are due', () => {
    expect(sessionPositions(118)).toBe(15);
    expect(sessionPositions(6)).toBe(6);
  });

  it('ends the session at the end of the line where its last due position was answered, never in the middle of a line', () => {
    expect(sessionDone(15, 15, false)).toBe(false);
    expect(sessionDone(14, 15, true)).toBe(false);
    expect(sessionDone(16, 15, true)).toBe(true);
  });

  it('starts a line that begins like one already played in the session where it leaves it', () => {
    const sicilian = repertoireOf('b', { '': ['e4'], e4: ['c5'], 'e4 c5': ['Nf3', 'c3'], 'e4 c5 Nf3': ['Nc6'], 'e4 c5 c3': ['Nf6'] });
    const state = [key('e4'), key('e4 c5 Nf3')].reduce<ReviewState>((known, k) => answered(known, k, true, TODAY), new Map());

    expect(planLine(sicilian, state, TODAY)).toMatchObject({ target: key('e4 c5 c3'), autoplayed: [] });
    expect(planLine(sicilian, state, TODAY, undefined, [['e4', 'c5', 'Nf3', 'Nc6']])).toMatchObject({ autoplayed: ['e4', 'c5'] });
  });

  it('never plays alone a position due that the player has not played in the session', () => {
    const sicilian = repertoireOf('b', { '': ['e4'], e4: ['c5'], 'e4 c5': ['Nf3', 'c3'], 'e4 c5 Nf3': ['Nc6'], 'e4 c5 c3': ['Nf6'] });
    const state = answered(new Map(), key('e4 c5 Nf3'), true, TODAY);
    const heaviest = (k: string) => (k === key('e4 c5 c3') ? 5 : 1);

    expect(planLine(sicilian, state, TODAY, heaviest, [['e4', 'c5', 'Nf3', 'Nc6']])).toMatchObject({ target: key('e4 c5 c3'), autoplayed: ['e4'] });
  });

  it('plays alone the move that leads to the position due where the repertoire has several', () => {
    const alapin = repertoireOf('w', { '': ['e4'], e4: ['c5'], 'e4 c5': ['Nf3', 'c3'], 'e4 c5 c3': ['d5'], 'e4 c5 c3 d5': ['exd5'] });
    const reviewed = [key(''), key('e4 c5')].reduce<ReviewState>((known, k) => answered(known, k, true, TODAY), new Map());

    expect(planLine(alapin, reviewed, TODAY)).toMatchObject({ target: key('e4 c5 c3 d5'), autoplayed: ['e4', 'c5', 'c3'] });
  });
});
