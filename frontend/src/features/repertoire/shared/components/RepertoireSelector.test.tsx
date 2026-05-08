import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../../../stores/repertoireStore', () => ({
  useRepertoireStore: () => ({
    createRepertoire: vi.fn(),
    deleteRepertoire: vi.fn(),
    renameRepertoire: vi.fn(),
    mergeRepertoires: vi.fn(),
    createCategory: vi.fn(),
    toggleCategoryExpanded: vi.fn(),
    expandedCategories: new Set<string>(),
    assignRepertoireToCategory: vi.fn(),
  }),
}));

vi.mock('../../../../shared/components/Board', () => ({
  StaticBoard: () => <div data-testid="static-board" />,
  ChessBoard: () => <div data-testid="chess-board" />,
}));

import { RepertoireSelector } from './RepertoireSelector';
import { createRepertoire, resetFactoryIds } from '../../../../test/factories';

function renderSelector() {
  resetFactoryIds();
  const reps = [
    createRepertoire({ id: 'r1', name: 'Rep 1', color: 'white' }),
    createRepertoire({ id: 'r2', name: 'Rep 2', color: 'white' }),
  ];

  return render(
    <MemoryRouter>
      <RepertoireSelector
        color="white"
        repertoires={reps}
        categories={[]}
        onImportStudy={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe('RepertoireSelector – merge slot', () => {
  it('renders the reserved merge slot before any selection', () => {
    renderSelector();

    const slot = screen.getByTestId('merge-slot');
    expect(slot).toBeInTheDocument();
    expect(slot.className).toContain('min-h-[60px]');
    expect(slot).toBeEmptyDOMElement();
  });

  it('reveals the selection banner inside the slot when two repertoires are selected', () => {
    renderSelector();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const slot = screen.getByTestId('merge-slot');
    expect(within(slot).getByText(/2 repertoires selected/i)).toBeInTheDocument();
    expect(within(slot).getByRole('button', { name: /merge selected/i })).toBeInTheDocument();
  });

  it('swaps the slot contents to the merge form when "Merge Selected" is clicked', () => {
    renderSelector();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    const slot = screen.getByTestId('merge-slot');
    expect(within(slot).getByPlaceholderText(/name for merged repertoire/i)).toBeInTheDocument();
    expect(within(slot).getByRole('button', { name: /^merge$/i })).toBeInTheDocument();
    expect(within(slot).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
