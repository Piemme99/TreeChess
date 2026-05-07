import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import { createRepertoire } from '../../../../test/factories';

vi.mock('../../../../shared/components/Board', () => ({
  StaticBoard: () => <div data-testid="static-board" />,
}));

vi.mock('../../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

const storeState = {
  createRepertoire: vi.fn(),
  deleteRepertoire: vi.fn(),
  renameRepertoire: vi.fn(),
  mergeRepertoires: vi.fn(),
  createCategory: vi.fn(),
  toggleCategoryExpanded: vi.fn(),
  expandedCategories: new Set<string>(),
  assignRepertoireToCategory: vi.fn(),
};

vi.mock('../../../../stores/repertoireStore', () => ({
  useRepertoireStore: () => storeState,
}));

import { RepertoireSelector } from './RepertoireSelector';

function renderSelector(repertoires = [
  createRepertoire({ id: 'rep-a', name: 'Alpha Opening', color: 'white' }),
  createRepertoire({ id: 'rep-b', name: 'Bravo Opening', color: 'white' }),
]) {
  return render(
    <MemoryRouter>
      <RepertoireSelector
        color="white"
        repertoires={repertoires}
        categories={[]}
        onImportStudy={() => {}}
      />
    </MemoryRouter>,
  );
}

function selectRepertoire(name: string) {
  const card = screen.getByText(name).closest('div[class*="bg-bg-card"]') as HTMLElement;
  const checkbox = within(card).getByRole('checkbox') as HTMLInputElement;
  fireEvent.click(checkbox);
}

describe('RepertoireSelector – merge name pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills the merge name with the first selected repertoire when entering merge mode', () => {
    renderSelector();

    selectRepertoire('Alpha Opening');
    selectRepertoire('Bravo Opening');

    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    const input = screen.getByPlaceholderText(/name for merged repertoire/i) as HTMLInputElement;
    expect(input.value).toBe('Alpha Opening');
  });

  it('lets the user edit the pre-filled name freely', () => {
    renderSelector();

    selectRepertoire('Alpha Opening');
    selectRepertoire('Bravo Opening');
    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    const input = screen.getByPlaceholderText(/name for merged repertoire/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Custom Merged Name' } });
    expect(input.value).toBe('Custom Merged Name');
  });

  it('re-pre-fills with the new first selection after cancelling merge', () => {
    renderSelector();

    // First selection: Bravo first, then Alpha. First-selected is Bravo.
    selectRepertoire('Bravo Opening');
    selectRepertoire('Alpha Opening');
    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    expect(
      (screen.getByPlaceholderText(/name for merged repertoire/i) as HTMLInputElement).value,
    ).toBe('Bravo Opening');

    // Cancel and clear selection by toggling them off.
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    selectRepertoire('Bravo Opening'); // unselect Bravo
    selectRepertoire('Alpha Opening'); // unselect Alpha

    // New selection: Alpha first.
    selectRepertoire('Alpha Opening');
    selectRepertoire('Bravo Opening');
    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));

    expect(
      (screen.getByPlaceholderText(/name for merged repertoire/i) as HTMLInputElement).value,
    ).toBe('Alpha Opening');
  });
});
