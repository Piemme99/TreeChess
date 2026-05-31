import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamesList, type GamesListProps } from './GamesList';
import type { GameSummary } from '../../../types';

vi.mock('../../../services/api', () => ({
  gamesApi: { reanalyze: vi.fn() },
}));

vi.mock('../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseGame: GameSummary = {
  analysisId: 'a1',
  gameIndex: 0,
  white: 'Alice',
  black: 'Bob',
  result: '1-0',
  date: '2026-05-07',
  userColor: 'white',
  status: 'in-repertoire',
  importedAt: '2026-05-07T12:00:00Z',
  source: 'lichess',
  synced: false,
};

function renderList(games: GameSummary[], extraProps: Partial<GamesListProps> = {}) {
  return render(
    <GamesList
      games={games}
      loading={false}
      onViewClick={vi.fn()}
      hasNextPage={false}
      hasPrevPage={false}
      currentPage={1}
      totalPages={1}
      onNextPage={vi.fn()}
      onPrevPage={vi.fn()}
      {...extraProps}
    />
  );
}

describe('GamesList – time control column', () => {
  it('renders the time control chip for a row with timeClass: blitz', () => {
    renderList([{ ...baseGame, timeClass: 'blitz' }]);
    expect(screen.getByText('blitz')).toBeInTheDocument();
  });

  it('renders a fallback when timeClass is missing', () => {
    const { container } = renderList([{ ...baseGame }]);
    const fallback = container.querySelector('[data-testid="time-class"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toBe('—');
  });
});

describe('GamesList – New games header badge', () => {
  const newGame: GameSummary = { ...baseGame, synced: true };

  it('shows the global New total in the header, not the page-local row count', () => {
    // Only one New game on this page, but 324 across all pages.
    renderList([newGame], { newGamesTotal: 324 });

    const heading = screen.getByRole('heading', { name: /New games/ });
    expect(heading.textContent).toContain('324');
    expect(heading.textContent).not.toContain('1');
  });

  it('falls back to the rendered row count when no global total is provided', () => {
    renderList([newGame, { ...newGame, gameIndex: 1 }]);

    const heading = screen.getByRole('heading', { name: /New games/ });
    expect(heading.textContent).toContain('2');
  });

  it('keeps the section hidden when there are no New games on the current page even if the global total is positive', () => {
    // A non-empty global total must not surface an empty New-games grid.
    renderList([{ ...baseGame, synced: false }], { newGamesTotal: 50 });

    expect(screen.queryByRole('heading', { name: /New games/ })).toBeNull();
  });
});
