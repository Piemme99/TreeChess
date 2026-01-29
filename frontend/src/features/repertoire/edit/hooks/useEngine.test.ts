import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEngine } from './useEngine';
import { useEngineStore } from '../../../../stores/engineStore';

// Mock the stockfish service
vi.mock('../../../../services/stockfish', () => ({
  stockfishService: {
    initialize: vi.fn(),
    stop: vi.fn(),
    terminate: vi.fn(),
    analyzePosition: vi.fn(),
    setCallbacks: vi.fn(),
  },
}));

describe('useEngine', () => {
  beforeEach(() => {
    // Reset the store before each test
    useEngineStore.getState().reset();
    vi.clearAllMocks();
  });

  it('should return stable object reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useEngine());
    
    // Get initial engine object reference
    const firstEngineRef = result.current;
    
    // Trigger re-render
    rerender();
    
    // Get new engine object reference
    const secondEngineRef = result.current;
    
    // The engine object should be the same reference (stable)
    // If it's not stable, it can cause infinite loops when used in useEffect dependencies
    expect(secondEngineRef).toBe(firstEngineRef);
  });

  it('should maintain stable analyze function reference', () => {
    const { result, rerender } = renderHook(() => useEngine());
    
    const firstAnalyze = result.current.analyze;
    
    // Trigger re-render multiple times
    rerender();
    rerender();
    rerender();
    
    const lastAnalyze = result.current.analyze;
    
    // analyze function should maintain stable reference
    expect(lastAnalyze).toBe(firstAnalyze);
  });

  it('should update isAnalyzing state without breaking object stability', async () => {
    const { result } = renderHook(() => useEngine());
    
    const initialEngine = result.current;
    
    // Trigger state update via the store
    const store = useEngineStore.getState();
    store.setAnalyzing(true, 'test-fen');
    
    // Wait for re-render
    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(true);
    });
    
    // The engine object reference should remain stable even after state change
    expect(result.current).toBe(initialEngine);
  });
});
