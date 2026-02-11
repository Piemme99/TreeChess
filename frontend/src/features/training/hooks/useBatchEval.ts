import { useState, useEffect, useRef, useCallback } from 'react';

const BATCH_DEPTH = 12;

export interface PositionEval {
  fen: string;
  /** Score in centipawns from white's perspective. null if mate. */
  score: number | null;
  /** Mate in N (positive = white mates, negative = black mates). */
  mate: number | null;
}

export interface MoveEvalDelta {
  /** Eval loss in centipawns (always >= 0). null if not computed yet. */
  cpLoss: number | null;
  /** Score after this move in centipawns from white's POV. */
  scoreAfter: number | null;
  /** Mate after this move. */
  mateAfter: number | null;
}

/**
 * Spawns a dedicated Stockfish worker that evaluates all positions in a game
 * at low depth. Returns per-move eval deltas progressively.
 *
 * `fens` should be [startingPos, afterMove0, afterMove1, ...] (length = moves + 1).
 * `userColor` determines which moves get a delta computed.
 */
export function useBatchEval(
  fens: string[],
  userColor: 'w' | 'b',
  enabled: boolean,
) {
  const [evals, setEvals] = useState<PositionEval[]>([]);
  const [deltas, setDeltas] = useState<MoveEvalDelta[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const abortedRef = useRef(false);

  // Compute deltas from position evals
  const computeDeltas = useCallback((posEvals: PositionEval[], numMoves: number, color: 'w' | 'b') => {
    const result: MoveEvalDelta[] = [];
    for (let i = 0; i < numMoves; i++) {
      const before = posEvals[i];
      const after = posEvals[i + 1];

      if (!before || !after) {
        result.push({ cpLoss: null, scoreAfter: after?.score ?? null, mateAfter: after?.mate ?? null });
        continue;
      }

      // Determine if this is a user move
      const isUserMove = (i % 2 === 0 && color === 'w') || (i % 2 === 1 && color === 'b');

      if (!isUserMove) {
        // Opponent moves — no loss to compute
        result.push({ cpLoss: null, scoreAfter: after.score, mateAfter: after.mate });
        continue;
      }

      // Handle mate scores: treat as large cp values
      const scoreBefore = before.mate !== null
        ? (before.mate > 0 ? 10000 : -10000)
        : (before.score ?? 0);
      const scoreAfter = after.mate !== null
        ? (after.mate > 0 ? 10000 : -10000)
        : (after.score ?? 0);

      // cpLoss from the user's perspective:
      // If user is white: loss = scoreBefore - scoreAfter (higher = white is better)
      // If user is black: loss = scoreAfter - scoreBefore (lower = black is better)
      const rawLoss = color === 'w'
        ? scoreBefore - scoreAfter
        : scoreAfter - scoreBefore;

      result.push({
        cpLoss: Math.max(0, rawLoss),
        scoreAfter: after.score,
        mateAfter: after.mate,
      });
    }
    return result;
  }, []);

  useEffect(() => {
    if (!enabled || fens.length < 2) return;

    abortedRef.current = false;
    setEvals([]);
    setDeltas([]);
    setProgress(0);
    setDone(false);

    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

    const positionEvals: PositionEval[] = [];
    let currentIndex = 0;
    let isReady = false;
    let pendingScore: number | null = null;
    let pendingMate: number | null = null;
    const numMoves = fens.length - 1;

    function send(cmd: string) {
      worker.postMessage(cmd);
    }

    function analyzeNext() {
      if (abortedRef.current || currentIndex >= fens.length) {
        setDone(true);
        return;
      }
      send('stop');
      send(`position fen ${fens[currentIndex]}`);
      send(`go depth ${BATCH_DEPTH}`);
    }

    worker.onmessage = (event: MessageEvent) => {
      const line = event.data;
      if (typeof line !== 'string') return;

      if (line === 'uciok') {
        send('isready');
      } else if (line === 'readyok') {
        isReady = true;
        analyzeNext();
      } else if (line.startsWith('info depth')) {
        // Parse score from info line
        const parts = line.split(' ');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === 'score' && parts[i + 1]) {
            if (parts[i + 1] === 'cp' && parts[i + 2]) {
              pendingScore = parseInt(parts[i + 2], 10);
              pendingMate = null;
            } else if (parts[i + 1] === 'mate' && parts[i + 2]) {
              pendingMate = parseInt(parts[i + 2], 10);
              pendingScore = null;
            }
          }
        }
      } else if (line.startsWith('bestmove')) {
        if (abortedRef.current) return;

        // Stockfish reports scores from the side-to-move's perspective.
        // Normalize to white's perspective so cpLoss deltas are correct.
        const sideToMove = fens[currentIndex].split(' ')[1]; // 'w' or 'b'
        const evalResult: PositionEval = {
          fen: fens[currentIndex],
          score: pendingScore !== null && sideToMove === 'b' ? -pendingScore : pendingScore,
          mate: pendingMate !== null && sideToMove === 'b' ? -pendingMate : pendingMate,
        };
        positionEvals.push(evalResult);
        pendingScore = null;
        pendingMate = null;

        // Update state progressively
        setEvals([...positionEvals]);
        setProgress(positionEvals.length);
        setDeltas(computeDeltas(positionEvals, numMoves, userColor));

        currentIndex++;
        if (currentIndex < fens.length) {
          analyzeNext();
        } else {
          setDone(true);
        }
      }
    };

    if (isReady) {
      analyzeNext();
    } else {
      send('uci');
    }

    return () => {
      abortedRef.current = true;
      worker.postMessage('quit');
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, fens, userColor, computeDeltas]);

  return { evals, deltas, progress, total: fens.length, done };
}
