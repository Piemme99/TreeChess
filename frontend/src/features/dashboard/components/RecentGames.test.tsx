import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

import { RecentGames } from './RecentGames';
import type { GameSummary } from '../../../types';

function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const sampleGame: GameSummary = {
  analysisId: 'a1',
  gameIndex: 0,
  white: 'Alice',
  black: 'Bob',
  result: '1-0',
  date: '2026-05-01',
  userColor: 'white',
  status: 'in-repertoire',
  importedAt: '2026-05-01T00:00:00Z',
  source: 'lichess',
  synced: true,
};

describe('RecentGames', () => {
  it('renders the section header as a link to /games', () => {
    renderInRouter(<RecentGames games={[sampleGame]} loading={false} />);
    const link = screen.getByRole('link', { name: /recent games/i });
    expect(link).toHaveAttribute('href', '/games');
  });

  it('exposes the header link even when there are no games yet', () => {
    renderInRouter(<RecentGames games={[]} loading={false} />);
    const link = screen.getByRole('link', { name: /recent games/i });
    expect(link).toHaveAttribute('href', '/games');
    expect(screen.getByText(/no games imported yet/i)).toBeInTheDocument();
  });

  it('still renders game rows', () => {
    renderInRouter(<RecentGames games={[sampleGame]} loading={false} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
