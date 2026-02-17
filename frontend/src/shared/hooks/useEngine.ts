import { useEffect, useRef, useCallback } from 'react';
import { useEngineStore } from '../../stores/engineStore';
import { stockfishService } from '../../services/stockfish';
import type { EngineEvaluation } from '../../types';

interface EngineAPI {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  /** All MultiPV lines (ordered best-first). Empty when MultiPV=1. */
  currentLines: EngineEvaluation[];
  currentFEN: string;
  error: string | null;
  analyze: (fen: string) => void;
  stop: () => void;
}

interface UseEngineOptions {
  /** Number of principal variations to compute (default: 1). */
  multiPV?: number;
  /** Analysis depth (default: 16). */
  depth?: number;
}

export function useEngine(options?: UseEngineOptions) {
  const multiPV = options?.multiPV ?? 1;
  const depth = options?.depth ?? 16;
  const isInitializedRef = useRef(false);
  const latestFenRef = useRef<string>('');
  const {
    isAnalyzing,
    currentEvaluation,
    currentLines,
    currentFEN,
    error,
    setEvaluation,
    setLines,
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
      onLines: (lines) => {
        setLines(lines);
      },
      onError: (err) => {
        setError(err);
      },
      onReady: () => {
        // Worker just became ready — replay the latest analysis request
        // that may have been silently dropped before init completed
        if (latestFenRef.current) {
          stockfishService.analyzePosition(latestFenRef.current, depth, multiPV);
        }
      }
    });

    stockfishService.initialize();

    return () => {
      stockfishService.stop();
      stockfishService.terminate();
      isInitializedRef.current = false;
    };
  }, [setEvaluation, setLines, setError, depth, multiPV]);

  const analyze = useCallback((fen: string) => {
    if (!fen) return;
    latestFenRef.current = fen;
    setAnalyzing(true, fen);
    stockfishService.analyzePosition(fen, depth, multiPV);
  }, [setAnalyzing, depth, multiPV]);

  const stop = useCallback(() => {
    stockfishService.stop();
  }, []);

  // Use ref to maintain stable object reference
  const engineRef = useRef<EngineAPI>({
    isAnalyzing,
    currentEvaluation,
    currentLines,
    currentFEN,
    error,
    analyze,
    stop
  });

  // Update the ref values without changing the object reference
  engineRef.current.isAnalyzing = isAnalyzing;
  engineRef.current.currentEvaluation = currentEvaluation;
  engineRef.current.currentLines = currentLines;
  engineRef.current.currentFEN = currentFEN;
  engineRef.current.error = error;
  engineRef.current.analyze = analyze;
  engineRef.current.stop = stop;

  return engineRef.current;
}
