import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeControls } from './TreeControls';

function props(overrides: Partial<React.ComponentProps<typeof TreeControls>> = {}) {
  return {
    scale: 1,
    onReset: vi.fn(),
    layoutMode: 'radial' as const,
    onToggleLayoutMode: vi.fn(),
    ...overrides,
  };
}

describe('TreeControls', () => {
  it('gives each icon button an accessible name matching its title', () => {
    render(
      <TreeControls
        {...props({
          onToggleExpand: vi.fn(),
          onFocusSelected: vi.fn(),
        })}
      />
    );
    expect(screen.getByRole('button', { name: 'Switch to tidy tree' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus on selected node' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
  });

  it('reflects the current layout and expand state in the labels', () => {
    render(<TreeControls {...props({ layoutMode: 'tidy', isExpanded: true, onToggleExpand: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Switch to radial tree' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
  });

  it('invokes the reset handler when activated', () => {
    const onReset = vi.fn();
    render(<TreeControls {...props({ onReset })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
