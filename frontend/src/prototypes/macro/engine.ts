// PROTOTYPE — pilote UCI minimal pour évaluer un lot de positions. Jetable.
import { STOCKFISH_WORKER_PATH, getOptimalThreadCount } from '../../services/stockfishConfig';

export interface Eval {
  /** Centipions du point de vue du trait. Mat ramené à ±1000. */
  cp: number;
  best: string;
}

export class BatchEngine {
  private worker: Worker | null = null;
  private pending: { resolve: (e: Eval) => void; cp: number; best: string } | null = null;
  private tokenWaiters = new Map<string, () => void>();
  threads = 1;

  async init(): Promise<void> {
    this.worker = new Worker(STOCKFISH_WORKER_PATH);
    this.worker.onmessage = (e) => this.onLine(String(e.data));
    this.threads = getOptimalThreadCount();

    this.send('uci');
    await this.waitFor('uciok');
    this.send(`setoption name Threads value ${this.threads}`);
    this.send('setoption name MultiPV value 1');
    this.send('setoption name Hash value 64');
    this.send('isready');
    await this.waitFor('readyok');
  }

  evaluate(fen: string, depth: number): Promise<Eval> {
    return new Promise((resolve) => {
      this.pending = { resolve, cp: 0, best: '' };
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(token: string): Promise<void> {
    return new Promise((resolve) => this.tokenWaiters.set(token, resolve));
  }

  private onLine(line: string) {
    const waiter = this.tokenWaiters.get(line);
    if (waiter) {
      this.tokenWaiters.delete(line);
      waiter();
      return;
    }

    if (!this.pending) return;

    if (line.startsWith('info ') && line.includes(' score ')) {
      const mate = line.match(/score mate (-?\d+)/);
      const cp = line.match(/score cp (-?\d+)/);
      if (mate) this.pending.cp = Number(mate[1]) > 0 ? 1000 : -1000;
      else if (cp) this.pending.cp = Number(cp[1]);
      const pv = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (pv) this.pending.best = pv[1];
      return;
    }

    if (line.startsWith('bestmove')) {
      const best = line.split(/\s+/)[1] ?? this.pending.best;
      const { resolve, cp } = this.pending;
      this.pending = null;
      resolve({ cp, best });
    }
  }
}
