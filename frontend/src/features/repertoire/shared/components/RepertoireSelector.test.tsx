import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function getCardsFlow(container: HTMLElement): HTMLElement {
  const flow = container.querySelector('[data-testid="repertoires-flow"]');
  if (!flow) throw new Error('repertoires-flow container not found');
  return flow as HTMLElement;
}

function indexInParent(el: HTMLElement): number {
  const parent = el.parentElement;
  if (!parent) throw new Error('element has no parent');
  return Array.from(parent.children).indexOf(el);
}

describe('RepertoireSelector – merge UI does not shift layout', () => {
  it('selecting a second repertoire does not push the cards down', () => {
    const { container } = renderSelector();

    const flowBefore = getCardsFlow(container);
    const indexBefore = indexInParent(flowBefore);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText(/2 repertoires selected/i)).toBeInTheDocument();

    const flowAfter = getCardsFlow(container);
    const indexAfter = indexInParent(flowAfter);

    expect(indexAfter).toBe(indexBefore);
  });

  it('switching to the merging form does not push the cards down', () => {
    const { container } = renderSelector();

    // Baseline: no selection, cards sit at this index in their parent.
    const baselineIndex = indexInParent(getCardsFlow(container));

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    expect(screen.getByPlaceholderText(/name for merged repertoire/i)).toBeInTheDocument();

    const indexAfterMergeForm = indexInParent(getCardsFlow(container));
    expect(indexAfterMergeForm).toBe(baselineIndex);
  });
});
