import { useEffect, useRef, useCallback } from 'react';
import { useEngineStore } from '../../../../stores/engineStore';
import { stockfishService } from '../../../../services/stockfish';

export function useEngine() {
  const isInitializedRef = useRef(false);
  const { 
    isAnalyzing, 
    currentEvaluation, 
    currentFEN, 
    error,
    setEvaluation, 
    setError, 
    setAnalyzing 
  } = useEngineStore();

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    stockfishService.setCallbacks({
      onEvaluation: (evaluation) => {
        setEvaluation(evaluation);
      },
      onError: (err) => {
        console.error('[useEngine] Stockfish error:', err);
        setError(err);
      },
      onReady: () => {
        console.log('[useEngine] Stockfish ready');
      }
    });

    stockfishService.initialize();

    return () => {
      stockfishService.stop();
      stockfishService.terminate();
      isInitializedRef.current = false;
    };
  }, [setEvaluation, setError]);

  const analyze = useCallback((fen: string) => {
    if (!fen) return;
    setAnalyzing(true, fen);
    stockfishService.analyzePosition(fen, 16);
  }, [setAnalyzing]);

  const stop = useCallback(() => {
    stockfishService.stop();
  }, []);

  return {
    isAnalyzing,
    currentEvaluation,
    currentFEN,
    error,
    analyze,
    stop
  };
}
