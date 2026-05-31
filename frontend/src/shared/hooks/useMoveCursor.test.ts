import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useMoveCursor } from './useMoveCursor';

describe('useMoveCursor', () => {
  it('defaults the cursor to -1 (before the first move)', () => {
    const { result } = renderHook(() => useMoveCursor(9));
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('honours an explicit initial index', () => {
    const { result } = renderHook(() => useMoveCursor(9, { initialIndex: 9 }));
    expect(result.current.currentMoveIndex).toBe(9);
  });

  it('clamps goToMove to the [-1, maxIndex] range', () => {
    const { result } = renderHook(() => useMoveCursor(5));

    act(() => result.current.goToMove(99));
    expect(result.current.currentMoveIndex).toBe(5);

    act(() => result.current.goToMove(-99));
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('steps through moves with goFirst/goPrev/goNext/goLast', () => {
    const { result } = renderHook(() => useMoveCursor(5));

    act(() => result.current.goLast());
    expect(result.current.currentMoveIndex).toBe(5);

    act(() => result.current.goPrev());
    expect(result.current.currentMoveIndex).toBe(4);

    act(() => result.current.goFirst());
    expect(result.current.currentMoveIndex).toBe(-1);

    act(() => result.current.goNext());
    expect(result.current.currentMoveIndex).toBe(0);
  });

  it('drives the cursor from arrow/Home/End keys when keyboard is enabled', () => {
    const { result } = renderHook(() => useMoveCursor(5));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.currentMoveIndex).toBe(0);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    });
    expect(result.current.currentMoveIndex).toBe(5);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    });
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('ignores keyboard input when keyboard is disabled', () => {
    const { result } = renderHook(() => useMoveCursor(5, { keyboard: false }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it('exposes setCurrentMoveIndex without clamping', () => {
    const { result } = renderHook(() => useMoveCursor(5));

    act(() => result.current.setCurrentMoveIndex(99));
    expect(result.current.currentMoveIndex).toBe(99);
  });
});
