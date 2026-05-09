import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MergeSlot } from './MergeSlot';

interface Handlers {
  onMergeNameChange: Mock<(name: string) => void>;
  onStartMerging: Mock<() => void>;
  onCancelMerging: Mock<() => void>;
  onConfirmMerge: Mock<() => void>;
}

function createHandlers(): Handlers {
  return {
    onMergeNameChange: vi.fn<(name: string) => void>(),
    onStartMerging: vi.fn<() => void>(),
    onCancelMerging: vi.fn<() => void>(),
    onConfirmMerge: vi.fn<() => void>(),
  };
}

function renderSlot(props: Partial<Parameters<typeof MergeSlot>[0]> = {}) {
  const handlers = createHandlers();
  const utils = render(
    <MergeSlot
      selectedCount={0}
      isMerging={false}
      mergeName=""
      loading={false}
      {...handlers}
      {...props}
    />
  );
  return { ...utils, handlers };
}

// Returns the two Collapse wrappers (banner row, then form row), in DOM order.
function getCollapseRows(): HTMLElement[] {
  const slot = screen.getByTestId('merge-slot');
  return Array.from(slot.children) as HTMLElement[];
}

describe('MergeSlot', () => {
  it('renders both rows collapsed (0fr) when nothing is selected', () => {
    renderSlot({ selectedCount: 0, isMerging: false });

    const [bannerRow, formRow] = getCollapseRows();
    expect(bannerRow.className).toContain('grid-rows-[0fr]');
    expect(formRow.className).toContain('grid-rows-[0fr]');
    expect(bannerRow).toHaveAttribute('aria-hidden', 'true');
    expect(formRow).toHaveAttribute('aria-hidden', 'true');
  });

  it('expands the banner row (1fr) when 2+ are selected and not merging', () => {
    renderSlot({ selectedCount: 2, isMerging: false });

    const [bannerRow, formRow] = getCollapseRows();
    expect(bannerRow.className).toContain('grid-rows-[1fr]');
    expect(formRow.className).toContain('grid-rows-[0fr]');

    expect(within(bannerRow).getByText(/2 repertoires selected/i)).toBeInTheDocument();
    expect(within(bannerRow).getByRole('button', { name: /merge selected/i })).toBeInTheDocument();
  });

  it('expands the form row (1fr) and collapses the banner when merging', () => {
    renderSlot({ selectedCount: 2, isMerging: true, mergeName: 'My merge' });

    const [bannerRow, formRow] = getCollapseRows();
    expect(bannerRow.className).toContain('grid-rows-[0fr]');
    expect(formRow.className).toContain('grid-rows-[1fr]');

    expect(within(formRow).getByPlaceholderText(/name for merged repertoire/i)).toHaveValue('My merge');
    expect(within(formRow).getByRole('button', { name: /^merge$/i })).toBeInTheDocument();
    expect(within(formRow).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('focuses the merge-name input when entering the merging state', () => {
    const { rerender, handlers } = renderSlot({ selectedCount: 2, isMerging: false });

    rerender(
      <MergeSlot
        selectedCount={2}
        isMerging={true}
        mergeName=""
        loading={false}
        {...handlers}
      />
    );

    const input = screen.getByPlaceholderText(/name for merged repertoire/i);
    expect(input).toHaveFocus();
  });

  it('forwards button clicks and keyboard shortcuts to the right handlers', () => {
    const { handlers, rerender } = renderSlot({ selectedCount: 2, isMerging: false });

    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));
    expect(handlers.onStartMerging).toHaveBeenCalledTimes(1);

    rerender(
      <MergeSlot
        selectedCount={2}
        isMerging={true}
        mergeName="abc"
        loading={false}
        {...handlers}
      />
    );

    const input = screen.getByPlaceholderText(/name for merged repertoire/i);
    fireEvent.change(input, { target: { value: 'new name' } });
    expect(handlers.onMergeNameChange).toHaveBeenCalledWith('new name');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handlers.onConfirmMerge).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handlers.onCancelMerging).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^merge$/i }));
    expect(handlers.onConfirmMerge).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handlers.onCancelMerging).toHaveBeenCalledTimes(2);
  });
});
