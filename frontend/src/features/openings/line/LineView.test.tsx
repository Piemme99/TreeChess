import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Evaluation } from '../domain/diagnosis';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import type { ExplorerStats } from '../domain/preparation';
import { replayLine } from '../position/replay';
import { LineView } from './LineView';

// Le moteur et l'explorateur sont des tables : chaque position vaut 0 sauf celles qu'un test fixe.
const engine = new Map<string, Evaluation>();
const level = new Map<string, ExplorerStats>();
const evaluationOf = (fen: string) => engine.get(fen) ?? { cp: 0 };

vi.mock('./engine', () => ({
  useEvaluations: (fens: readonly string[], _depth: number, enabled = true) =>
    new Map(enabled ? fens.map((fen) => [fen, evaluationOf(fen)]) : []),
  evaluate: async (fen: string) => evaluationOf(fen),
}));

vi.mock('./explorer', () => ({
  hasExplorer: () => true,
  explore: async (database: string, fen: string) => (database === 'lichess' ? (level.get(fen) ?? null) : null),
}));

const LOST = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4';
const games = (count: number, moves: string, score: PlayedGame['score']): PlayedGame[] =>
  Array.from({ length: count }, (_, day) => ({ side: 'w', moves: moves.split(' '), score, playedAt: `2026-03-${String(day + 1).padStart(2, '0')}` }));
const played = [...games(6, LOST, 0), ...games(3, 'e4 e5 Nf3 d6 d4', 1), ...games(10, 'd4 d5 c4', 1)];
const tree = buildOpeningTree(played, 'w', 16);
const fenAfter = (moves: string) => replayLine(moves.split(' ')).fens.at(-1)!;
const stats = (moves: Record<string, number>): ExplorerStats => {
  const all = Object.values(moves).reduce((sum, count) => sum + count, 0);
  return { white: all, draws: 0, black: 0, moves: Object.entries(moves).map(([san, count]) => ({ san, white: count, draws: 0, black: 0 })) };
};

const view = (onOpen = vi.fn()) =>
  render(<LineView tree={tree} games={played} path={['e4', 'e5', 'Nf3', 'Nc6']} onBack={() => {}} onOpen={onOpen} />);

describe('LineView', () => {
  beforeEach(() => {
    engine.clear();
    level.clear();
  });

  it('says the opening is fine when the engine holds while the results fall, and names the position to work on', async () => {
    view();

    const verdict = await screen.findByRole('article', { name: 'Verdict' });
    expect(verdict).toHaveTextContent('Your opening is fine. What follows isn’t.');
    expect(verdict).toHaveTextContent('+0 ptsyour opening moves');
    expect(verdict).toHaveTextContent(/−68 ptsafter the opening/);
    expect(verdict).toHaveTextContent('The position to work on: after 2…♘c6');
  });

  it('names a move of the player the engine finds costly, with the engine move', async () => {
    for (const moves of ['e4', 'e4 e5', 'e4 e5 Nf3', 'e4 e5 Nf3 Nc6']) engine.set(fenAfter(moves), { cp: -150 });
    engine.set(replayLine([]).fens[0], { cp: 0, best: 'd2d4' });
    view();

    const verdict = await screen.findByRole('article', { name: 'Verdict' });
    expect(verdict).toHaveTextContent('A move costs you, and so does what follows');
    expect(verdict).toHaveTextContent('1.e4costs13 ptsengine: 1.d4');
  });

  it('recaps the decisive mistake of each game from the key position, each opening on Lichess at that move', async () => {
    const beforeMistake = fenAfter('e4 e5 Nf3 Nc6 Bc4 Bc5');
    engine.set(beforeMistake, { cp: 0, best: 'd2d3' });
    for (const moves of ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4', LOST]) {
      engine.set(fenAfter(moves), { cp: -500 });
    }
    view();

    fireEvent.click(await screen.findByRole('button', { name: /Your decisive mistakes from here · 6/ }));

    const rows = within(screen.getByRole('list', { name: 'Your decisive mistakes' })).getAllByRole('button');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('4.c3 → 4.d3 · −36 pts');
    expect(within(rows[0]).getByRole('link', { name: 'Lichess ↗' })).toHaveAttribute('href', expect.stringMatching(/analysis\/pgn\/e4_e5_.*#6$/));

    fireEvent.click(rows[0]);
    expect(screen.getByRole('link', { name: 'Open this game on Lichess ↗' })).toBeInTheDocument();
  });

  it('proposes a preparation from the key position: the habit the engine accepts, against the replies frequent at the player level', async () => {
    level.set(fenAfter('e4 e5 Nf3 Nc6'), stats({ Bc4: 600, Bb5: 400 }));
    level.set(fenAfter('e4 e5 Nf3 Nc6 Bc4'), stats({ Bc5: 700, Nf6: 300 }));
    view();

    const preparation = await screen.findByRole('list', { name: 'Proposed preparation' });
    expect(preparation).toHaveTextContent('3.♗c43…♗c5 70%3…♘f6 30%');
  });

  it('opens an opponent move off the line, from the whole line, as a line of its own', async () => {
    const onOpen = vi.fn();
    view(onOpen);

    fireEvent.click(screen.getByRole('button', { name: /The whole line/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'show every opponent move' }));
    fireEvent.click(within(screen.getByRole('list', { name: 'Whole line' })).getByRole('button', { name: /^2…d6/ }));

    expect(onOpen).toHaveBeenCalledWith(['e4', 'e5', 'Nf3', 'd6']);
  });
});
