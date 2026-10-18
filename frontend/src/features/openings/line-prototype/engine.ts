// PROTOTYPE — file d'évaluations Stockfish pour la vue de ligne, avec cache par FEN. À jeter avec le dossier.
import { Chess } from 'chess.js';
import { useEffect, useState } from 'react';
import { STOCKFISH_WORKER_PATH, getOptimalThreadCount } from '../../../services/stockfishConfig';

export interface Evaluation {
  /** Centipions du point de vue des Blancs ; un mat vaut ±MATE_CP. */
  cp: number;
  /** Meilleur coup en UCI, absent en fin de partie. */
  best?: string;
}

interface Job {
  fen: string;
  depth: number;
  resolve: (evaluation: Evaluation) => void;
  cancelled: boolean;
}

const MATE_CP = 3000;
const cache = new Map<string, Evaluation>();
const queue: Job[] = [];
let worker: Worker | null = null;
let ready = false;
let running: Job | null = null;
let last: { cp: number } | null = null;

const keyOf = (fen: string, depth: number) => `${depth}|${fen}`;

function boot() {
  if (worker) return;
  worker = new Worker(STOCKFISH_WORKER_PATH);
  worker.onmessage = ({ data }: MessageEvent) => {
    if (typeof data !== 'string') return;
    if (data === 'uciok') {
      worker!.postMessage(`setoption name Threads value ${getOptimalThreadCount()}`);
      worker!.postMessage('isready');
    } else if (data === 'readyok') {
      ready = true;
      pump();
    } else if (data.startsWith('info depth') && data.includes(' score ')) {
      const match = data.match(/score (cp|mate) (-?\d+)/);
      if (match) {
        const value = Number(match[2]);
        last = { cp: match[1] === 'cp' ? value : value > 0 ? MATE_CP : -MATE_CP };
      }
    } else if (data.startsWith('bestmove') && running) {
      const job = running;
      running = null;
      const white = job.fen.split(' ')[1] === 'w' ? 1 : -1;
      const evaluation = { cp: (last?.cp ?? 0) * white, best: data.split(' ')[1] };
      last = null;
      cache.set(keyOf(job.fen, job.depth), evaluation);
      job.resolve(evaluation);
      pump();
    }
  };
  worker.postMessage('uci');
}

function pump() {
  if (!ready || running) return;
  let job = queue.shift();
  while (job?.cancelled) job = queue.shift();
  if (!job) return;
  running = job;
  worker!.postMessage(`position fen ${job.fen}`);
  worker!.postMessage(`go depth ${job.depth}`);
}

// Une partie finie n'a pas besoin du moteur, et Stockfish répond mal sur une position sans coup légal.
function terminal(fen: string): Evaluation | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { cp: chess.turn() === 'w' ? -MATE_CP : MATE_CP };
  if (chess.isDraw() || chess.isStalemate()) return { cp: 0 };
  return null;
}

function request(fen: string, depth: number, onDone: (evaluation: Evaluation) => void): Job | null {
  const known = cache.get(keyOf(fen, depth)) ?? terminal(fen);
  if (known) {
    onDone(known);
    return null;
  }
  boot();
  const job: Job = { fen, depth, resolve: onDone, cancelled: false };
  queue.push(job);
  pump();
  return job;
}

/** Évalue les positions dans l'ordre donné ; la carte se remplit au fil des résultats. */
export function useEvaluations(fens: readonly string[], depth: number, enabled = true): Map<string, Evaluation> {
  const [results, setResults] = useState(() => new Map<string, Evaluation>());
  useEffect(() => {
    if (!enabled) return;
    const jobs: Job[] = [];
    const found = new Map<string, Evaluation>();
    let live = true;
    let flush: number | null = null;
    const publish = () => {
      flush = null;
      setResults(new Map(found));
    };
    for (const fen of new Set(fens)) {
      const job = request(fen, depth, (evaluation) => {
        if (!live) return;
        found.set(fen, evaluation);
        flush ??= window.setTimeout(publish, 120);
      });
      if (job) jobs.push(job);
    }
    publish();
    return () => {
      live = false;
      for (const job of jobs) job.cancelled = true;
      if (flush !== null) window.clearTimeout(flush);
    };
  }, [fens, depth, enabled]);
  return results;
}

export function evaluate(fen: string, depth: number): Promise<Evaluation> {
  return new Promise((resolve) => {
    request(fen, depth, resolve);
  });
}
