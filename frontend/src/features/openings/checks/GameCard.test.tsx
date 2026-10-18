import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CheckedGame } from './checkedGame';
import { GameCard } from './GameCard';

const scotch: CheckedGame = {
  id: 1,
  game: { side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Qe7'], score: 1, playedAt: '2026-01-04' },
  check: { kind: 'uncovered', ply: 7, played: 'Qe7', planned: ['Nxd4', 'Bc5'], position: '' },
  asks: true,
};

const card = (judgement?: 'mistake' | null) => render(<GameCard checked={scotch} selected={false} onSelect={() => {}} judgement={judgement} />);

describe('GameCard', () => {
  it("names only the opponent's move, not the replies the repertoire prepares", () => {
    card(null);

    expect(screen.getByText(/Opponent played/)).toHaveTextContent(/^Opponent played 4…♕e7$/);
  });

  it("marks the opponent's move when the engine finds it a mistake", () => {
    card('mistake');

    expect(screen.getByText(/Opponent played/)).toHaveTextContent('Opponent played 4…♕e7? · mistake');
  });
});
