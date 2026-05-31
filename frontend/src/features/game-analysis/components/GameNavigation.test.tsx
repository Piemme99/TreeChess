import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameNavigation } from './GameNavigation';

function props(overrides: Partial<React.ComponentProps<typeof GameNavigation>> = {}) {
  return {
    currentMoveIndex: 1,
    maxDisplayedMoveIndex: 3,
    goFirst: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
    goLast: vi.fn(),
    ...overrides,
  };
}

describe('GameNavigation', () => {
  it('exposes accessible names for every navigation control', () => {
    render(<GameNavigation {...props()} />);
    expect(screen.getByRole('button', { name: 'Go to start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to end' })).toBeInTheDocument();
  });

  it('invokes the matching handler when a control is clicked', () => {
    const goFirst = vi.fn();
    const goLast = vi.fn();
    render(<GameNavigation {...props({ goFirst, goLast })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to start' }));
    expect(goFirst).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Go to end' }));
    expect(goLast).toHaveBeenCalledTimes(1);
  });

  it('disables back controls at the start and forward controls at the end', () => {
    const { rerender } = render(<GameNavigation {...props({ currentMoveIndex: -1 })} />);
    expect(screen.getByRole('button', { name: 'Go to start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled();

    rerender(<GameNavigation {...props({ currentMoveIndex: 3 })} />);
    expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to end' })).toBeDisabled();
  });
});
