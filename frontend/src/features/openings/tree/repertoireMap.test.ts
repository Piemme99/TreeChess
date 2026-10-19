import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import { positionKey, type Repertoire, type RepertoireMove } from '../domain/repertoire';
import { visibleNodes } from './fold';
import { buildRepertoireMap, forEachNode, markedNodes, type MapNode } from './repertoireMap';

const games = (count: number, moves: string): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'w', moves: moves.split(' '), score: 1, playedAt: '2026-03-01' }));

const after = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return positionKey(chess.fen());
};

const habit = (san: string): RepertoireMove => ({ san, source: 'habit', addedAt: '2026-01-01' });

/** Deux ordres de coups vers la même position : 1.d4 d5 2.c4 et 1.c4 d5 2.d4. */
const repertoire: Repertoire = {
  side: 'w',
  moves: new Map([
    [after(''), [habit('d4'), habit('c4')]],
    [after('d4'), [habit('d5')]],
    [after('d4 d5'), [habit('c4')]],
    [after('c4'), [habit('d5')]],
    [after('c4 d5'), [habit('d4')]],
    [after('d4 d5 c4'), [habit('e6'), habit('c6')]],
    [after('d4 d5 c4 e6'), [habit('Nc3')]],
    [after('d4 d5 c4 c6'), [habit('Nf3')]],
  ]),
};

const played = [...games(10, 'd4 d5 c4 e6 Nc3'), ...games(4, 'c4 d5 d4 c6 Nf3')];
const recent = buildOpeningTree(played, 'w', 24);

const find = (root: MapNode, path: string) => {
  let found: MapNode | undefined;
  forEachNode(root, (node) => {
    if (node.key === path) found = node;
  });
  return found!;
};

describe('buildRepertoireMap', () => {
  const marks = { toSettle: new Map([[after('d4 d5 c4'), 7]]), priorities: [{ side: 'w' as const, path: ['d4', 'd5', 'c4', 'e6', 'Nc3'], games: 10, pointsToGain: 3 }] };
  const root = buildRepertoireMap(repertoire, recent, marks);

  it('draws a position once and leaves a stub at its other arrival', () => {
    expect(find(root, 'd4 d5 c4').stub).toBe(false);
    expect(find(root, 'd4 d5 c4').children.map((child) => child.san)).toEqual(['e6', 'c6']);
    expect(find(root, 'c4 d5 d4').stub).toBe(true);
    expect(find(root, 'c4 d5 d4').children).toEqual([]);
  });

  it('counts the games of every arrival on the drawn position', () => {
    expect(find(root, 'd4 d5 c4').games).toBe(14);
    expect(find(root, 'c4 d5 d4').games).toBe(4);
  });

  it('marks positions to settle and pins priorities', () => {
    expect(find(root, 'd4 d5 c4').toSettle).toBe(7);
    expect(find(root, 'd4 d5 c4 e6 Nc3').priority).toBe(1);
    expect(markedNodes(root).toSettle.map((node) => node.key)).toEqual(['d4 d5 c4']);
    expect(markedNodes(root).priorities.map((node) => node.key)).toEqual(['d4 d5 c4 e6 Nc3']);
  });

  it('skips a priority of the other side', () => {
    const other = buildRepertoireMap(repertoire, recent, { toSettle: new Map(), priorities: [{ ...marks.priorities[0], side: 'b' }] });
    expect(markedNodes(other).priorities).toEqual([]);
  });
});

describe('visibleNodes', () => {
  const root = buildRepertoireMap(repertoire, recent, { toSettle: new Map(), priorities: [] });
  const keys = (depth: number, opened: string[] = [], closed: string[] = []) =>
    visibleNodes(root, depth, 0, { opened: new Set(opened), closed: new Set(closed) }).map(({ node, hidden }) => `${node.key || 'start'}${hidden ? ` +${hidden}` : ''}`);

  it('shows everything down to the depth, and counts what is hidden below', () => {
    expect(keys(2)).toEqual(['start', 'd4', 'd4 d5 +5', 'c4', 'c4 d5 +1']);
  });

  it('keeps the path to a marked node open whatever the depth', () => {
    const marked = buildRepertoireMap(repertoire, recent, { toSettle: new Map([[after('d4 d5 c4 c6'), 3]]), priorities: [] });
    const shown = visibleNodes(marked, 1, 0, { opened: new Set(), closed: new Set() }).map(({ node }) => node.key);
    expect(shown).toEqual(['', 'd4', 'd4 d5', 'd4 d5 c4', 'd4 d5 c4 c6', 'c4']);
  });

  it('folds the lines too thin to matter, and counts them', () => {
    const shown = visibleNodes(root, 6, 5, { opened: new Set(), closed: new Set() }).map(({ node, hidden }) => `${node.key || 'start'}${hidden ? ` +${hidden}` : ''}`);
    expect(shown).toEqual(['start +3', 'd4', 'd4 d5', 'd4 d5 c4 +2', 'd4 d5 c4 e6', 'd4 d5 c4 e6 Nc3']);
  });

  it('unfolds and folds by hand', () => {
    expect(keys(2, ['d4 d5'])).toContain('d4 d5 c4 +4');
    expect(keys(2, [], ['d4'])).toEqual(['start', 'd4 +6', 'c4', 'c4 d5 +1']);
  });
});
