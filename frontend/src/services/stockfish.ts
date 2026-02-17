import type { EngineEvaluation, UCIInfo } from '../types';
import { Chess } from 'chess.js';
import { STOCKFISH_WORKER_PATH, getOptimalThreadCount } from './stockfishConfig';

interface StockfishCallbacks {
  onEvaluation?: (evaluation: EngineEvaluation) => void;
  /** Called when MultiPV > 1 with all lines for the current depth. */
  onLines?: (lines: EngineEvaluation[]) => void;
  onBestMove?: (move: { from: string; to: string }) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

class StockfishService {
  private worker: Worker | null = null;
  private isReady = false;
  private currentDepth = 12;
  private currentMultiPV = 1;
  private callbacks: StockfishCallbacks = {};
  /** Accumulated lines keyed by multipv index (1-based) for current depth. */
  private pendingLines: Map<number, UCIInfo> = new Map();
  private currentFEN: string = '';

  initialize(): void {
    if (this.worker) {
      return;
    }

    try {
      // Stockfish 18 NNUE (lite multi-thread) — runs as a Web Worker.
      // The .wasm file (~7MB, with embedded NNUE net) is fetched automatically.
      this.worker = new Worker(STOCKFISH_WORKER_PATH);
      
      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.worker.onerror = (error: ErrorEvent) => {
        this.callbacks.onError?.(`Worker error: ${error.message}`);
      };

      // Initialize UCI protocol
      this.sendCommand('uci');
      
    } catch (error) {
      this.callbacks.onError?.(`Failed to initialize: ${error}`);
    }
  }

  private sendCommand(command: string): void {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  analyzePosition(fen: string, depth: number = 12, multiPV: number = 1): void {
    if (!this.worker || !this.isReady) {
      return;
    }

    this.currentDepth = depth;
    this.currentFEN = fen;
    this.pendingLines.clear();

    // Set MultiPV if changed
    if (multiPV !== this.currentMultiPV) {
      this.currentMultiPV = multiPV;
      this.sendCommand(`setoption name MultiPV value ${multiPV}`);
    }

    this.sendCommand('stop');
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);
  }

  stop(): void {
    this.sendCommand('stop');
    this.pendingLines.clear();
  }

  terminate(): void {
    if (this.worker) {
      this.sendCommand('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  setCallbacks(callbacks: StockfishCallbacks): void {
    this.callbacks = callbacks;
  }

  private handleMessage(line: string): void {
    if (typeof line !== 'string') return;

    if (line === 'uciok') {
      // Configure threads before declaring ready
      const threads = getOptimalThreadCount();
      this.sendCommand(`setoption name Threads value ${threads}`);
      this.sendCommand('isready');
    } else if (line === 'readyok') {
      this.isReady = true;
      this.callbacks.onReady?.();
    } else if (line.startsWith('info depth')) {
      const info = this.parseInfoLine(line);
      if (info && info.depth <= this.currentDepth) {
        const pvIndex = info.multipv ?? 1;

        // Store this line by its multipv index
        this.pendingLines.set(pvIndex, info);

        // For single PV: send intermediate evaluations for UI updates (depth 10+)
        if (this.currentMultiPV === 1) {
          if (info.depth >= 10 && info.pv && info.pv.length > 0) {
            const from = info.pv[0].slice(0, 2);
            const to = info.pv[0].slice(2, 4);
            const evaluation = this.buildEvaluation(info, from, to);
            this.callbacks.onEvaluation?.(evaluation);
          }
        } else {
          // For MultiPV: send all lines when we have a complete set at depth 10+
          if (info.depth >= 10 && pvIndex === this.currentMultiPV) {
            this.emitLines();
          }
        }
      }
    } else if (line.startsWith('bestmove')) {
      this.handleBestMove(line);
    }
  }

  private handleBestMove(line: string): void {
    const parts = line.split(' ');
    const moveUCI = parts[1];

    if (!moveUCI || moveUCI === '(none)') return;

    const from = moveUCI.slice(0, 2);
    const to = moveUCI.slice(2, 4);

    this.callbacks.onBestMove?.({ from, to });

    if (this.currentMultiPV === 1) {
      // Single PV: emit the best (only) line
      const bestInfo = this.pendingLines.get(1);
      if (bestInfo) {
        const evaluation = this.buildEvaluation(bestInfo, from, to);
        evaluation.bestMove = moveUCI;
        this.callbacks.onEvaluation?.(evaluation);
      }
    } else {
      // MultiPV: emit all lines
      this.emitLines(moveUCI);
    }

    this.pendingLines.clear();
  }

  /** Emit all accumulated MultiPV lines via the onLines callback. */
  private emitLines(bestMoveUCI?: string): void {
    const lines: EngineEvaluation[] = [];

    for (let i = 1; i <= this.currentMultiPV; i++) {
      const info = this.pendingLines.get(i);
      if (!info || !info.pv || info.pv.length === 0) continue;

      const from = info.pv[0].slice(0, 2);
      const to = info.pv[0].slice(2, 4);
      const evaluation = this.buildEvaluation(info, from, to);
      evaluation.multipv = i;

      // Set bestMove on the first line if we have it
      if (i === 1 && bestMoveUCI) {
        evaluation.bestMove = bestMoveUCI;
      }

      lines.push(evaluation);
    }

    if (lines.length > 0) {
      // Always emit the best line as a single evaluation for backward compat
      this.callbacks.onEvaluation?.(lines[0]);
      // Emit all lines for MultiPV consumers
      this.callbacks.onLines?.(lines);
    }
  }

  private buildEvaluation(info: UCIInfo, from: string, to: string): EngineEvaluation {
    return {
      score: info.score ?? 0,
      mate: info.scoreMate,
      depth: info.depth,
      pv: info.pv,
      bestMoveFrom: from,
      bestMoveTo: to,
      multipv: info.multipv,
    };
  }

  private parseInfoLine(line: string): UCIInfo | null {
    const parts = line.split(' ');
    
    const info: UCIInfo = {
      depth: 0,
      pv: [],
    };

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === 'depth' && parts[i + 1]) {
        info.depth = parseInt(parts[i + 1], 10);
      } else if (part === 'multipv' && parts[i + 1]) {
        info.multipv = parseInt(parts[i + 1], 10);
      } else if (part === 'score' && parts[i + 1]) {
        const scoreType = parts[i + 1];
        const scoreValue = parts[i + 2];

        if (scoreType === 'cp' && scoreValue) {
          info.score = parseInt(scoreValue, 10);
        } else if (scoreType === 'mate' && scoreValue) {
          info.scoreMate = parseInt(scoreValue, 10);
        }
      } else if (part === 'pv') {
        info.pv = parts.slice(i + 1);
        break;
      }
    }

    // Only return if we have meaningful data
    if (info.depth > 0) {
      return info;
    }
    return null;
  }

  /**
   * Convert UCI move notation to SAN using the current position
   */
  uciToSAN(uciMove: string, fen?: string): string {
    try {
      const positionFEN = fen || this.currentFEN;
      if (!positionFEN || !uciMove || uciMove.length < 4) {
        return uciMove;
      }

      const chess = new Chess(positionFEN);
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      const move = chess.move({ from, to, promotion });
      return move ? move.san : uciMove;
    } catch {
      return uciMove;
    }
  }

  formatScore(score: number | undefined): string {
    if (score === undefined || score === null) return '0.0';
    if (score === 0) return '0.0';
    return `${score > 0 ? '+' : ''}${(score / 100).toFixed(1)}`;
  }

  isEngineReady(): boolean {
    return this.isReady;
  }
}

export const stockfishService = new StockfishService();
