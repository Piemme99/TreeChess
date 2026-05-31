import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { MoveAnalysis } from '../../../types';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock('../../repertoire/shared/components/StudyImportModal', () => ({
  StudyImportModal: ({ isOpen }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) =>
    isOpen ? <div data-testid="study-modal" /> : null,
}));

vi.mock('../../../stores/repertoireStore', () => ({
  useRepertoireStore: () => ({ createRepertoire: vi.fn() }),
}));

vi.mock('../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../shared/components/UI', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

import { GameMoveList } from './GameMoveList';

function makeMove(plyNumber: number, san: string, status: MoveAnalysis['status'], isUserMove = false): MoveAnalysis {
  return {
    plyNumber,
    san,
    fen: '',
    status,
    isUserMove,
  };
}

describe('GameMoveList - create-new-repertoire affordance', () => {
  it('shows "Create New Repertoire" on a new-opening game (no matched repertoire) without requiring a move click', () => {
    // Simulate new-opening: GameAnalysisPage withholds onAddToRepertoire/onOpenInRepertoire
    // because there is no matched repertoire, but onCreateAndAdd is still provided.
    // The page lands at currentMoveIndex=-1 (no move selected); the affordance must still
    // be visible — otherwise the user has no discoverable path to seed a new repertoire.
    const moves: MoveAnalysis[] = [
      makeMove(0, 'e4', 'out-of-book', true),
      makeMove(1, 'e5', 'out-of-book', false),
    ];

    render(
      <GameMoveList
        moves={moves}
        currentMoveIndex={-1}
        maxDisplayedIndex={1}
        onMoveClick={vi.fn()}
        onAddToRepertoire={undefined}
        onOpenInRepertoire={undefined}
        onCreateAndAdd={vi.fn()}
        onImportSuccess={vi.fn()}
        userColor="white"
        showFullGame={false}
        hasMoreMoves={false}
        onToggleFullGame={vi.fn()}
      />,
    );

    expect(screen.getByText('Create New Repertoire')).toBeInTheDocument();
    expect(screen.getByText('Import from Lichess')).toBeInTheDocument();
    expect(screen.queryByText(/Add to Repertoire/)).not.toBeInTheDocument();
    expect(screen.queryByText('Open in Repertoire')).not.toBeInTheDocument();
  });

  it('shows both "Add to Repertoire" and "Create New Repertoire" on a new-line game at the divergence', () => {
    const moves: MoveAnalysis[] = [
      makeMove(0, 'e4', 'in-repertoire', true),
      makeMove(1, 'c5', 'opponent-new', false),
    ];

    render(
      <GameMoveList
        moves={moves}
        currentMoveIndex={1}
        maxDisplayedIndex={1}
        onMoveClick={vi.fn()}
        onAddToRepertoire={vi.fn()}
        onOpenInRepertoire={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onImportSuccess={vi.fn()}
        userColor="white"
        showFullGame={false}
        hasMoreMoves={false}
        onToggleFullGame={vi.fn()}
      />,
    );

    expect(screen.getByText(/Add to Repertoire/)).toBeInTheDocument();
    expect(screen.getByText('Create New Repertoire')).toBeInTheDocument();
    expect(screen.getByText('Import from Lichess')).toBeInTheDocument();
  });

  it('hides the "Or add to a new repertoire" block before the divergence on a new-line game', () => {
    const moves: MoveAnalysis[] = [
      makeMove(0, 'e4', 'in-repertoire', true),
      makeMove(1, 'c5', 'opponent-new', false),
    ];

    render(
      <GameMoveList
        moves={moves}
        currentMoveIndex={0}
        maxDisplayedIndex={1}
        onMoveClick={vi.fn()}
        onAddToRepertoire={vi.fn()}
        onOpenInRepertoire={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onImportSuccess={vi.fn()}
        userColor="white"
        showFullGame={false}
        hasMoreMoves={false}
        onToggleFullGame={vi.fn()}
      />,
    );

    expect(screen.queryByText('Create New Repertoire')).not.toBeInTheDocument();
    expect(screen.queryByText('Import from Lichess')).not.toBeInTheDocument();
  });
});

describe('GameMoveList - move cell accessibility', () => {
  const moves: MoveAnalysis[] = [
    makeMove(0, 'e4', 'in-repertoire', true),
    makeMove(1, 'c5', 'opponent-new', false),
  ];

  function renderList(onMoveClick = vi.fn(), currentMoveIndex = 0) {
    render(
      <GameMoveList
        moves={moves}
        currentMoveIndex={currentMoveIndex}
        maxDisplayedIndex={1}
        onMoveClick={onMoveClick}
        onAddToRepertoire={vi.fn()}
        onOpenInRepertoire={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onImportSuccess={vi.fn()}
        userColor="white"
        showFullGame={false}
        hasMoreMoves={false}
        onToggleFullGame={vi.fn()}
      />,
    );
    return onMoveClick;
  }

  it('exposes each move cell as a button with the SAN as its accessible name', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'c5' })).toBeInTheDocument();
  });

  it('marks the current move with aria-current', () => {
    renderList(vi.fn(), 1);
    expect(screen.getByRole('button', { name: 'c5' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'e4' })).not.toHaveAttribute('aria-current');
  });

  it('activates a move via Enter and Space', () => {
    const onMoveClick = renderList();
    const cell = screen.getByRole('button', { name: 'c5' });

    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onMoveClick).toHaveBeenCalledWith(1);

    fireEvent.keyDown(cell, { key: ' ' });
    expect(onMoveClick).toHaveBeenCalledTimes(2);
  });
});
