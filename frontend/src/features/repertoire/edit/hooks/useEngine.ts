import { useEffect, useRef, useCallback } from 'react';
import { useEngineStore } from '../../../../stores/engineStore';
import { stockfishService } from '../../../../services/stockfish';
import type { EngineEvaluation } from '../../../../types';

interface EngineAPI {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  currentFEN: string;
  error: string | null;
  analyze: (fen: string) => void;
  stop: () => void;
}

export function useEngine() {
  const isInitializedRef = useRef(false);
  const latestFenRef = useRef<string>('');
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
        setError(err);
      },
      onReady: () => {
        // Worker just became ready — replay the latest analysis request
        // that may have been silently dropped before init completed
        if (latestFenRef.current) {
          stockfishService.analyzePosition(latestFenRef.current, 16);
        }
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
    latestFenRef.current = fen;
    setAnalyzing(true, fen);
    stockfishService.analyzePosition(fen, 16);
  }, [setAnalyzing]);

  const stop = useCallback(() => {
    stockfishService.stop();
  }, []);

  // Use ref to maintain stable object reference
  const engineRef = useRef<EngineAPI>({
    isAnalyzing,
    currentEvaluation,
    currentFEN,
    error,
    analyze,
    stop
  });

  // Update the ref values without changing the object reference
  engineRef.current.isAnalyzing = isAnalyzing;
  engineRef.current.currentEvaluation = currentEvaluation;
  engineRef.current.currentFEN = currentFEN;
  engineRef.current.error = error;
  engineRef.current.analyze = analyze;
  engineRef.current.stop = stop;

  return engineRef.current;
}
