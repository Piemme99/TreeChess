import { describe, expect, it } from 'vitest';
import { replayLine } from '../position/replay';
import type { Evaluation } from './diagnosis';
import type { PlayedGame } from './playedGame';
import { proposePreparation, type ExplorerStats, type PreparedMove } from './preparation';

const KEY = ['e4', 'e5'];
const fenAfter = (moves: string) => replayLine([...KEY, ...(moves ? moves.split(' ') : [])]).fens.at(-1)!;

// Parties à ce niveau depuis une position : chaque coup avec son nombre de parties.
const level = (moves: Record<string, number>): ExplorerStats => {
  const all = Object.values(moves).reduce((sum, count) => sum + count, 0);
  return { white: all, draws: 0, black: 0, moves: Object.entries(moves).map(([san, count]) => ({ san, white: count, draws: 0, black: 0 })) };
};

const games = (count: number, moves: string): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'w', moves: [...KEY, ...moves.split(' ')], score: 0, playedAt: '2026-01-01' }));

async function propose(
  explorer: Record<string, ExplorerStats>,
  played: PlayedGame[],
  { cps = {}, best = {} }: { cps?: Record<string, number>; best?: Record<string, string> } = {},
) {
  const stats = new Map(Object.entries(explorer).map(([moves, value]) => [fenAfter(moves), value]));
  const evaluations = new Map<string, Evaluation>();
  for (const [moves, cp] of Object.entries(cps)) evaluations.set(fenAfter(moves), { cp });
  for (const [moves, uci] of Object.entries(best)) evaluations.set(fenAfter(moves), { cp: cps[moves] ?? 0, best: uci });
  return proposePreparation(KEY, 'w', played, {
    explore: async (fen) => stats.get(fen) ?? null,
    evaluate: async (fen) => evaluations.get(fen) ?? { cp: 0 },
    cancelled: () => false,
    onProgress: () => {},
  });
}

const outline = (moves: readonly PreparedMove[]): unknown[] =>
  moves.map((move) => [move.san, move.source ?? move.mine, ...(move.next.length ? [outline(move.next)] : [])]);

describe('proposePreparation', () => {
  it('keeps the player habit where the engine accepts it, against the replies frequent at their level', async () => {
    const prepared = await propose(
      { '': level({ Nf3: 600, Bc4: 400 }), Nf3: level({ Nc6: 700, d6: 200, f5: 100 }) },
      [...games(2, 'Nf3 Nc6'), ...games(1, 'Nf3 Nf6')],
    );

    expect(outline(prepared)).toEqual([['Nf3', 'habit', [['Nc6', 2], ['d6', 0]]]]);
    expect(prepared[0].next[0].share).toBeCloseTo(0.7);
  });

  it('drops a habit the engine finds costly for the most played move at their level that it accepts', async () => {
    const prepared = await propose({ '': level({ Nf3: 600, Bc4: 400 }) }, games(2, 'Qh5'), { cps: { Qh5: -250, Nf3: -150 } });

    expect(prepared[0]).toMatchObject({ san: 'Bc4', source: 'level', dropped: { san: 'Qh5' } });
  });

  it('falls back on the engine move when nothing played at their level holds', async () => {
    const prepared = await propose({ '': level({ Nf3: 600, Bc4: 400 }) }, [], { cps: { Nf3: -150, Bc4: -150 }, best: { '': 'b1c3' } });

    expect(prepared[0]).toMatchObject({ san: 'Nc3', source: 'engine' });
  });

  it('keeps a reply the player meets often even when rare at their level, and leaves out branches too rare to learn', async () => {
    const prepared = await propose(
      { '': level({ Nf3: 1000 }), Nf3: level({ Nc6: 500, d6: 400, Qf6: 100 }), 'Nf3 d6': level({ d4: 1000 }), 'Nf3 d6 d4': level({ exd4: 850, Nf6: 150 }) },
      [...games(2, 'Nf3 Qf6'), ...games(2, 'Nf3 d6 d4 exd4')],
    );

    // 2…♕f6 ne pèse que 10 % à ce niveau mais le joueur l'a rencontré deux fois ; 3…♘f6 (40 % × 15 %) est trop rare.
    expect(outline(prepared)).toEqual([['Nf3', 'habit', [['Nc6', 0], ['d6', 2, [['d4', 'habit', [['exd4', 2]]]]], ['Qf6', 2]]]]);
  });

  it('stops where the games at their level run out', async () => {
    expect(await propose({ '': { white: 30, draws: 0, black: 0, moves: [{ san: 'Nf3', white: 30, draws: 0, black: 0 }] } }, [])).toEqual([]);
  });

  it('shows the preparation as it grows, each move as soon as it is chosen', async () => {
    const stats = new Map([
      ['', level({ Nf3: 600, Bc4: 400 })],
      ['Nf3', level({ Nc6: 700, d6: 300 })],
    ].map(([moves, value]) => [fenAfter(moves as string), value as ExplorerStats]));
    const snapshots: unknown[] = [];

    await proposePreparation(KEY, 'w', games(2, 'Nf3 Nc6'), {
      explore: async (fen) => stats.get(fen) ?? null,
      evaluate: async () => ({ cp: 0 }),
      cancelled: () => false,
      onProgress: () => {},
      onPartial: (moves) => snapshots.push(outline(moves)),
    });

    expect(snapshots).toEqual([
      [['Nf3', 'habit']],
      [['Nf3', 'habit', [['Nc6', 2]]]],
      [['Nf3', 'habit', [['Nc6', 2], ['d6', 0]]]],
    ]);
  });
});
