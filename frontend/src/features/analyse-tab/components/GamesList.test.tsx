import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamesList } from './GamesList';
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

function renderList(games: GameSummary[]) {
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
