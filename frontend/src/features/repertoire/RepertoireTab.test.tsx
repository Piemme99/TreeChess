import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import { createRepertoire } from '../../test/factories';

vi.mock('../../shared/components/Board', () => ({
  StaticBoard: () => <div data-testid="static-board" />,
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('../../stores/repertoireStore', () => ({
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

const whiteReps = [createRepertoire({ id: 'w-1', name: 'Italian Game', color: 'white' })];
const blackReps = [createRepertoire({ id: 'b-1', name: 'Sicilian Defence', color: 'black' })];

vi.mock('./shared/hooks/useRepertoires', () => ({
  useRepertoires: () => ({
    whiteRepertoires: whiteReps,
    blackRepertoires: blackReps,
    whiteCategories: [],
    blackCategories: [],
    loading: false,
    repertoires: [...whiteReps, ...blackReps],
    categories: [],
    refresh: vi.fn(),
  }),
}));

import { RepertoireTab } from './RepertoireTab';

describe('RepertoireTab – White/Black parity (#60)', () => {
  it('shows both White and Black sections and their repertoires without any tab click', () => {
    render(
      <MemoryRouter>
        <RepertoireTab />
      </MemoryRouter>,
    );

    // Both colour section headers are present at the same level.
    expect(screen.getByRole('heading', { name: 'White' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Black' })).toBeInTheDocument();

    // Repertoires from both colours are visible simultaneously — no extra click for Black.
    expect(screen.getByText('Italian Game')).toBeInTheDocument();
    expect(screen.getByText('Sicilian Defence')).toBeInTheDocument();
  });
});
