import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateTrainingLines,
  selectRandomLines,
  buildNodeMap,
  generateContinuationFromNode,
  findChildBySan,
  type TrainingLine,
} from './treeTraversal';
import type { RepertoireNode } from '../../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<RepertoireNode>): RepertoireNode {
  return {
    id: 'n',
    fen: START_FEN,
    move: null,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children: [],
    ...partial,
  } as RepertoireNode;
}

/**
 * White repertoire fixture:
 *   root (w to move)
 *     ├─ e4  (b to move)
 *     │     ├─ e5  (w to move) ── Nf3 (b, leaf)
 *     │     └─ c5  (w to move, leaf)
 *     └─ d4  (b to move, leaf)
 */
function buildTree(): RepertoireNode {
  const nf3 = node({ id: 'nf3', move: 'Nf3', fen: 'fen-nf3', colorToMove: 'b' });
  const e5 = node({ id: 'e5', move: 'e5', fen: 'fen-e5', colorToMove: 'w', children: [nf3] });
  const c5 = node({ id: 'c5', move: 'c5', fen: 'fen-c5', colorToMove: 'w' });
  const e4 = node({ id: 'e4', move: 'e4', fen: 'fen-e4', colorToMove: 'b', children: [e5, c5] });
  const d4 = node({ id: 'd4', move: 'd4', fen: 'fen-d4', colorToMove: 'b' });
  return node({ id: 'root', fen: START_FEN, colorToMove: 'w', children: [e4, d4] });
}

function sansOf(line: TrainingLine): string[] {
  return line.map((m) => m.san);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateTrainingLines', () => {
  it('produces one line per root-to-leaf path', () => {
    // Freeze shuffle so order is deterministic for the set comparison.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lines = generateTrainingLines(buildTree(), 'w');
    const asSans = lines.map(sansOf).sort();
    expect(asSans).toEqual(
      [
        ['e4', 'e5', 'Nf3'],
        ['e4', 'c5'],
        ['d4'],
      ].sort(),
    );
  });

  it('flags isUserMove from the perspective of the side to move at the parent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lines = generateTrainingLines(buildTree(), 'w');
    const line = lines.find((l) => sansOf(l).join() === 'e4,e5,Nf3')!;
    // root (w to move) → e4 is a user move; e4 (b to move) → e5 is opponent; e5 (w) → Nf3 user.
    expect(line.map((m) => m.isUserMove)).toEqual([true, false, true]);
  });

  it('flips perspective for a black repertoire', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lines = generateTrainingLines(buildTree(), 'b');
    const line = lines.find((l) => sansOf(l).join() === 'e4,e5,Nf3')!;
    // For black: root (w to move) → e4 is opponent; e5 is user; Nf3 is opponent.
    expect(line.map((m) => m.isUserMove)).toEqual([false, true, false]);
  });

  it('carries parent fen and child resultFen on each move', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lines = generateTrainingLines(buildTree(), 'w');
    const line = lines.find((l) => sansOf(l).join() === 'd4')!;
    expect(line[0]).toMatchObject({
      nodeId: 'd4',
      fen: START_FEN, // parent (root) position
      san: 'd4',
      resultFen: 'fen-d4', // child position
    });
  });

  it('treats a transposition stub (transpositionOf set, no children) as a leaf', () => {
    const stub = node({ id: 'trans', move: 'Bb5', fen: 'fen-bb5', colorToMove: 'b', transpositionOf: 'somewhere' });
    const e4 = node({ id: 'e4', move: 'e4', fen: 'fen-e4', colorToMove: 'b', children: [stub] });
    const root = node({ id: 'root', colorToMove: 'w', children: [e4] });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lines = generateTrainingLines(root, 'w');
    expect(lines.map(sansOf)).toEqual([['e4', 'Bb5']]);
  });

  it('returns no lines for a childless root', () => {
    expect(generateTrainingLines(node({ id: 'root' }), 'w')).toEqual([]);
  });
});

describe('selectRandomLines', () => {
  const lines: TrainingLine[] = [[], [], [], []].map((_, i) => [
    { nodeId: `${i}`, fen: '', san: `m${i}`, resultFen: '', isUserMove: true },
  ]);

  it('returns all lines when count >= length', () => {
    expect(selectRandomLines(lines, 4)).toBe(lines);
    expect(selectRandomLines(lines, 10)).toBe(lines);
  });

  it('returns the first `count` lines when count < length', () => {
    const subset = selectRandomLines(lines, 2);
    expect(subset).toHaveLength(2);
    expect(subset).toEqual(lines.slice(0, 2));
  });
});

describe('buildNodeMap', () => {
  it('maps every node id to its node, including the root', () => {
    const tree = buildTree();
    const map = buildNodeMap(tree);
    expect(map.size).toBe(6); // root, e4, e5, nf3, c5, d4
    expect(map.get('root')).toBe(tree);
    expect(map.get('nf3')?.move).toBe('Nf3');
    expect(map.get('c5')?.fen).toBe('fen-c5');
  });
});

describe('generateContinuationFromNode', () => {
  it('walks to a leaf, choosing children by Math.random', () => {
    // From e4 (b to move): two children e5/c5. random=0 → index 0 → e5, then e5 (w)→ Nf3.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const tree = buildTree();
    const e4 = tree.children[0];
    const cont = generateContinuationFromNode(e4, 'w');
    expect(cont.map((m) => m.san)).toEqual(['e5', 'Nf3']);
    // e4 (b to move) → e5 is opponent; e5 (w to move) → Nf3 is user.
    expect(cont.map((m) => m.isUserMove)).toEqual([false, true]);
  });

  it('returns an empty continuation for a leaf node', () => {
    const leaf = node({ id: 'leaf', move: 'e4', colorToMove: 'b' });
    expect(generateContinuationFromNode(leaf, 'w')).toEqual([]);
  });
});

describe('findChildBySan', () => {
  it('returns the matching child', () => {
    const parent = buildTree().children[0]; // e4 node, children e5/c5
    expect(findChildBySan(parent, 'c5')?.id).toBe('c5');
  });

  it('returns null when no child matches', () => {
    const parent = buildTree().children[0];
    expect(findChildBySan(parent, 'Nf6')).toBeNull();
  });
});
