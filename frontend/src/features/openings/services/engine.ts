// Évaluations des positions : l'analyse en nuage de Lichess d'abord, Stockfish dans un worker pour le reste.
// Une position à la fois, cache par FEN.
import { Chess, type Square } from 'chess.js';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { STOCKFISH_WORKER_PATH, getOptimalThreadCount } from '../../../services/stockfishConfig';
import { MATE_CP, type Evaluation } from '../domain/diagnosis';

interface Job {
  fen: string;
  depth: number;
  resolve: (evaluation: Evaluation) => void;
  cancelled: boolean;
}

const cache = new Map<string, Evaluation>();
const queue: Job[] = [];
let worker: Worker | null = null;
let ready = false;
let running: Job | null = null;
let last: { cp: number } | null = null;

// Un téléphone qui ne fait pas tourner le build multithread ne le dit pas : sans réponse à `uci` dans ce délai,
// on le déclare absent plutôt que de laisser « … » pour toujours.
const BOOT_TIMEOUT = 20_000;
let failed = false;
const listeners = new Set<() => void>();
const fail = () => {
  if (failed) return;
  failed = true;
  worker?.terminate();
  worker = null;
  listeners.forEach((listener) => listener());
};

const keyOf = (fen: string, depth: number) => `${depth}|${fen}`;

function boot() {
  // Sans worker (tests, rendu serveur), les évaluations n'arrivent jamais : la vue reste en attente.
  if (worker || failed || typeof Worker === 'undefined') return;
  try {
    worker = new Worker(STOCKFISH_WORKER_PATH);
  } catch {
    fail();
    return;
  }
  const timer = window.setTimeout(() => !ready && fail(), BOOT_TIMEOUT);
  worker.onerror = fail;
  worker.onmessage = ({ data }: MessageEvent) => {
    if (typeof data !== 'string') return;
    if (data === 'uciok') {
      worker!.postMessage(`setoption name Threads value ${getOptimalThreadCount()}`);
      worker!.postMessage('isready');
    } else if (data === 'readyok') {
      window.clearTimeout(timer);
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
      // Une recherche arrêtée n'a pas atteint sa profondeur : elle ne vaut pas d'être gardée.
      if (!job.cancelled) {
        cache.set(keyOf(job.fen, job.depth), evaluation);
        job.resolve(evaluation);
      }
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

// L'analyse en nuage de Lichess couvre la plupart des positions d'ouverture, bien plus profond que le téléphone.
const CLOUD = 'https://lichess.org/api/cloud-eval';
// Lichess demande une minute de pause après un 429 ; pendant ce temps, Stockfish prend le relais.
const CLOUD_PAUSE = 60_000;
let cloudPausedUntil = 0;
let cloudChain: Promise<unknown> = Promise.resolve();

interface CloudAnswer {
  pvs: { cp?: number; mate?: number; moves: string }[];
}

/** L'évaluation en nuage, du point de vue des Blancs comme le reste ; `null` si Lichess ne connaît pas la position. */
function fromCloud(fen: string): Promise<Evaluation | null> {
  const ask = async (): Promise<Evaluation | null> => {
    if (Date.now() < cloudPausedUntil) return null;
    const response = await fetch(`${CLOUD}?${new URLSearchParams({ fen, multiPv: '1' })}`).catch(() => null);
    if (response?.status === 429) cloudPausedUntil = Date.now() + CLOUD_PAUSE;
    if (!response?.ok) return null;
    const pv = ((await response.json().catch(() => null)) as CloudAnswer | null)?.pvs?.[0];
    if (!pv) return null;
    const cp = pv.mate !== undefined ? (pv.mate > 0 ? MATE_CP : -MATE_CP) : (pv.cp ?? 0);
    return { cp, best: standardCastling(fen, pv.moves.split(' ')[0]) };
  };
  const next = cloudChain.then(ask, ask);
  cloudChain = next.catch(() => null);
  return next;
}

// Lichess note le roque roi-sur-tour (e1h1) ; Stockfish et le reste du code, roi-sur-case (e1g1).
const CASTLING: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
function standardCastling(fen: string, uci: string): string {
  const king = CASTLING[uci] && new Chess(fen).get(uci.slice(0, 2) as Square)?.type === 'k';
  return king ? CASTLING[uci] : uci;
}

function request(fen: string, depth: number, onDone: (evaluation: Evaluation) => void): Job | null {
  const known = cache.get(keyOf(fen, depth)) ?? terminal(fen);
  if (known) {
    onDone(known);
    return null;
  }
  // Sans worker, pas de nuage non plus : les tests restent hors réseau.
  if (typeof Worker === 'undefined') return null;
  const job: Job = { fen, depth, resolve: onDone, cancelled: false };
  fromCloud(fen).then((cloud) => {
    if (job.cancelled) return;
    if (cloud) {
      cache.set(keyOf(fen, depth), cloud);
      onDone(cloud);
      return;
    }
    boot();
    if (failed) return;
    queue.push(job);
    pump();
  });
  return job;
}

function cancel(job: Job) {
  job.cancelled = true;
  // La recherche en cours bloquerait la file jusqu'à sa profondeur : on l'arrête.
  if (running === job) worker?.postMessage('stop');
}

/** Stockfish n'a pas pu démarrer sur cet appareil : seules les positions connues du nuage Lichess auront une évaluation. */
export function useEngineFailed(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => failed,
  );
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
      jobs.forEach(cancel);
      if (flush !== null) window.clearTimeout(flush);
    };
  }, [fens, depth, enabled]);
  return results;
}
