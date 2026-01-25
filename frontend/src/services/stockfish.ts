import type { EngineEvaluation, UCIInfo } from '../types';
import { Chess } from 'chess.js';

interface StockfishCallbacks {
  onEvaluation?: (evaluation: EngineEvaluation) => void;
  onBestMove?: (move: { from: string; to: string }) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

class StockfishService {
  private worker: Worker | null = null;
  private isReady = false;
  private currentDepth = 12;
  private callbacks: StockfishCallbacks = {};
  private pendingEvaluation: UCIInfo | null = null;
  private currentFEN: string = '';

  initialize(): void {
    if (this.worker) {
      console.log('[Stockfish] Already initialized');
      return;
    }

    try {
      console.log('[Stockfish] Creating worker...');
      
      // stockfish.wasm.js is designed to run as a Web Worker
      // It's a self-contained script that sets up its own onmessage handler
      this.worker = new Worker('/stockfish.js');
      
      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.worker.onerror = (error: ErrorEvent) => {
        console.error('[Stockfish] Worker error:', error);
        this.callbacks.onError?.(`Worker error: ${error.message}`);
      };

      // Initialize UCI protocol
      this.sendCommand('uci');
      
    } catch (error) {
      console.error('[Stockfish] Failed to create worker:', error);
      this.callbacks.onError?.(`Failed to initialize: ${error}`);
    }
  }

  private sendCommand(command: string): void {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  analyzePosition(fen: string, depth: number = 12): void {
    if (!this.worker) {
      console.warn('[Stockfish] Worker not initialized');
      return;
    }

    this.currentDepth = depth;
    this.currentFEN = fen;
    this.pendingEvaluation = null;

    this.sendCommand('stop');
    this.sendCommand('ucinewgame');
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);
  }

  stop(): void {
    this.sendCommand('stop');
    this.pendingEvaluation = null;
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
      console.log('[Stockfish] UCI ready');
      this.sendCommand('isready');
    } else if (line === 'readyok') {
      console.log('[Stockfish] Engine ready');
      this.isReady = true;
      this.callbacks.onReady?.();
    } else if (line.startsWith('info depth')) {
      const info = this.parseInfoLine(line);
      if (info && info.depth <= this.currentDepth) {
        this.pendingEvaluation = info;
        
        // Send intermediate evaluations for UI updates
        if (info.depth >= 6 && info.pv && info.pv.length > 0) {
          const from = info.pv[0].slice(0, 2);
          const to = info.pv[0].slice(2, 4);
          const evaluation = this.buildEvaluation(info, from, to);
          this.callbacks.onEvaluation?.(evaluation);
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

    if (this.pendingEvaluation) {
      const evaluation = this.buildEvaluation(this.pendingEvaluation, from, to);
      evaluation.bestMove = moveUCI;
      this.callbacks.onEvaluation?.(evaluation);
      this.pendingEvaluation = null;
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
