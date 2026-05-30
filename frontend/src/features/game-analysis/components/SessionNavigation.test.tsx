import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionNavigation } from './SessionNavigation';
import type { GameSummary, GameStatus } from '../../../types';

function makeGame(analysisId: string, gameIndex: number, status: GameStatus): GameSummary {
  return {
    analysisId,
    gameIndex,
    white: `W${gameIndex}`,
    black: `B${gameIndex}`,
    result: '1-0',
    date: '2026-05-07',
    userColor: 'white',
    status,
    importedAt: '2026-05-07T12:00:00Z',
    source: 'lichess',
    synced: true,
  };
}

// A session spanning two analyses (cross-import).
const games = [
  makeGame('a1', 0, 'new-line'),
  makeGame('a1', 1, 'new-opening'),
  makeGame('a2', 0, 'new-line'),
];

function props(overrides: Partial<React.ComponentProps<typeof SessionNavigation>> = {}) {
  return {
    sessionGames: games,
    currentAnalysisId: 'a1',
    currentGameIndex: 0,
    onSelect: vi.fn(),
    movesAddedThisSession: 0,
    ...overrides,
  };
}

describe('SessionNavigation', () => {
  it('renders nothing for a single-game session', () => {
    const { container } = render(<SessionNavigation {...props({ sessionGames: [games[0]] })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the current game is not part of the session', () => {
    const { container } = render(
      <SessionNavigation {...props({ currentAnalysisId: 'other', currentGameIndex: 9 })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables previous on the first game and next on the last', () => {
    const { rerender } = render(<SessionNavigation {...props()} />);
    expect(screen.getByLabelText('Previous game')).toBeDisabled();
    expect(screen.getByLabelText('Next game')).not.toBeDisabled();

    rerender(
      <SessionNavigation {...props({ currentAnalysisId: 'a2', currentGameIndex: 0, movesAddedThisSession: 2 })} />
    );
    expect(screen.getByLabelText('Next game')).toBeDisabled();
    expect(screen.getByText(/End of new games/)).toBeInTheDocument();
    expect(screen.getByText(/2 moves added/)).toBeInTheDocument();
  });

  it('selects the adjacent game (crossing analyses) via the next control', () => {
    const onSelect = vi.fn();
    render(<SessionNavigation {...props({ currentAnalysisId: 'a1', currentGameIndex: 1, onSelect })} />);
    fireEvent.click(screen.getByLabelText('Next game'));
    expect(onSelect).toHaveBeenCalledWith('a2', 0);
  });

  it('jumps to a game picked from the dropdown', () => {
    const onSelect = vi.fn();
    render(<SessionNavigation {...props({ onSelect })} />);
    fireEvent.click(screen.getByRole('button', { name: /New game 1 \/ 3/ }));
    fireEvent.click(screen.getByRole('option', { name: /W1 vs B1/ }));
    expect(onSelect).toHaveBeenCalledWith('a1', 1);
  });
});
